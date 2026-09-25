using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;

namespace DndForum.Api;

public static class CommentAdminEndpoints
{
    private static readonly TimeSpan CommentWindow = TimeSpan.FromMinutes(1);

    private const int MaxReplyDepth = 5;

    private const int MaxStoredCommentDepth = 8;

    public static IEndpointRouteBuilder MapCommentAdminEndpoints(
        this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/{type}/{id:int}/comments", GetComments);
        routes.MapPost("/api/{type}/{id:int}/comments", CreateComment);
        routes.MapDelete("/api/comments/{id:int}", DeleteComment);
        routes.MapPut("/api/comments/{id:int}", UpdateComment);
        routes.MapPost("/api/comments/{id:int}/restore", RestoreComment);
        routes.MapDelete("/api/comments/{id:int}/hard", HardDeleteComment);

        routes.MapGet("/api/admin/users", GetUsers);
        routes.MapPut("/api/admin/users/{id:int}/role", UpdateRole);
        routes.MapPost("/api/admin/users/{id:int}/password", ResetPassword);
        routes.MapDelete("/api/admin/users/{id:int}", DeleteUser);
        routes.MapPut("/api/admin/users/{id:int}/ban", UpdateBan);
        return routes;
    }

    private static async Task<IResult> GetComments(
        HttpContext context,
        SqliteConnectionFactory connections,
        string type,
        int id,
        int? page,
        int? pageSize)
    {
        if (!ApiSupport.IsValidTarget(type))
            return ApiSupport.BadRequest("target_type_invalid", "type");
        if (ApiSupport.ValidatePagination(
                page, pageSize, defaultPageSize: 20, maxPageSize: 50,
                out var pagination) is { } paginationError)
            return paginationError;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var viewer = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        var discussion = await LoadDiscussion(
            connection, type, id, cancellationToken);
        if (discussion is null) return ApiSupport.NotFound();

        var counts = await connection.QuerySingleAsync<CommentPageCounts>(
            new CommandDefinition("""
                SELECT
                    COUNT(*) FILTER (WHERE ParentId IS NULL) AS Total,
                    COUNT(*) FILTER (WHERE IsDeleted = 0) AS CommentCount
                FROM Comments
                WHERE DiscussionId = @DiscussionId;
                """,
                new { DiscussionId = discussion.Id },
                cancellationToken: cancellationToken));

        var items = (await connection.QueryAsync<CommentRow>(new CommandDefinition("""
            WITH RECURSIVE
            root_page AS (
                SELECT Id, CreatedAt
                FROM Comments
                WHERE DiscussionId = @DiscussionId AND ParentId IS NULL
                ORDER BY CreatedAt DESC, Id DESC
                LIMIT @PageSize OFFSET @Offset
            ),
            comment_tree AS (
                SELECT
                    comment.*,
                    root.Id AS RootId,
                    root.CreatedAt AS RootCreatedAt,
                    0 AS Depth
                FROM Comments comment
                JOIN root_page root ON root.Id = comment.Id

                UNION ALL

                SELECT
                    child.*,
                    parent.RootId,
                    parent.RootCreatedAt,
                    parent.Depth + 1
                FROM Comments child
                JOIN comment_tree parent ON child.ParentId = parent.Id
                WHERE parent.Depth < @MaxStoredCommentDepth
            )
            SELECT
                comment.Id,
                comment.DiscussionId,
                comment.ParentId,
                comment.Body,
                comment.AuthorId,
                comment.CreatedAt,
                comment.IsDeleted,
                author.Name AS AuthorName,
                author.Login AS AuthorLogin,
                author.Avatar AS AuthorAvatar,
                EXISTS (
                    SELECT 1 FROM IgnoredUsers
                    WHERE UserId = @Viewer AND IgnoredId = comment.AuthorId
                ) AS AuthorIgnored
            FROM comment_tree comment
            JOIN Users author ON author.Id = comment.AuthorId
            ORDER BY comment.RootCreatedAt DESC, comment.CreatedAt, comment.Id;
            """,
            new
            {
                DiscussionId = discussion.Id,
                pagination.PageSize,
                pagination.Offset,
                MaxStoredCommentDepth,
                Viewer = viewer?.Id ?? 0,
            },
            cancellationToken: cancellationToken))).ToArray();

        var repliedTo = items
            .Where(reply => reply.ParentId is not null && !reply.IsDeleted)
            .Select(reply => reply.ParentId!.Value)
            .ToHashSet();

        var responseItems = items.Select(comment => (object)new
        {
            id = comment.Id,
            parentId = comment.ParentId,
            body = comment.IsDeleted || comment.AuthorIgnored ? "" : comment.Body,
            deleted = comment.IsDeleted,
            ignored = !comment.IsDeleted && comment.AuthorIgnored,
            author = comment.IsDeleted ? "" : comment.AuthorName,
            authorLogin = comment.IsDeleted ? "" : comment.AuthorLogin,
            avatar = comment.IsDeleted
                ? ""
                : ContentSanitizer.SafeImageReferenceOrEmpty(comment.AuthorAvatar),
            date = ApiSupport.IsoUtc(comment.CreatedAt),
            isOwner = !comment.IsDeleted && viewer is not null
                && (comment.AuthorId == viewer.Id || viewer.Role == "admin"),
            canEdit = !comment.IsDeleted && viewer is not null
                && (viewer.Role == "admin"
                    || (comment.AuthorId == viewer.Id && !repliedTo.Contains(comment.Id))),
        }).ToArray();

        return Results.Ok(new CommentsPageDto(
            responseItems,
            pagination.Page,
            pagination.PageSize,
            counts.Total,
            TotalPages(counts.Total, pagination.PageSize),
            counts.CommentCount));
    }

