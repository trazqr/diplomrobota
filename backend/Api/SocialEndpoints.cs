using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;

namespace DndForum.Api;

public static class SocialEndpoints
{
    private const int MaxClanNameLength = 40;
    private const int MinClanNameLength = 3;
    private const int MaxClanTagLength = 6;
    private const int MinClanTagLength = 2;
    private const int MaxClanDescriptionLength = 500;
    private const int MaxClansPerPage = 50;
    private const int MembersPageSize = 10;
    private const int MaxMembersPageSize = 100;
    private const int MaxMemberSearchLength = 60;
    private const int FriendsPageSize = 10;
    private const int MaxEmblemLength = 300_000;

    public static IEndpointRouteBuilder MapSocialEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/users/{login}", GetPublicProfile);

        routes.MapGet("/api/friends", GetFriends);
        routes.MapGet("/api/friends/list", GetFriendList);

        routes.MapGet("/api/ignores", GetIgnored);
        routes.MapPost("/api/ignores/{login}", AddIgnore);
        routes.MapDelete("/api/ignores/{userId:int}", RemoveIgnore);
        routes.MapPost("/api/friends/{login}", RequestFriend);
        routes.MapPost("/api/friends/{id:int}/accept", AcceptFriend);
        routes.MapDelete("/api/friends/{id:int}", RemoveFriend);

        routes.MapGet("/api/clans", GetClans);
        routes.MapGet("/api/clans/{id:int}", GetClan);
        routes.MapGet("/api/clans/{id:int}/members", GetClanMembers);
        routes.MapPost("/api/clans", CreateClan);
        routes.MapPut("/api/clans/{id:int}", UpdateClan);
        routes.MapPost("/api/clans/{id:int}/join", JoinClan);
        routes.MapPost("/api/clans/{id:int}/members/{userId:int}/approve", ApproveMember);
        routes.MapPut("/api/clans/{id:int}/members/{userId:int}/role", UpdateMemberRole);
        routes.MapDelete("/api/clans/{id:int}/members/{userId:int}", RemoveMember);
        routes.MapPost("/api/clans/{id:int}/transfer/{userId:int}", TransferOwnership);
        routes.MapDelete("/api/clans/{id:int}", DeleteClan);

