using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;

namespace DndForum.Api;

public static class AuthProfileEndpoints
{
    private static readonly TimeSpan RegisterWindow = TimeSpan.FromHours(1);
    private static readonly TimeSpan LoginWindow = TimeSpan.FromMinutes(15);

    public static IEndpointRouteBuilder MapAuthProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/api/auth/register", Register);
        routes.MapPost("/api/auth/login", Login);
        routes.MapPost("/api/auth/logout", Logout);
        routes.MapGet("/api/auth/me", CurrentUser);
        routes.MapPost("/api/auth/password", ChangePassword);

        routes.MapGet("/api/profile", GetProfile);
        routes.MapPut("/api/profile", UpdateProfile);
        routes.MapGet("/api/profile/stats", GetProfileStats);
        routes.MapGet("/api/profile/activity", GetProfileActivity);
        return routes;
    }

    private static async Task<IResult> Register(
        HttpContext context,
        SqliteConnectionFactory connections,
        RegisterInput? input)
    {
        if (!RateLimiter.TryHit(context, "register", 5, RegisterWindow, out var wait))
            return ApiSupport.TooMany(context, wait);
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");
        if (!Auth.IsValidLogin(input.Login))
            return ApiSupport.BadRequest("login_invalid", "login");
        if (!Auth.IsValidPassword(input.Password))
            return ApiSupport.BadRequest("password_too_short", "password");
        if (input.Name is not null && input.Name.Trim().Length > 40)
            return ApiSupport.BadRequest("name_too_long", "name");
        if (input.CharClass is not null && input.CharClass.Trim().Length > 40)
            return ApiSupport.BadRequest("char_class_too_long", "charClass");
        if (input.CharClass is not null && !ApiSupport.CharClasses.Contains(input.CharClass.Trim()))
            return ApiSupport.BadRequest("char_class_invalid", "charClass");
        if (input.Race is not null && input.Race.Trim().Length > 40)
            return ApiSupport.BadRequest("race_too_long", "race");
        if (input.Race is not null && !ApiSupport.Races.Contains(input.Race.Trim()))
            return ApiSupport.BadRequest("race_invalid", "race");
        if (input.Level is not null && input.Level is not (>= 1 and <= 20))
            return ApiSupport.BadRequest("level_invalid", "level");

        var login = input.Login!.Trim();
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);

        try
        {
            if (await connection.ExecuteScalarAsync<long>(new CommandDefinition(
                    "SELECT COUNT(*) FROM Users WHERE Login = @Login;",
                    new { Login = login },
                    transaction,
                    cancellationToken: cancellationToken)) > 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiSupport.Conflict("login_taken", "login");
            }

            var ownership = await connection.QuerySingleAsync<OwnershipCounts>(new CommandDefinition("""
                SELECT
                    COUNT(*) FILTER (WHERE Role = 'admin') AS AdminCount,
                    COUNT(*) FILTER (WHERE IsOwner = 1) AS OwnerCount
                FROM Users;
                """,
                transaction: transaction,
                cancellationToken: cancellationToken));

            var user = new User
            {
                Login = login,
                PasswordHash = Auth.HashPassword(input.Password!),
                Name = string.IsNullOrWhiteSpace(input.Name) ? login : input.Name.Trim(),
                CharClass = ApiSupport.CharClasses.Contains(input.CharClass?.Trim() ?? "")
                    ? input.CharClass!.Trim() : "Wizard",
                Race = ApiSupport.Races.Contains(input.Race?.Trim() ?? "")
                    ? input.Race!.Trim() : "Elf",
                Level = input.Level is >= 1 and <= 20 ? input.Level.Value : 1,
                Role = ownership.AdminCount > 0 ? "user" : "admin",
                IsOwner = ownership.OwnerCount == 0,
            };

            user.Id = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                INSERT INTO Users (
                    Login, PasswordHash, Name, Role, CharClass, Race, Level,
                    Bio, Avatar, CreatedAt, Cursor, ShowWanderers, ShowDragon, IsOwner, IsBanned, BanReason, BannedAt
                )
                VALUES (
                    @Login, @PasswordHash, @Name, @Role, @CharClass, @Race, @Level,
                    @Bio, @Avatar, @CreatedAt, @Cursor, @ShowWanderers, @ShowDragon, @IsOwner, @IsBanned, @BanReason, @BannedAt
                );
                SELECT last_insert_rowid();
                """, user, transaction, cancellationToken: cancellationToken));

            var (token, session) = Auth.NewSession(user.Id);
            await InsertSession(connection, transaction, session, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            Auth.WriteSessionCookie(context, token, session.ExpiresAt);

            return Results.Ok(new
            {
                profile = ApiSupport.PublicProfile(user),
            });
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            if (ApiSupport.IsUniqueConstraintOn(exception, "Users.IsOwner"))
                return ApiSupport.Conflict("owner_exists");
            return ApiSupport.Conflict("login_taken", "login");
        }
    }

    private static async Task<IResult> Login(
        HttpContext context,
        SqliteConnectionFactory connections,
        LoginInput? input)
    {
        if (!RateLimiter.TryHit(context, "login", 10, LoginWindow, out var wait))
            return ApiSupport.TooMany(context, wait);

        if (input is null)
            return ApiSupport.Unauthorized("invalid_credentials");

        var loginName = (input.Login ?? "").Trim();
        var accountKey = $"login-account:{loginName.ToLowerInvariant()}";
        if (!RateLimiter.TryHitKey(accountKey, 10, LoginWindow, out var accountWait))
            return ApiSupport.TooMany(context, accountWait);

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Login = @Login LIMIT 1;",
            new { Login = loginName },
            cancellationToken: cancellationToken));

        if (user is null)
        {
            Auth.BurnPasswordAttempt(input.Password ?? "");
            return ApiSupport.Unauthorized("invalid_credentials");
        }
        if (!Auth.VerifyPassword(input.Password ?? "", user.PasswordHash))
            return ApiSupport.Unauthorized("invalid_credentials");
        if (user.IsBanned)
            return ApiSupport.Forbidden("account_banned", user.BanReason);

        RateLimiter.Reset(context, "login");
        RateLimiter.ResetKey(accountKey);
        var (token, session) = Auth.NewSession(user.Id);
        await InsertSession(connection, null, session, cancellationToken);
        Auth.WriteSessionCookie(context, token, session.ExpiresAt);

        return Results.Ok(new
        {
            profile = ApiSupport.PublicProfile(user),
        });
    }

    private static async Task<IResult> Logout(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var token = Auth.SessionToken(context);

        if (token is not null)
        {
            var tokenHash = Auth.HashSessionToken(token);
            await using var connection = await connections.OpenAsync(context.RequestAborted);
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Sessions WHERE TokenHash = @TokenHash;",
                new { TokenHash = tokenHash },
                cancellationToken: context.RequestAborted));
        }

        Auth.DeleteSessionCookie(context);
        return Results.NoContent();
    }

    private static async Task<IResult> CurrentUser(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var user = await Auth.CurrentUser(context, connections);
        return user is null
            ? ApiSupport.Unauthorized()
            : Results.Ok(ApiSupport.PublicProfile(user));
    }

    private static async Task<IResult> ChangePassword(
        HttpContext context,
        SqliteConnectionFactory connections,
        PasswordInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var user = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);

        if (user is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var changeKey = $"password-change:{user.Id}";
        if (!RateLimiter.TryHitKey(changeKey, 5, LoginWindow, out var changeWait))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.TooMany(context, changeWait);
        }

        if (!Auth.VerifyPassword(input.Current ?? "", user.PasswordHash))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized("invalid_credentials");
        }
        if (!Auth.IsValidPassword(input.New))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("password_too_short", "new");
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Users SET PasswordHash = @PasswordHash WHERE Id = @UserId;
            DELETE FROM Sessions WHERE UserId = @UserId;
            """,
            new { PasswordHash = Auth.HashPassword(input.New!), UserId = user.Id },
            transaction,
            cancellationToken: cancellationToken));

        var (token, session) = Auth.NewSession(user.Id);
        await InsertSession(connection, transaction, session, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        RateLimiter.ResetKey(changeKey);
        Auth.WriteSessionCookie(context, token, session.ExpiresAt);
        return Results.NoContent();
    }

    private static async Task<IResult> GetProfile(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var counts = await connection.QuerySingleAsync<ProfileCounts>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Articles WHERE AuthorId = @UserId) AS Posts,
                (
                    SELECT COUNT(*)
                    FROM ArticleLikes likes
                    JOIN Articles article ON article.Id = likes.ArticleId
                    WHERE article.AuthorId = @UserId
                ) AS Reputation;
            """, new { UserId = user.Id }, cancellationToken: cancellationToken));

        return Results.Ok(new
        {
            login = user.Login,
            name = user.Name,
            charClass = user.CharClass,
            race = user.Race,
            level = user.Level,
            bio = user.Bio,
            avatar = ContentSanitizer.SafeImageReferenceOrEmpty(user.Avatar),
            posts = counts.Posts,
            reputation = counts.Reputation,
        });
    }

    private static async Task<IResult> UpdateProfile(
        HttpContext context,
        SqliteConnectionFactory connections,
        ProfileInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");
        if (input.Name is not null && input.Name.Trim().Length is 0 or > 40)
            return ApiSupport.BadRequest("name_invalid", "name");
        if (input.CharClass is not null && input.CharClass.Trim().Length > 40)
            return ApiSupport.BadRequest("char_class_too_long", "charClass");
        if (input.CharClass is not null && !ApiSupport.CharClasses.Contains(input.CharClass.Trim()))
            return ApiSupport.BadRequest("char_class_invalid", "charClass");
        if (input.Race is not null && input.Race.Trim().Length > 40)
            return ApiSupport.BadRequest("race_too_long", "race");
        if (input.Race is not null && !ApiSupport.Races.Contains(input.Race.Trim()))
            return ApiSupport.BadRequest("race_invalid", "race");
        if (input.Level is not null && input.Level is not (>= 1 and <= 20))
            return ApiSupport.BadRequest("level_invalid", "level");
        if (input.Bio is not null && input.Bio.Length > 2000)
            return ApiSupport.BadRequest("bio_too_long", "bio");
        if (input.Avatar is not null && input.Avatar.Length > 300_000)
            return ApiSupport.BadRequest("avatar_too_large", "avatar");
        if (!ContentSanitizer.IsSafeImageReference(input.Avatar))
            return ApiSupport.BadRequest("avatar_invalid", "avatar");
        if (input.Cursor is not null && !ApiSupport.CursorKeys.Contains(input.Cursor))
            return ApiSupport.BadRequest("cursor_invalid", "cursor");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var user = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (user is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var newLogin = (input.Login ?? "").Trim();
        if (newLogin.Length > 0
            && !string.Equals(newLogin, user.Login, StringComparison.OrdinalIgnoreCase))
        {
            if (!Auth.IsValidLogin(newLogin))
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiSupport.BadRequest("login_invalid", "login");
            }

            if (await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
                    SELECT COUNT(*) FROM Users WHERE Id <> @Id AND Login = @Login;
                    """,
                    new { user.Id, Login = newLogin },
                    transaction,
                    cancellationToken: cancellationToken)) > 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiSupport.Conflict("login_taken", "login");
            }

            user.Login = newLogin;
        }

        if (!string.IsNullOrWhiteSpace(input.Name))
        {
            user.Name = input.Name.Trim();
        }

        if (input.CharClass is not null) user.CharClass = input.CharClass.Trim();
        if (input.Race is not null) user.Race = input.Race.Trim();
        if (input.Level is >= 1 and <= 20) user.Level = input.Level.Value;
        if (input.Bio is not null) user.Bio = input.Bio;

        if (input.Avatar is not null)
        {
            user.Avatar = input.Avatar.Trim();
        }

        if (input.Cursor is not null)
            user.Cursor = input.Cursor;

        if (input.ShowWanderers is not null)
            user.ShowWanderers = input.ShowWanderers.Value;

        if (input.ShowDragon is not null)
            user.ShowDragon = input.ShowDragon.Value;

        try
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE Users
                SET Login = @Login,
                    Name = @Name,
                    CharClass = @CharClass,
                    Race = @Race,
                    Level = @Level,
                    Bio = @Bio,
                    Avatar = @Avatar,
                    Cursor = @Cursor,
                    ShowWanderers = @ShowWanderers,
                    ShowDragon = @ShowDragon
                WHERE Id = @Id;
                """, user, transaction, cancellationToken: cancellationToken));
            await transaction.CommitAsync(cancellationToken);
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("login_taken", "login");
        }

        return Results.Ok(ApiSupport.PublicProfile(user));
    }

    private static async Task<IResult> GetProfileStats(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var stats = await connection.QuerySingleAsync<ProfileStats>(new CommandDefinition("""
            SELECT
                @Level AS Level,
                (SELECT COUNT(*) FROM Articles WHERE AuthorId = @UserId) AS Articles,
                (
                    SELECT COUNT(*) FROM Comments
                    WHERE AuthorId = @UserId AND IsDeleted = 0
                ) AS Comments,
                (
                    SELECT COUNT(*)
                    FROM ArticleLikes likes
                    JOIN Articles article ON article.Id = likes.ArticleId
                    WHERE article.AuthorId = @UserId
                ) AS Likes;
            """,
            new { Level = user.Level, UserId = user.Id },
            cancellationToken: cancellationToken));

        return Results.Ok(new
        {
            level = stats.Level,
            articles = stats.Articles,
            comments = stats.Comments,
            likes = stats.Likes,
        });
    }

    private static async Task<IResult> GetProfileActivity(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var rows = await connection.QueryAsync<ActivityRow>(new CommandDefinition("""
            SELECT Kind, TargetType, TargetId, Title, Excerpt, At
            FROM (
                SELECT
                    'article' AS Kind,
                    'article' AS TargetType,
                    article.Id AS TargetId,
                    article.Title AS Title,
                    '' AS Excerpt,
                    article.CreatedAt AS At
                FROM Articles article
                WHERE article.AuthorId = @UserId

                UNION ALL

                SELECT
                    'comment' AS Kind,
                    CASE WHEN discussion.ArticleId IS NOT NULL THEN 'article' ELSE 'news' END,
                    COALESCE(discussion.ArticleId, discussion.NewsId),
                    COALESCE(article.Title, news.TitleUa, ''),
                    CASE
                        WHEN length(comment.Body) > 120
                            THEN substr(comment.Body, 1, 120) || '…'
                        ELSE comment.Body
                    END,
                    comment.CreatedAt
                FROM Comments comment
                JOIN Discussions discussion ON discussion.Id = comment.DiscussionId
                LEFT JOIN Articles article ON article.Id = discussion.ArticleId
                LEFT JOIN News news ON news.Id = discussion.NewsId
                WHERE comment.AuthorId = @UserId AND comment.IsDeleted = 0
            )
            ORDER BY At DESC
            LIMIT 6;
            """, new { UserId = user.Id }, cancellationToken: cancellationToken));

        return Results.Ok(rows.Select(row => new
        {
            kind = row.Kind,
            targetType = row.TargetType,
            targetId = row.TargetId,
            title = row.Title,
            excerpt = row.Excerpt,
            date = ApiSupport.IsoUtc(row.At),
        }));
    }

    private static Task<int> InsertSession(
        SqliteConnection connection,
        System.Data.IDbTransaction? transaction,
        Session session,
        CancellationToken cancellationToken) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Sessions (TokenHash, UserId, CreatedAt, ExpiresAt)
            VALUES (@TokenHash, @UserId, @CreatedAt, @ExpiresAt);
            """, session, transaction, cancellationToken: cancellationToken));

    private sealed class ProfileCounts
    {
        public int Posts { get; init; }
        public int Reputation { get; init; }
    }

    private sealed class OwnershipCounts
    {
        public int AdminCount { get; init; }
        public int OwnerCount { get; init; }
    }

    private sealed class ProfileStats
    {
        public int Level { get; init; }
        public int Articles { get; init; }
        public int Comments { get; init; }
        public int Likes { get; init; }
    }
}
