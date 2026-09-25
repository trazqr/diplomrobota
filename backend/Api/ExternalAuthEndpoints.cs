using System.Security.Claims;
using System.Text;
using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.Data.Sqlite;

namespace DndForum.Api;

public static class ExternalAuthEndpoints
{
    internal const string ExternalScheme = "dndforum.external";
    internal const string ExternalCookieName = "dndforum.external";

    private static readonly TimeSpan StartWindow = TimeSpan.FromMinutes(15);

    public static IEndpointRouteBuilder MapExternalAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/auth/providers", ListProviders);
        routes.MapGet("/api/auth/google/start", StartGoogle);
        routes.MapGet("/api/auth/external/complete", Complete);
        return routes;
    }

    private static async Task<IResult> ListProviders(IAuthenticationSchemeProvider schemes)
    {
        var google = await schemes.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is not null;
        return Results.Ok(new { google });
    }

    private static async Task<IResult> StartGoogle(
        HttpContext context,
        IAuthenticationSchemeProvider schemes,
        string? returnUrl)
    {
        if (await schemes.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is null)
            return ApiSupport.NotFound("provider_disabled");
        if (!RateLimiter.TryHit(context, "external-start", 20, StartWindow, out var wait))
            return ApiSupport.TooMany(context, wait);

        var target = SafeReturnUrl(returnUrl);
        return Results.Challenge(
            new AuthenticationProperties
            {
                RedirectUri = $"/api/auth/external/complete?returnUrl={Uri.EscapeDataString(target)}",
            },
            [GoogleDefaults.AuthenticationScheme]);
    }

    private static async Task<IResult> Complete(
        HttpContext context,
        SqliteConnectionFactory connections,
        ILoggerFactory loggers,
        string? returnUrl)
    {
        var target = SafeReturnUrl(returnUrl);
        var result = await context.AuthenticateAsync(ExternalScheme);
        await context.SignOutAsync(ExternalScheme);

        if (!result.Succeeded || result.Principal is null)
            return Results.Redirect(WithError(target, "external_failed"));

        var providerKey = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(providerKey))
            return Results.Redirect(WithError(target, "external_failed"));

        var provider = result.Ticket?.AuthenticationScheme ?? GoogleDefaults.AuthenticationScheme;
        var emailVerified = string.Equals(
            result.Principal.FindFirstValue("email_verified"), "true", StringComparison.OrdinalIgnoreCase);
        var email = emailVerified
            ? (result.Principal.FindFirstValue(ClaimTypes.Email) ?? "").Trim().ToLowerInvariant()
            : "";
        var displayName = (result.Principal.FindFirstValue(ClaimTypes.Name) ?? "").Trim();

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);

        var user = await FindLinkedUser(connection, transaction, provider, providerKey, cancellationToken);

        if (user is null && email.Length > 0)
        {
            user = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
                "SELECT * FROM Users WHERE Email = @Email LIMIT 1;",
                new { Email = email },
                transaction,
                cancellationToken: cancellationToken));
            if (user is not null)
                await Link(connection, transaction, provider, providerKey, user.Id, cancellationToken);
        }

        if (user is null)
        {
            user = await CreateUser(
                connection, transaction, email, displayName, cancellationToken);
            await Link(connection, transaction, provider, providerKey, user.Id, cancellationToken);
        }

        if (user.IsBanned)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Redirect(WithError(target, "account_banned"));
        }

        var (token, session) = Auth.NewSession(user.Id);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Sessions (TokenHash, UserId, CreatedAt, ExpiresAt)
            VALUES (@TokenHash, @UserId, @CreatedAt, @ExpiresAt);
            """, session, transaction, cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);

        Auth.WriteSessionCookie(context, token, session.ExpiresAt);
        loggers.CreateLogger("DndForum.ExternalAuth")
            .LogInformation("Signed in {Login} through {Provider}", user.Login, provider);
        return Results.Redirect(target);
    }

    private static Task<User?> FindLinkedUser(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string provider,
        string providerKey,
        CancellationToken cancellationToken) =>
        connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition("""
            SELECT u.*
            FROM ExternalLogins link
            JOIN Users u ON u.Id = link.UserId
            WHERE link.Provider = @Provider AND link.ProviderKey = @ProviderKey
            LIMIT 1;
            """,
            new { Provider = provider, ProviderKey = providerKey },
            transaction,
            cancellationToken: cancellationToken));

    private static Task<int> Link(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string provider,
        string providerKey,
        int userId,
        CancellationToken cancellationToken) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO ExternalLogins (Provider, ProviderKey, UserId, CreatedAt)
            VALUES (@Provider, @ProviderKey, @UserId, @CreatedAt);
            """,
            new
            {
                Provider = provider,
                ProviderKey = providerKey,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
            },
            transaction,
            cancellationToken: cancellationToken));

    private static async Task<User> CreateUser(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string email,
        string displayName,
        CancellationToken cancellationToken)
    {
        var ownership = await connection.QuerySingleAsync<OwnershipCounts>(new CommandDefinition("""
            SELECT
                COUNT(*) FILTER (WHERE Role = 'admin') AS AdminCount,
                COUNT(*) FILTER (WHERE IsOwner = 1) AS OwnerCount
            FROM Users;
            """, transaction: transaction, cancellationToken: cancellationToken));

        var user = new User
        {
            Login = await UniqueLogin(connection, transaction, email, displayName, cancellationToken),
            PasswordHash = "",
            Email = email,
            Name = displayName.Length is > 0 and <= 40 ? displayName : "Adventurer",
            Role = ownership.AdminCount > 0 ? "user" : "admin",
            IsOwner = ownership.OwnerCount == 0,
        };

        user.Id = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT INTO Users (
                Login, PasswordHash, Email, Name, Role, CharClass, Race, Level,
                Bio, Avatar, CreatedAt, Cursor, ShowWanderers, ShowDragon, IsOwner, IsBanned, BanReason, BannedAt
            )
            VALUES (
                @Login, @PasswordHash, @Email, @Name, @Role, @CharClass, @Race, @Level,
                @Bio, @Avatar, @CreatedAt, @Cursor, @ShowWanderers, @ShowDragon, @IsOwner, @IsBanned, @BanReason, @BannedAt
            );
            SELECT last_insert_rowid();
            """, user, transaction, cancellationToken: cancellationToken));

        return user;
    }

    private static async Task<string> UniqueLogin(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string email,
        string displayName,
        CancellationToken cancellationToken)
    {
        var seed = Sanitize(email.Split('@')[0]);
        if (seed.Length < 3) seed = Sanitize(displayName);
        if (seed.Length < 3) seed = "adventurer";
        if (seed.Length > 24) seed = seed[..24];

        for (var attempt = 0; attempt < 200; attempt++)
        {
            var candidate = attempt == 0 ? seed : $"{seed}{attempt + 1}";
            var taken = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT COUNT(*) FROM Users WHERE Login = @Login;",
                new { Login = candidate },
                transaction,
                cancellationToken: cancellationToken));
            if (taken == 0) return candidate;
        }

        return $"adventurer{Auth.NewToken()[..8].ToLowerInvariant()}";
    }

    private static string Sanitize(string value)
    {
        var builder = new StringBuilder();
        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_')
                builder.Append(character);
        }
        return builder.ToString();
    }

    private static string SafeReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl)) return "/";
        if (!returnUrl.StartsWith('/') || returnUrl.StartsWith("//")) return "/";
        if (returnUrl.Contains('\\') || returnUrl.Contains(':')) return "/";
        return returnUrl;
    }

    private static string WithError(string target, string code) =>
        target.Contains('?')
            ? $"{target}&authError={code}"
            : $"{target}?authError={code}";

    private sealed class OwnershipCounts
    {
        public int AdminCount { get; init; }
        public int OwnerCount { get; init; }
    }
}
