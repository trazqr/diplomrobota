using System.Data;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;

namespace DndForum;

public static class Auth
{
    public const string SessionCookieName = "dndforum.session";

    private const int Iterations = 210_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"v1.{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 4 || parts[0] != "v1") return false;
        if (!int.TryParse(parts[1], out var iterations)) return false;

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(
            password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    public static void BurnPasswordAttempt(string password) =>
        VerifyPassword(password, MissingUserHash.Value);

    private static readonly Lazy<string> MissingUserHash =
        new(() => HashPassword(NewToken()));

    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public static (string Token, Session Session) NewSession(int userId)
    {
        var token = NewToken();
        return (token, new Session
        {
            TokenHash = HashSessionToken(token),
            UserId = userId,
        });
    }

    public static async Task<User?> CurrentUser(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        await using var connection = await connections.OpenAsync(context.RequestAborted);
        return await CurrentUser(context, connection, cancellationToken: context.RequestAborted);
    }

    public static async Task<User?> CurrentUser(
        HttpContext context,
        SqliteConnection connection,
        IDbTransaction? transaction = null,
        CancellationToken cancellationToken = default)
    {
        var token = SessionToken(context);
        if (token is null) return null;
        var tokenHash = HashSessionToken(token);

        var row = await connection.QuerySingleOrDefaultAsync<CurrentUserRow>(
            new CommandDefinition("""
                SELECT
                    u.Id, u.Login, u.PasswordHash, u.Name, u.Role,
                    u.CharClass, u.Race, u.Level, u.Bio, u.Avatar,
                    u.CreatedAt, u.Cursor, u.ShowWanderers, u.ShowDragon, u.IsOwner, u.IsBanned,
                    u.BanReason, u.BannedAt,
                    s.Id AS SessionId, s.ExpiresAt AS SessionExpiresAt
                FROM Sessions s
                JOIN Users u ON u.Id = s.UserId
                WHERE s.TokenHash = @TokenHash
                LIMIT 1;
                """,
                new { TokenHash = tokenHash },
                transaction,
                cancellationToken: cancellationToken));

        if (row is null)
        {
            DeleteSessionCookie(context);
            return null;
        }
        if (row.SessionExpiresAt <= DateTime.UtcNow)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Sessions WHERE Id = @SessionId;",
                new { row.SessionId },
                transaction,
                cancellationToken: cancellationToken));
            DeleteSessionCookie(context);
            return null;
        }

        if (row.IsBanned)
        {
            DeleteSessionCookie(context);
            return null;
        }

        return row;
    }

    public static string? SessionToken(HttpContext context)
    {
        var token = context.Request.Cookies[SessionCookieName]?.Trim();
        return token is { Length: > 0 and <= 100 } ? token : null;
    }

    public static void WriteSessionCookie(
        HttpContext context,
        string token,
        DateTime expiresAt) =>
        context.Response.Cookies.Append(
            SessionCookieName,
            token,
            SessionCookieOptions(context, expiresAt));

    public static void DeleteSessionCookie(HttpContext context) =>
        context.Response.Cookies.Delete(
            SessionCookieName,
            SessionCookieOptions(context));

    public static bool IsValidLogin(string? login) =>
        !string.IsNullOrWhiteSpace(login)
        && login.Length is >= 3 and <= 32
        && login.All(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_');

    public static bool IsValidPassword(string? password) =>
        !string.IsNullOrEmpty(password) && password.Length is >= 8 and <= 128;

    internal static string HashSessionToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static CookieOptions SessionCookieOptions(
        HttpContext context,
        DateTime? expiresAt = null) => new()
        {
            HttpOnly = true,
            Secure = !context.RequestServices
                .GetRequiredService<IHostEnvironment>()
                .IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/api",
            Expires = expiresAt is null
                ? null
                : new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)),
        };

    private sealed class CurrentUserRow : User
    {
        public int SessionId { get; init; }
        public DateTime SessionExpiresAt { get; init; }
    }
}