        return routes;
    }

    private static object FriendDto(FriendRow row) => new
    {
        id = row.Id,
        login = row.Login,
        name = row.Name,
        avatar = ContentSanitizer.SafeImageReferenceOrEmpty(row.Avatar),
        level = row.Level,
        charClass = row.CharClass,
        race = row.Race,
        since = row.RespondedAt ?? row.CreatedAt,
    };

    private static async Task<IResult> GetPublicProfile(
        HttpContext context,
        SqliteConnectionFactory connections,
        string login)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);

        var user = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Login = @Login LIMIT 1;",
            new { Login = login },
            cancellationToken: cancellationToken));

        if (user is null) return ApiSupport.NotFound("user_not_found");

        var stats = await connection.QuerySingleAsync<PublicStatsRow>(new CommandDefinition("""
            SELECT
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
            new { UserId = user.Id },
            cancellationToken: cancellationToken));

        var clan = await connection.QuerySingleOrDefaultAsync<PublicClanRow>(new CommandDefinition("""
            SELECT c.Id, c.Name, c.Tag, c.Emblem, m.Role, m.JoinedAt
            FROM ClanMembers m
            JOIN Clans c ON c.Id = m.ClanId
            WHERE m.UserId = @UserId AND m.Status = 'active'
            LIMIT 1;
            """,
            new { UserId = user.Id },
            cancellationToken: cancellationToken));

        var friendCount = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT COUNT(*) FROM Friendships
            WHERE Status = 'accepted' AND (RequesterId = @UserId OR AddresseeId = @UserId);
            """,
            new { UserId = user.Id },
            cancellationToken: cancellationToken));

        var friendship = "none";
        int? friendshipId = null;
        var isIgnored = me is not null
            && me.Id != user.Id
            && await IgnoreExists(connection, null, me.Id, user.Id, cancellationToken);

        if (me is not null && me.Id != user.Id)
        {
            var link = await connection.QuerySingleOrDefaultAsync<Friendship>(new CommandDefinition("""
                SELECT * FROM Friendships
                WHERE (RequesterId = @A AND AddresseeId = @B)
                   OR (RequesterId = @B AND AddresseeId = @A)
                LIMIT 1;
                """,
                new { A = me.Id, B = user.Id },
                cancellationToken: cancellationToken));

            if (link is not null)
            {
                friendshipId = link.Id;
                friendship = link.Status == "accepted"
                    ? "accepted"
                    : link.RequesterId == me.Id ? "outgoing" : "incoming";
            }
        }

        return Results.Ok(new
        {
            login = user.Login,
            name = user.Name,
            role = user.Role,
            isOwner = user.IsOwner,
            charClass = user.CharClass,
            race = user.Race,
            level = user.Level,
            bio = user.Bio,
            avatar = ContentSanitizer.SafeImageReferenceOrEmpty(user.Avatar),
            createdAt = ApiSupport.IsoUtc(user.CreatedAt),
            isMe = me is not null && me.Id == user.Id,
            userId = user.Id,
            ignored = isIgnored,
            friendship,
            friendshipId,
            friendCount,
            clan = clan is null ? null : new
            {
                id = clan.Id,
                name = clan.Name,
                tag = clan.Tag,
                emblem = ContentSanitizer.SafeImageReferenceOrEmpty(clan.Emblem),
                role = clan.Role,
                since = clan.JoinedAt is null ? null : ApiSupport.IsoUtc(clan.JoinedAt.Value),
            },
            stats = new
            {
                articles = stats.Articles,
                comments = stats.Comments,
                likes = stats.Likes,
            },
        });
    }

    private static async Task<IResult> GetFriends(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
        if (me is null) return ApiSupport.Unauthorized();

        var friends = await FriendPage(
            connection, me.Id, "friends", null, 0, FriendsPageSize, cancellationToken);
        var incoming = await FriendPage(
            connection, me.Id, "incoming", null, 0, FriendsPageSize, cancellationToken);
        var outgoing = await FriendPage(
            connection, me.Id, "outgoing", null, 0, FriendsPageSize, cancellationToken);

        var friendsTotal = await FriendTotal(
            connection, me.Id, "friends", null, cancellationToken);
        var incomingTotal = await FriendTotal(
            connection, me.Id, "incoming", null, cancellationToken);
        var outgoingTotal = await FriendTotal(
            connection, me.Id, "outgoing", null, cancellationToken);

        return Results.Ok(new
        {
            pageSize = FriendsPageSize,
            friends = friends.Select(FriendDto),
            friendsTotal,
            friendsHasMore = friendsTotal > friends.Count,
            incoming = incoming.Select(FriendDto),
            incomingTotal,
            incomingHasMore = incomingTotal > incoming.Count,
            outgoing = outgoing.Select(FriendDto),
            outgoingTotal,
            outgoingHasMore = outgoingTotal > outgoing.Count,
        });
    }

    private static string FriendFilter(string kind) => kind switch
    {
        "incoming" => "f.Status = 'pending' AND f.AddresseeId = @Me",
        "outgoing" => "f.Status = 'pending' AND f.RequesterId = @Me",
        _ => "f.Status = 'accepted'",
    };

    private static async Task<List<FriendRow>> FriendPage(
        SqliteConnection connection,
        int meId,
        string kind,
        string? search,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        var sql = """
            SELECT
                f.Id, f.Status, f.CreatedAt, f.RespondedAt,
                f.RequesterId, f.AddresseeId,
                u.Login, u.Name, u.Avatar, u.Level, u.CharClass, u.Race
            FROM Friendships f
            JOIN Users u ON u.Id = CASE
                WHEN f.RequesterId = @Me THEN f.AddresseeId ELSE f.RequesterId END
            WHERE (f.RequesterId = @Me OR f.AddresseeId = @Me)
              AND {0}
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\')
            ORDER BY COALESCE(f.RespondedAt, f.CreatedAt) DESC
            LIMIT @Take OFFSET @Skip;
            """.Replace("{0}", FriendFilter(kind), StringComparison.Ordinal);

        var rows = await connection.QueryAsync<FriendRow>(new CommandDefinition(
            sql,
            new { Me = meId, Search = search, Take = take, Skip = skip },
            cancellationToken: cancellationToken));
        return rows.ToList();
    }

    private static async Task<long> FriendTotal(
        SqliteConnection connection,
        int meId,
        string kind,
        string? search,
        CancellationToken cancellationToken)
    {
        var sql = """
            SELECT COUNT(*)
            FROM Friendships f
            JOIN Users u ON u.Id = CASE
                WHEN f.RequesterId = @Me THEN f.AddresseeId ELSE f.RequesterId END
            WHERE (f.RequesterId = @Me OR f.AddresseeId = @Me)
              AND {0}
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\')
            ;
            """.Replace("{0}", FriendFilter(kind), StringComparison.Ordinal);

        return await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            sql,
            new { Me = meId, Search = search },
            cancellationToken: cancellationToken));
    }

    private static async Task<IResult> GetFriendList(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? kind,
        string? q,
        int? page,
        int? pageSize)
    {
        var wanted = kind is "incoming" or "outgoing" ? kind : "friends";
        var take = Math.Clamp(pageSize ?? FriendsPageSize, 1, MaxMembersPageSize);
        var current = Math.Max(page ?? 1, 1);
        var search = LikePattern(q);

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
        if (me is null) return ApiSupport.Unauthorized();

        var total = await FriendTotal(connection, me.Id, wanted, search, cancellationToken);
        var skip = (current - 1) * take;
        var rows = await FriendPage(
            connection, me.Id, wanted, search, skip, take, cancellationToken);

        return Results.Ok(new
        {
            total,
            page = current,
            pageSize = take,
            hasMore = skip + rows.Count < total,
            items = rows.Select(FriendDto),
        });
    }

    private static object IgnoredDto(IgnoredRow row) => new
    {
        id = row.UserId,
        userId = row.UserId,
        login = row.Login,
        name = row.Name,
        avatar = ContentSanitizer.SafeImageReferenceOrEmpty(row.Avatar),
        level = row.Level,
        charClass = row.CharClass,
        race = row.Race,
        since = row.CreatedAt,
    };

    private static async Task<bool> IgnoreExists(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        int userId,
        int ignoredId,
        CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM IgnoredUsers WHERE UserId = @UserId AND IgnoredId = @IgnoredId;",
            new { UserId = userId, IgnoredId = ignoredId },
            transaction,
            cancellationToken: cancellationToken)) > 0;

    private static async Task<IResult> GetIgnored(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? q,
        int? page,
        int? pageSize)
    {
        var take = Math.Clamp(pageSize ?? FriendsPageSize, 1, MaxMembersPageSize);
        var current = Math.Max(page ?? 1, 1);
        var search = LikePattern(q);
        var skip = (current - 1) * take;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
        if (me is null) return ApiSupport.Unauthorized();

        var total = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT COUNT(*)
            FROM IgnoredUsers i
            JOIN Users u ON u.Id = i.IgnoredId
            WHERE i.UserId = @Me
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\')
            ;
            """,
            new { Me = me.Id, Search = search },
            cancellationToken: cancellationToken));

        var rows = (await connection.QueryAsync<IgnoredRow>(new CommandDefinition("""
            SELECT
                i.IgnoredId AS UserId, i.CreatedAt,
                u.Login, u.Name, u.Avatar, u.Level, u.CharClass, u.Race
            FROM IgnoredUsers i
            JOIN Users u ON u.Id = i.IgnoredId
            WHERE i.UserId = @Me
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\')
            ORDER BY i.CreatedAt DESC
            LIMIT @Take OFFSET @Skip;
            """,
            new { Me = me.Id, Search = search, Take = take, Skip = skip },
            cancellationToken: cancellationToken))).ToList();

        return Results.Ok(new
        {
            total,
            page = current,
            pageSize = take,
            hasMore = skip + rows.Count < total,
            items = rows.Select(IgnoredDto),
        });
    }

    private static async Task<IResult> AddIgnore(
        HttpContext context,
        SqliteConnectionFactory connections,
        string login)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Login = @Login LIMIT 1;",
            new { Login = login },
            transaction,
            cancellationToken: cancellationToken));

        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("user_not_found");
        }

        if (target.Id == me.Id)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("ignore_self");
        }

        if (await IgnoreExists(connection, transaction, me.Id, target.Id, cancellationToken))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("already_ignored");
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "INSERT INTO IgnoredUsers (UserId, IgnoredId, CreatedAt) VALUES (@Me, @Target, @Now);",
            new { Me = me.Id, Target = target.Id, Now = DateTime.UtcNow },
            transaction,
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM Friendships
            WHERE (RequesterId = @Me AND AddresseeId = @Target)
               OR (RequesterId = @Target AND AddresseeId = @Me);
            """,
            new { Me = me.Id, Target = target.Id },
            transaction,
            cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { ignored = true });
    }

    private static async Task<IResult> RemoveIgnore(
        HttpContext context,
        SqliteConnectionFactory connections,
        int userId)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
        if (me is null) return ApiSupport.Unauthorized();

        var removed = await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM IgnoredUsers WHERE UserId = @Me AND IgnoredId = @Target;",
            new { Me = me.Id, Target = userId },
            cancellationToken: cancellationToken));

        if (removed == 0) return ApiSupport.NotFound("ignore_not_found");
        return Results.NoContent();
    }

    private static async Task<IResult> RequestFriend(
        HttpContext context,
        SqliteConnectionFactory connections,
        string login)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var target = await connection.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            "SELECT * FROM Users WHERE Login = @Login LIMIT 1;",
            new { Login = login },
            transaction,
            cancellationToken: cancellationToken));

        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("user_not_found");
        }

        if (target.Id == me.Id)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("friend_self");
        }

        if (await IgnoreExists(connection, transaction, me.Id, target.Id, cancellationToken))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("you_ignore_them");
        }

        if (await IgnoreExists(connection, transaction, target.Id, me.Id, cancellationToken))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("they_ignore_you");
        }

        var existing = await connection.QuerySingleOrDefaultAsync<Friendship>(
            new CommandDefinition("""
                SELECT * FROM Friendships
                WHERE (RequesterId = @A AND AddresseeId = @B)
                   OR (RequesterId = @B AND AddresseeId = @A)
                LIMIT 1;
                """,
                new { A = me.Id, B = target.Id },
                transaction,
                cancellationToken: cancellationToken));

        if (existing is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict(
                existing.Status == "accepted" ? "already_friends" : "request_exists");
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Friendships (RequesterId, AddresseeId, Status, CreatedAt)
            VALUES (@RequesterId, @AddresseeId, 'pending', @CreatedAt);
            """,
            new { RequesterId = me.Id, AddresseeId = target.Id, CreatedAt = DateTime.UtcNow },
            transaction,
            cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { status = "pending" });
    }

    private static async Task<IResult> AcceptFriend(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var updated = await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Friendships
            SET Status = 'accepted', RespondedAt = @Now
            WHERE Id = @Id AND AddresseeId = @Me AND Status = 'pending';
            """,
            new { Id = id, Me = me.Id, Now = DateTime.UtcNow },
            transaction,
            cancellationToken: cancellationToken));

        if (updated == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("request_not_found");
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { status = "accepted" });
    }

    private static async Task<IResult> RemoveFriend(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var removed = await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM Friendships
            WHERE Id = @Id AND (RequesterId = @Me OR AddresseeId = @Me);
            """,
            new { Id = id, Me = me.Id },
            transaction,
            cancellationToken: cancellationToken));

        if (removed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("request_not_found");
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { removed = true });
    }

    private static async Task<IResult> GetClans(
        HttpContext context,
        SqliteConnectionFactory connections,
        int? page,
        int? pageSize)
    {
        var take = Math.Clamp(pageSize ?? 20, 1, MaxClansPerPage);
        var current = Math.Max(page ?? 1, 1);

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);

        var total = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM Clans;", cancellationToken: cancellationToken));

        var rows = await connection.QueryAsync<ClanRow>(new CommandDefinition("""
            SELECT
                c.Id, c.Name, c.Tag, c.Description, c.Emblem, c.CreatedAt,
                o.Login AS OwnerLogin, o.Name AS OwnerName,
                (SELECT COUNT(*) FROM ClanMembers m
                 WHERE m.ClanId = c.Id AND m.Status = 'active') AS MemberCount
            FROM Clans c
            JOIN Users o ON o.Id = c.OwnerId
            ORDER BY MemberCount DESC, c.CreatedAt ASC
            LIMIT @Take OFFSET @Skip;
            """,
            new { Take = take, Skip = (current - 1) * take },
            cancellationToken: cancellationToken));

        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
        var myClan = me is null
            ? null
            : await MyClan(connection, null, me.Id, cancellationToken);

        return Results.Ok(new
        {
            total,
            page = current,
            pageSize = take,
            myClan = MyClanDto(myClan),
            items = rows.Select(ClanListDto),
        });
    }

    private static object ClanListDto(ClanRow row) => new
    {
        id = row.Id,
        name = row.Name,
        tag = row.Tag,
        description = row.Description,
        emblem = ContentSanitizer.SafeImageReferenceOrEmpty(row.Emblem),
        createdAt = row.CreatedAt,
        memberCount = row.MemberCount,
        owner = new { login = row.OwnerLogin, name = row.OwnerName },
    };

    private static async Task<IResult> GetClan(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);

        var clan = await connection.QuerySingleOrDefaultAsync<ClanRow>(new CommandDefinition("""
            SELECT
                c.Id, c.Name, c.Tag, c.Description, c.Emblem, c.CreatedAt,
                o.Login AS OwnerLogin, o.Name AS OwnerName,
                (SELECT COUNT(*) FROM ClanMembers m
                 WHERE m.ClanId = c.Id AND m.Status = 'active') AS MemberCount
            FROM Clans c
            JOIN Users o ON o.Id = c.OwnerId
            WHERE c.Id = @Id;
            """, new { Id = id }, cancellationToken: cancellationToken));

        if (clan is null) return ApiSupport.NotFound("clan_not_found");

        var me = await Auth.CurrentUser(context, connection, null, cancellationToken);

        var mine = me is null
            ? null
            : await connection.QuerySingleOrDefaultAsync<ClanMember>(new CommandDefinition(
                "SELECT * FROM ClanMembers WHERE ClanId = @Id AND UserId = @Me LIMIT 1;",
                new { Id = id, Me = me.Id },
                cancellationToken: cancellationToken));
        var canManage = mine is { Status: "active", Role: "owner" or "officer" };

        var members = await MemberPage(
            connection, id, "active", null, 0, MembersPageSize, cancellationToken);
        var pending = canManage
            ? await MemberPage(
                connection, id, "pending", null, 0, MembersPageSize, cancellationToken)
            : new List<ClanMemberRow>();
        var pendingCount = canManage
            ? await MemberTotal(connection, id, "pending", null, cancellationToken)
            : 0;
        var isSiteAdmin = me is not null && me.Role == "admin";
        var myClan = me is null
            ? null
            : await MyClan(connection, null, me.Id, cancellationToken);
        var canDisband = isSiteAdmin || mine is { Status: "active", Role: "owner" };
        var canRemoveMembers = isSiteAdmin || canManage;

        return Results.Ok(new
        {
            id = clan.Id,
            name = clan.Name,
            tag = clan.Tag,
            description = clan.Description,
            emblem = ContentSanitizer.SafeImageReferenceOrEmpty(clan.Emblem),
            createdAt = clan.CreatedAt,
            memberCount = clan.MemberCount,
            owner = new { login = clan.OwnerLogin, name = clan.OwnerName },
            myRole = mine?.Status == "active" ? mine.Role : null,
            myStatus = mine?.Status,
            canManage,
            meId = me?.Id,
            myClan = MyClanDto(myClan),
            isSiteAdmin,
            canDisband,
            canRemoveMembers,
            membersPageSize = MembersPageSize,
            membersHasMore = clan.MemberCount > members.Count,
            members = members.Select(MemberDto),
            pendingCount,
            pendingHasMore = pendingCount > pending.Count,
            pending = pending.Select(MemberDto),
        });
    }

    private static string? LikePattern(string? search)
    {
        var trimmed = (search ?? "").Trim();
        if (trimmed.Length == 0) return null;
        if (trimmed.Length > MaxMemberSearchLength) trimmed = trimmed[..MaxMemberSearchLength];
        var escaped = trimmed
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private static async Task<List<ClanMemberRow>> MemberPage(
        SqliteConnection connection,
        int clanId,
        string status,
        string? search,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<ClanMemberRow>(new CommandDefinition("""
            SELECT
                m.UserId, m.Role, m.Status, m.RequestedAt, m.JoinedAt,
                u.Login, u.Name, u.Avatar, u.Level, u.CharClass, u.Race
            FROM ClanMembers m
            JOIN Users u ON u.Id = m.UserId
            WHERE m.ClanId = @Id AND m.Status = @Status
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\')
            ORDER BY
                CASE m.Role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
                COALESCE(m.JoinedAt, m.RequestedAt) ASC
            LIMIT @Take OFFSET @Skip;
            """,
            new { Id = clanId, Status = status, Search = search, Take = take, Skip = skip },
            cancellationToken: cancellationToken));
        return rows.ToList();
    }

    private static async Task<long> MemberTotal(
        SqliteConnection connection,
        int clanId,
        string status,
        string? search,
        CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT COUNT(*)
            FROM ClanMembers m
            JOIN Users u ON u.Id = m.UserId
            WHERE m.ClanId = @Id AND m.Status = @Status
              AND (@Search IS NULL
                   OR u.Name LIKE @Search ESCAPE '\'
                   OR u.Login LIKE @Search ESCAPE '\');
            """,
            new { Id = clanId, Status = status, Search = search },
            cancellationToken: cancellationToken));

    private static async Task<IResult> GetClanMembers(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        string? q,
        string? status,
        int? page,
        int? pageSize)
    {
        var wanted = status == "pending" ? "pending" : "active";
        var take = Math.Clamp(pageSize ?? MembersPageSize, 1, MaxMembersPageSize);
        var current = Math.Max(page ?? 1, 1);
        var search = LikePattern(q);

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);

        var exists = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM Clans WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: cancellationToken));
        if (exists == 0) return ApiSupport.NotFound("clan_not_found");

        if (wanted == "pending")
        {
            var me = await Auth.CurrentUser(context, connection, null, cancellationToken);
            if (me is null) return ApiSupport.Unauthorized();
            var role = await MyRole(connection, null, id, me.Id, cancellationToken);
            if (role is not ("owner" or "officer")) return ApiSupport.Forbidden();
        }

        var total = await MemberTotal(connection, id, wanted, search, cancellationToken);
        var skip = (current - 1) * take;
        var rows = await MemberPage(
            connection, id, wanted, search, skip, take, cancellationToken);

        return Results.Ok(new
        {
            total,
            page = current,
            pageSize = take,
            hasMore = skip + rows.Count < total,
            items = rows.Select(MemberDto),
        });
    }

    private static object MemberDto(ClanMemberRow row) => new
    {
        login = row.Login,
        name = row.Name,
        avatar = ContentSanitizer.SafeImageReferenceOrEmpty(row.Avatar),
        level = row.Level,
        charClass = row.CharClass,
        race = row.Race,
        role = row.Role,
        status = row.Status,
        userId = row.UserId,
        joinedAt = row.JoinedAt ?? row.RequestedAt,
    };

    private static IResult? ValidateClanInput(ClanInput input, bool requireAll)
    {
        if (requireAll || input.Name is not null)
        {
            var name = (input.Name ?? "").Trim();
            if (name.Length is < MinClanNameLength or > MaxClanNameLength)
                return ApiSupport.BadRequest("clan_name_invalid", "name");
        }

        if (requireAll || input.Tag is not null)
        {
            var tag = (input.Tag ?? "").Trim();
            if (tag.Length is < MinClanTagLength or > MaxClanTagLength
                || !tag.All(char.IsLetterOrDigit))
                return ApiSupport.BadRequest("clan_tag_invalid", "tag");
        }

        if (input.Description is not null && input.Description.Length > MaxClanDescriptionLength)
            return ApiSupport.BadRequest("clan_description_too_long", "description");

        if (input.Emblem is not null && input.Emblem.Length > MaxEmblemLength)
            return ApiSupport.BadRequest("emblem_too_large", "emblem");

        if (!ContentSanitizer.IsSafeImageReference(input.Emblem))
            return ApiSupport.BadRequest("emblem_invalid", "emblem");

        return null;
    }

    private static async Task<IResult> CreateClan(
        HttpContext context,
        SqliteConnectionFactory connections,
        ClanInput? input)
    {
        if (input is null) return ApiSupport.BadRequest("invalid_request");
        var invalid = ValidateClanInput(input, requireAll: true);
        if (invalid is not null) return invalid;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var already = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM ClanMembers WHERE UserId = @Me AND Status = 'active';",
            new { Me = me.Id },
            transaction,
            cancellationToken: cancellationToken));

        if (already > 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("already_in_clan");
        }

        var now = DateTime.UtcNow;
        try
        {
            var clanId = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                INSERT INTO Clans (Name, Tag, Description, Emblem, OwnerId, CreatedAt)
                VALUES (@Name, @Tag, @Description, @Emblem, @OwnerId, @CreatedAt);
                SELECT last_insert_rowid();
                """,
                new
                {
                    Name = input.Name!.Trim(),
                    Tag = input.Tag!.Trim(),
                    Description = (input.Description ?? "").Trim(),
                    Emblem = ContentSanitizer.SafeImageReferenceOrEmpty(input.Emblem),
                    OwnerId = me.Id,
                    CreatedAt = now,
                },
                transaction,
                cancellationToken: cancellationToken));

            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO ClanMembers (ClanId, UserId, Role, Status, RequestedAt, JoinedAt)
                VALUES (@ClanId, @UserId, 'owner', 'active', @Now, @Now);
                """,
                new { ClanId = clanId, UserId = me.Id, Now = now },
                transaction,
                cancellationToken: cancellationToken));

            await transaction.CommitAsync(cancellationToken);
            return Results.Ok(new { id = clanId });
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("clan_name_taken");
        }
    }

    private static async Task<IResult> UpdateClan(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        ClanInput? input)
    {
        if (input is null) return ApiSupport.BadRequest("invalid_request");
        var invalid = ValidateClanInput(input, requireAll: false);
        if (invalid is not null) return invalid;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var role = await MyRole(connection, transaction, id, me.Id, cancellationToken);
        if (role is not ("owner" or "officer"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var clan = await connection.QuerySingleOrDefaultAsync<Clan>(new CommandDefinition(
            "SELECT * FROM Clans WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));

        if (clan is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("clan_not_found");
        }

        if (input.Name is not null) clan.Name = input.Name.Trim();
        if (input.Tag is not null) clan.Tag = input.Tag.Trim();
        if (input.Description is not null) clan.Description = input.Description.Trim();
        if (input.Emblem is not null)
            clan.Emblem = ContentSanitizer.SafeImageReferenceOrEmpty(input.Emblem);

        try
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE Clans
                SET Name = @Name, Tag = @Tag, Description = @Description, Emblem = @Emblem
                WHERE Id = @Id;
                """, clan, transaction, cancellationToken: cancellationToken));
            await transaction.CommitAsync(cancellationToken);
            return Results.Ok(new { updated = true });
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("clan_name_taken");
        }
    }

    private static async Task<MyClanRow?> MyClan(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        int userId,
        CancellationToken cancellationToken) =>
        await connection.QuerySingleOrDefaultAsync<MyClanRow>(new CommandDefinition("""
            SELECT c.Id, c.Name, c.Tag
            FROM ClanMembers m
            JOIN Clans c ON c.Id = m.ClanId
            WHERE m.UserId = @UserId AND m.Status = 'active'
            LIMIT 1;
            """,
            new { UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

    private static object? MyClanDto(MyClanRow? row) =>
        row is null ? null : new { id = row.Id, name = row.Name, tag = row.Tag };

    private static async Task<string?> MyRole(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        int clanId,
        int userId,
        CancellationToken cancellationToken) =>
        await connection.ExecuteScalarAsync<string?>(new CommandDefinition("""
            SELECT Role FROM ClanMembers
            WHERE ClanId = @ClanId AND UserId = @UserId AND Status = 'active'
            LIMIT 1;
            """,
            new { ClanId = clanId, UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

    private static async Task<IResult> JoinClan(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var exists = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COUNT(*) FROM Clans WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));

        if (exists == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("clan_not_found");
        }

        var current = await MyClan(connection, transaction, me.Id, cancellationToken);
        if (current is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("already_in_clan");
        }

        try
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO ClanMembers (ClanId, UserId, Role, Status, RequestedAt)
                VALUES (@ClanId, @UserId, 'member', 'pending', @Now);
                """,
                new { ClanId = id, UserId = me.Id, Now = DateTime.UtcNow },
                transaction,
                cancellationToken: cancellationToken));
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("request_exists");
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { status = "pending" });
    }

    private static async Task<IResult> ApproveMember(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        int userId)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var role = await MyRole(connection, transaction, id, me.Id, cancellationToken);
        if (role is not ("owner" or "officer"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        try
        {
            var updated = await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE ClanMembers
                SET Status = 'active', JoinedAt = @Now
                WHERE ClanId = @ClanId AND UserId = @UserId AND Status = 'pending';
                """,
                new { ClanId = id, UserId = userId, Now = DateTime.UtcNow },
                transaction,
                cancellationToken: cancellationToken));

            if (updated == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiSupport.NotFound("request_not_found");
            }
        }
        catch (SqliteException exception) when (ApiSupport.IsUniqueConstraint(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Conflict("applicant_in_clan");
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ClanMembers WHERE UserId = @UserId AND Status = 'pending';",
            new { UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { status = "active" });
    }

    private static async Task<IResult> UpdateMemberRole(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        int userId,
        ClanRoleInput? input)
    {
        var role = (input?.Role ?? "").Trim();
        if (role is not ("officer" or "member"))
            return ApiSupport.BadRequest("clan_role_invalid", "role");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        if (await MyRole(connection, transaction, id, me.Id, cancellationToken) != "owner")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        if (userId == me.Id)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("cannot_change_own_role");
        }

        var updated = await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE ClanMembers SET Role = @Role
            WHERE ClanId = @ClanId AND UserId = @UserId
              AND Status = 'active' AND Role <> 'owner';
            """,
            new { ClanId = id, UserId = userId, Role = role },
            transaction,
            cancellationToken: cancellationToken));

        if (updated == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("member_not_found");
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { role });
    }

    private static async Task<IResult> RemoveMember(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        int userId)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        var myRole = await MyRole(connection, transaction, id, me.Id, cancellationToken);
        var leaving = userId == me.Id;
        var isSiteAdmin = me.Role == "admin";

        if (!leaving && !isSiteAdmin && myRole is not ("owner" or "officer"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var target = await connection.QuerySingleOrDefaultAsync<ClanMember>(
            new CommandDefinition(
                "SELECT * FROM ClanMembers WHERE ClanId = @ClanId AND UserId = @UserId;",
                new { ClanId = id, UserId = userId },
                transaction,
                cancellationToken: cancellationToken));

        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("member_not_found");
        }

        if (!leaving && !isSiteAdmin && myRole == "officer" && target.Role != "member")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        if (target.Role == "owner" && target.Status == "active")
        {
            var others = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
                SELECT COUNT(*) FROM ClanMembers
                WHERE ClanId = @ClanId AND Status = 'active' AND UserId <> @UserId;
                """,
                new { ClanId = id, UserId = userId },
                transaction,
                cancellationToken: cancellationToken));

            if (others > 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiSupport.Conflict("owner_must_transfer");
            }

            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Clans WHERE Id = @Id;",
                new { Id = id },
                transaction,
                cancellationToken: cancellationToken));

            await transaction.CommitAsync(cancellationToken);
            return Results.Ok(new { clanDeleted = true });
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ClanMembers WHERE ClanId = @ClanId AND UserId = @UserId;",
            new { ClanId = id, UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { removed = true });
    }

    private static async Task<IResult> DeleteClan(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        if (me.Role != "admin"
            && await MyRole(connection, transaction, id, me.Id, cancellationToken) != "owner")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        var removed = await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Clans WHERE Id = @Id;",
            new { Id = id },
            transaction,
            cancellationToken: cancellationToken));

        if (removed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("clan_not_found");
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { disbanded = true });
    }

    private static async Task<IResult> TransferOwnership(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        int userId)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        var me = await Auth.CurrentUser(context, connection, transaction, cancellationToken);
        if (me is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Unauthorized();
        }

        if (await MyRole(connection, transaction, id, me.Id, cancellationToken) != "owner")
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.Forbidden();
        }

        if (userId == me.Id)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.BadRequest("already_owner");
        }

        var heir = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT COUNT(*) FROM ClanMembers
            WHERE ClanId = @ClanId AND UserId = @UserId AND Status = 'active';
            """,
            new { ClanId = id, UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

        if (heir == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound("member_not_found");
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE ClanMembers SET Role = 'officer' WHERE ClanId = @ClanId AND UserId = @Me;",
            new { ClanId = id, Me = me.Id },
            transaction,
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE ClanMembers SET Role = 'owner' WHERE ClanId = @ClanId AND UserId = @UserId;",
            new { ClanId = id, UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE Clans SET OwnerId = @UserId WHERE Id = @ClanId;",
            new { ClanId = id, UserId = userId },
            transaction,
            cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { transferred = true });
    }

    private sealed class IgnoredRow
    {
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Login { get; set; } = "";
        public string Name { get; set; } = "";
        public string Avatar { get; set; } = "";
        public int Level { get; set; }
        public string CharClass { get; set; } = "";
        public string Race { get; set; } = "";
    }

    private sealed class MyClanRow
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Tag { get; set; } = "";
    }

    private sealed class PublicStatsRow
    {
        public int Articles { get; set; }
        public int Comments { get; set; }
        public int Likes { get; set; }
    }

    private sealed class PublicClanRow
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Tag { get; set; } = "";
        public string Emblem { get; set; } = "";
        public string Role { get; set; } = "";
        public DateTime? JoinedAt { get; set; }
    }

    private sealed class FriendRow
    {
        public int Id { get; set; }
        public string Status { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
        public int RequesterId { get; set; }
        public int AddresseeId { get; set; }
        public string Login { get; set; } = "";
        public string Name { get; set; } = "";
        public string Avatar { get; set; } = "";
        public int Level { get; set; }
        public string CharClass { get; set; } = "";
        public string Race { get; set; } = "";
    }

    private sealed class ClanRow
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Tag { get; set; } = "";
        public string Description { get; set; } = "";
        public string Emblem { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public string OwnerLogin { get; set; } = "";
        public string OwnerName { get; set; } = "";
        public int MemberCount { get; set; }
    }

    private sealed class ClanMemberRow
    {
        public int UserId { get; set; }
        public string Role { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime RequestedAt { get; set; }
        public DateTime? JoinedAt { get; set; }
        public string Login { get; set; } = "";
        public string Name { get; set; } = "";
        public string Avatar { get; set; } = "";
        public int Level { get; set; }
        public string CharClass { get; set; } = "";
        public string Race { get; set; } = "";
    }
}