    private static async Task<IResult> CreateComment(
        HttpContext context,
        SqliteConnectionFactory connections,
        string type,
        int id,
        CommentInput? input)
    {
        if (!ApiSupport.IsValidTarget(type))
            return ApiSupport.BadRequest("target_type_invalid", "type");
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var discussion = await LoadDiscussion(
            connection, type, id, cancellationToken);
        if (discussion is null) return ApiSupport.NotFound();

        var body = (input.Body ?? "").Trim();
        if (body.Length is 0 or > 4000)
            return ApiSupport.BadRequest("body", "body");
        if (!RateLimiter.TryHit(
                context, $"comment:{user.Id}", 8, CommentWindow, out var wait))
            return ApiSupport.TooMany(context, wait);

        int? parentId = null;
        if (input.ParentId is int requestedParentId)
        {
            if (requestedParentId <= 0)
                return ApiSupport.BadRequest("parent", "parentId");
            var parent = await connection.QuerySingleOrDefaultAsync<Comment>(
                new CommandDefinition(
                    "SELECT Id, DiscussionId, ParentId, IsDeleted FROM Comments WHERE Id = @Id;",
                    new { Id = requestedParentId },
                    cancellationToken: cancellationToken));
            if (parent is null || parent.DiscussionId != discussion.Id || parent.IsDeleted)
                return ApiSupport.BadRequest("parent", "parentId");

            var parentDepth = await connection.ExecuteScalarAsync<int>(
                new CommandDefinition("""
                    WITH RECURSIVE ancestors(Id, ParentId, Depth) AS (
                        SELECT Id, ParentId, 0 FROM Comments WHERE Id = @Id
                        UNION ALL
                        SELECT ancestor.Id, ancestor.ParentId, child.Depth + 1
                        FROM Comments ancestor
                        JOIN ancestors child ON ancestor.Id = child.ParentId
                        WHERE child.Depth < @MaxStoredCommentDepth
                    )
                    SELECT MAX(Depth) FROM ancestors;
                    """,
                    new { Id = requestedParentId, MaxStoredCommentDepth },
                    cancellationToken: cancellationToken));

            if (parentDepth + 1 > MaxReplyDepth)
                return ApiSupport.BadRequest("comment_depth", "parentId");

            parentId = requestedParentId;
        }

        var comment = new Comment
        {
            DiscussionId = discussion.Id,
            ParentId = parentId,
            Body = body,
            AuthorId = user.Id,
        };
        comment.Id = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT INTO Comments (
                DiscussionId, ParentId, Body, AuthorId, CreatedAt, IsDeleted
            )
            VALUES (
                @DiscussionId, @ParentId, @Body, @AuthorId, @CreatedAt, @IsDeleted
            );
            SELECT last_insert_rowid();
            """, comment, cancellationToken: cancellationToken));

        return Results.Created($"/api/{type}/{id}/comments/{comment.Id}", new
        {
            id = comment.Id,
            parentId = comment.ParentId,
            body = comment.Body,
            deleted = false,
            ignored = false,
            author = user.Name,
            authorLogin = user.Login,
            avatar = ContentSanitizer.SafeImageReferenceOrEmpty(user.Avatar),
            date = ApiSupport.IsoUtc(comment.CreatedAt),
            isOwner = true,
            canEdit = true,
        });
    }

    private static async Task<IResult> DeleteComment(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var comment = await LoadComment(connection, id, cancellationToken);
        if (comment is null) return ApiSupport.NotFound();
        if (comment.AuthorId != user.Id && user.Role != "admin")
            return ApiSupport.Forbidden();

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE Comments SET IsDeleted = 1 WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: cancellationToken));
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateComment(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        CommentInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var comment = await LoadComment(connection, id, cancellationToken);
        if (comment is null || comment.IsDeleted) return ApiSupport.NotFound();
        if (comment.AuthorId != user.Id && user.Role != "admin")
            return ApiSupport.Forbidden();

        if (user.Role != "admin"
            && await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
                SELECT COUNT(*)
                FROM Comments
                WHERE ParentId = @Id AND IsDeleted = 0;
                """, new { Id = id }, cancellationToken: cancellationToken)) > 0)
        {
            return ApiSupport.Forbidden("has-replies");
        }

        var body = (input.Body ?? "").Trim();
        if (body.Length is 0 or > 4000)
            return ApiSupport.BadRequest("body", "body");

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE Comments SET Body = @Body WHERE Id = @Id;",
            new { Id = id, Body = body },
            cancellationToken: cancellationToken));
        return Results.Ok(new { id, body });
    }

    private static async Task<IResult> RestoreComment(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var admin = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (admin?.Role != "admin")
            return ApiSupport.Forbidden();

        var affected = await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Comments SET IsDeleted = 0
            WHERE Id = @Id AND IsDeleted = 1;
            """, new { Id = id }, cancellationToken: cancellationToken));
        return affected == 0 ? ApiSupport.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> HardDeleteComment(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var admin = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (admin?.Role != "admin")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        if (await connection.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT COUNT(*) FROM Comments WHERE Id = @Id;",
                new { Id = id },
                transaction,
                cancellationToken: cancellationToken)) == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }

        var exceedsDepth = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            WITH RECURSIVE doomed(Id, Depth) AS (
                SELECT Id, 0 FROM Comments WHERE Id = @Id
                UNION ALL
                SELECT child.Id, parent.Depth + 1
                FROM Comments child
                JOIN doomed parent ON child.ParentId = parent.Id
                WHERE parent.Depth < @MaxStoredCommentDepth
            )
            SELECT EXISTS (
                SELECT 1
                FROM Comments child
                JOIN doomed parent ON child.ParentId = parent.Id
                WHERE parent.Depth = @MaxStoredCommentDepth
            );
            """,
            new { Id = id, MaxStoredCommentDepth },
            transaction,
            cancellationToken: cancellationToken));
        if (exceedsDepth != 0)
            return await RollbackConflict(
                transaction, cancellationToken, "comment_tree_too_deep");

        await connection.ExecuteAsync(new CommandDefinition("""
            WITH RECURSIVE doomed(Id, Depth) AS (
                SELECT Id, 0 FROM Comments WHERE Id = @Id
                UNION ALL
                SELECT child.Id, parent.Depth + 1
                FROM Comments child
                JOIN doomed parent ON child.ParentId = parent.Id
                WHERE parent.Depth < @MaxStoredCommentDepth
            )
            DELETE FROM Comments WHERE Id IN (SELECT Id FROM doomed);
            """,
            new { Id = id, MaxStoredCommentDepth },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> GetUsers(
        HttpContext context,
        SqliteConnectionFactory connections,
        int? page,
        int? pageSize)
    {
        if (ApiSupport.ValidatePagination(
                page, pageSize, defaultPageSize: 25, maxPageSize: 100,
                out var pagination) is { } paginationError)
            return paginationError;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var admin = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (admin?.Role != "admin")
            return ApiSupport.Forbidden();

        var totals = await connection.QuerySingleAsync<(int Total, int AdminCount)>(
            new CommandDefinition("""
                SELECT
                    COUNT(*) AS Total,
                    COUNT(*) FILTER (WHERE Role = 'admin') AS AdminCount
                FROM Users;
                """,
                cancellationToken: cancellationToken));
        var users = await connection.QueryAsync<AdminUserRow>(new CommandDefinition("""
            SELECT
                user.*,
                (
                    SELECT COUNT(*) FROM Articles article
                    WHERE article.AuthorId = user.Id
                ) AS ArticlesCount,
                (
                    SELECT COUNT(*) FROM Comments comment
                    WHERE comment.AuthorId = user.Id AND comment.IsDeleted = 0
                ) AS CommentsCount
            FROM Users user
            ORDER BY user.Id
            LIMIT @PageSize OFFSET @Offset;
            """,
            new { pagination.PageSize, pagination.Offset },
            cancellationToken: cancellationToken));

        var items = users.Select(user => new AdminUserDto(
            user.Id,
            user.Login,
            user.Name,
            user.Role,
            ContentSanitizer.SafeImageReferenceOrEmpty(user.Avatar),
            user.CharClass,
            user.Level,
            ApiSupport.IsoUtc(user.CreatedAt),
            user.ArticlesCount,
            user.CommentsCount,
            user.IsBanned,
            user.BanReason,
            user.BannedAt is null ? null : ApiSupport.IsoUtc(user.BannedAt.Value),
            user.IsOwner)).ToArray();

        return Results.Ok(new AdminUsersPageDto(
            items,
            pagination.Page,
            pagination.PageSize,
            totals.Total,
            TotalPages(totals.Total, pagination.PageSize),
            totals.AdminCount));
    }

    private static async Task<IResult> UpdateRole(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        RoleInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");
        var role = (input.Role ?? "").Trim();
        if (role is not ("user" or "admin"))
            return ApiSupport.BadRequest("role_invalid", "role");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (me?.Role != "admin")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }

        if (target.IsOwner && role != "admin")
            return await RollbackConflict(transaction, cancellationToken, "cannot_demote_owner");
        if (target.Id == me.Id && role != "admin")
            return await RollbackConflict(transaction, cancellationToken, "cannot_demote_self");

        if (target.Role == "admin" && role == "user" && !me.IsOwner)
            return await RollbackConflict(transaction, cancellationToken, "cannot_demote_admin");

        if (target.Role == "admin" && role == "user"
            && await connection.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT COUNT(*) FROM Users WHERE Role = 'admin';",
                transaction: transaction,
                cancellationToken: cancellationToken)) <= 1)
        {
            return await RollbackConflict(transaction, cancellationToken, "last_admin");
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE Users SET Role = @Role WHERE Id = @Id;",
            new { Id = id, Role = role },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { id, role });
    }

    private static async Task<IResult> ResetPassword(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        AdminPasswordInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (me?.Role != "admin")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }
        if (id == me.Id)
            return await RollbackConflict(transaction, cancellationToken, "use_own_profile");

        if (target.IsOwner && !me.IsOwner)
            return await RollbackConflict(transaction, cancellationToken, "cannot_reset_owner");
        if (target.Role == "admin" && !me.IsOwner)
            return await RollbackConflict(transaction, cancellationToken, "cannot_reset_admin");

        var password = (input.Password ?? "").Trim();
        var generated = password.Length == 0;
        if (generated)
            password = Auth.NewToken()[..12];
        else if (!Auth.IsValidPassword(password))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("password_too_short", "password");
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Users SET PasswordHash = @PasswordHash WHERE Id = @Id;
            DELETE FROM Sessions WHERE UserId = @Id;
            """,
            new { Id = id, PasswordHash = Auth.HashPassword(password) },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { id, password = generated ? password : null });
    }

    private static async Task<IResult> DeleteUser(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (me?.Role != "admin")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }

        if (target.IsOwner)
            return await RollbackConflict(transaction, cancellationToken, "cannot_delete_owner");
        if (target.Id == me.Id)
            return await RollbackConflict(transaction, cancellationToken, "cannot_delete_self");
        if (target.Role == "admin")
            return await RollbackConflict(transaction, cancellationToken, "cannot_delete_admin");

        var removed = await connection.QuerySingleAsync<RemovedContent>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Articles WHERE AuthorId = @Id) AS Articles,
                (SELECT COUNT(*) FROM Comments WHERE AuthorId = @Id) AS Comments;
            """, new { Id = id }, transaction, cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Users WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new
        {
            id,
            articles = removed.Articles,
            comments = removed.Comments,
        });
    }

    private static async Task<IResult> UpdateBan(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        BanInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");
        if (input.Banned is null)
            return ApiSupport.BadRequest("banned_required", "banned");
        if (input.Reason is not null && input.Reason.Trim().Length > 300)
            return ApiSupport.BadRequest("ban_reason_too_long", "reason");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(
            context, connection, transaction, cancellationToken);
        if (me?.Role != "admin")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }

        var banned = input.Banned.Value;
        if (banned)
        {
            if (target.Id == me.Id)
                return await RollbackConflict(transaction, cancellationToken, "cannot_ban_self");
            if (target.IsOwner)
                return await RollbackConflict(transaction, cancellationToken, "cannot_ban_owner");
            if (target.Role == "admin")
                return await RollbackConflict(transaction, cancellationToken, "cannot_ban_admin");

            var reason = (input.Reason ?? "").Trim();
            target.IsBanned = true;
            target.BanReason = reason;
            target.BannedAt = DateTime.UtcNow;

            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Sessions WHERE UserId = @Id;",
                new { target.Id },
                transaction,
                cancellationToken: cancellationToken));
        }
        else
        {
            target.IsBanned = false;
            target.BanReason = "";
            target.BannedAt = null;
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Users
            SET IsBanned = @IsBanned,
                BanReason = @BanReason,
                BannedAt = @BannedAt
            WHERE Id = @Id;
            """, target, transaction, cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);

        return Results.Ok(new
        {
            id = target.Id,
            banned = target.IsBanned,
            banReason = target.BanReason,
            bannedAt = target.BannedAt is null ? null : ApiSupport.IsoUtc(target.BannedAt.Value),
        });
    }

    private static Task<DiscussionRow?> LoadDiscussion(
        SqliteConnection connection,
        string type,
        int targetId,
        CancellationToken cancellationToken) =>
        connection.QuerySingleOrDefaultAsync<DiscussionRow>(new CommandDefinition("""
            SELECT
                Id,
                CASE WHEN ArticleId IS NOT NULL THEN 'article' ELSE 'news' END AS TargetType,
                COALESCE(ArticleId, NewsId) AS TargetId
            FROM Discussions
            WHERE (@Type = 'article' AND ArticleId = @TargetId)
                OR (@Type = 'news' AND NewsId = @TargetId)
            LIMIT 1;
            """,
            new { Type = type, TargetId = targetId },
            cancellationToken: cancellationToken));

    private static Task<Comment?> LoadComment(
        SqliteConnection connection,
        int id,
        CancellationToken cancellationToken) =>
        connection.QuerySingleOrDefaultAsync<Comment>(new CommandDefinition(
            "SELECT * FROM Comments WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: cancellationToken));

    private static async Task<IResult> RollbackConflict(
        SqliteTransaction transaction,
        CancellationToken cancellationToken,
        string error)
    {
        await transaction.RollbackAsync(cancellationToken);
        return ApiSupport.Conflict(error);
    }

    private static int TotalPages(int total, int pageSize) =>
        total == 0 ? 0 : (total + pageSize - 1) / pageSize;

    private sealed class RemovedContent
    {
        public int Articles { get; init; }
        public int Comments { get; init; }
    }
}
