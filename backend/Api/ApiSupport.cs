using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;
using System.Globalization;
using System.Text.Json.Serialization;

namespace DndForum.Api;

internal static class ApiSupport
{
    internal static readonly HashSet<string> CursorKeys =
        ["", "sword", "fireball", "d20", "wand", "arrow", "claw"];

    internal static readonly HashSet<string> CharClasses =
    [
        "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin",
        "Ranger", "Rogue", "Warlock", "Wizard", "Sorcerer", "Dungeon Master",
    ];

    internal static readonly HashSet<string> Races =
    [
        "Human", "Elf", "Dwarf", "Halfling", "Gnome",
        "Half-Orc", "Tiefling", "Dragonborn", "Half-Elf",
    ];

    internal static PublicProfileDto PublicProfile(User user) => new(
        user.Login,
        user.Name,
        user.CharClass,
        user.Race,
        user.Level,
        user.Bio,
        ContentSanitizer.SafeImageReferenceOrEmpty(user.Avatar),
        user.Role,
        user.Role == "admin",
        user.Cursor,
        user.ShowWanderers,
        user.ShowDragon,
        user.IsOwner);

    internal static object ArticleListDto(ArticleRow article, User? viewer) => new
    {
        id = article.Id,
        title = article.Title,
        category = article.Category,
        excerpt = ContentSanitizer.Excerpt(
            ContentSanitizer.ToSafeHtml(article.Content, article.Format)),
        cover = ContentSanitizer.SafeImageReferenceOrEmpty(article.CoverImage),
        author = article.AuthorName,
        authorLogin = article.AuthorLogin,
        charClass = article.AuthorClass,
        date = IsoUtc(article.CreatedAt),
        likes = article.LikesCount,
        comments = article.CommentsCount,
        liked = article.Liked,
        isOwner = viewer is not null
            && (article.AuthorId == viewer.Id || viewer.Role == "admin"),
    };

    internal static object ArticleFullDto(ArticleRow article, User? viewer)
    {
        var mayEdit = viewer is not null
            && (article.AuthorId == viewer.Id || viewer.Role == "admin");

        return new
        {
            id = article.Id,
            title = article.Title,
            category = article.Category,
            html = ContentSanitizer.ToSafeHtml(article.Content, article.Format),
            raw = mayEdit ? article.Content : null,
            format = article.Format,
            cover = ContentSanitizer.SafeImageReferenceOrEmpty(article.CoverImage),
            author = article.AuthorName,
            authorLogin = article.AuthorLogin,
            charClass = article.AuthorClass,
            avatar = ContentSanitizer.SafeImageReferenceOrEmpty(article.AuthorAvatar),
            date = IsoUtc(article.CreatedAt),
            updated = article.UpdatedAt is null ? null : IsoUtc(article.UpdatedAt.Value),
            likes = article.LikesCount,
            comments = article.CommentsCount,
            liked = article.Liked,
            isOwner = mayEdit,
        };
    }

    internal static async Task<User?> RequireAdmin(
        HttpContext context,
        SqliteConnectionFactory connections)
    {
        var user = await Auth.CurrentUser(context, connections);
        return user?.Role == "admin" ? user : null;
    }

    internal static bool IsValidTarget(string? type) => type is "article" or "news";

    internal static string[] SplitList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(
                ';',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    internal static string IsoUtc(DateTime value)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
        return utc.ToString("O", CultureInfo.InvariantCulture);
    }

    internal static IResult BadRequest(
        string error,
        string? field = null,
        string? message = null) => Error(StatusCodes.Status400BadRequest, error, field, message);

    internal static IResult Unauthorized(
        string error = "unauthorized",
        string? message = null) => Error(StatusCodes.Status401Unauthorized, error, message: message);

    internal static IResult Forbidden(
        string error = "forbidden",
        string? message = null) => Error(StatusCodes.Status403Forbidden, error, message: message);

    internal static IResult NotFound(
        string error = "not_found",
        string? message = null) => Error(StatusCodes.Status404NotFound, error, message: message);

    internal static IResult Conflict(
        string error,
        string? field = null,
        string? message = null) => Error(StatusCodes.Status409Conflict, error, field, message);

    internal static IResult Misdirected(
        string error,
        string? message = null) =>
        Error(StatusCodes.Status421MisdirectedRequest, error, message: message);

    internal static IResult TooMany(HttpContext context, int retryAfter)
    {
        context.Response.Headers.RetryAfter = retryAfter.ToString(CultureInfo.InvariantCulture);
        return Error(
            StatusCodes.Status429TooManyRequests,
            "too_many_attempts",
            message: $"Retry after {retryAfter} seconds.");
    }

    internal static IResult ConstraintError(SqliteException exception) =>
        exception.SqliteExtendedErrorCode switch
        {
            787 => BadRequest("invalid_reference"),
            275 or 1299 => BadRequest("invalid_request"),
            1555 or 2067 => Conflict("data_conflict"),
            _ => Conflict("data_conflict"),
        };

    internal static bool IsUniqueConstraint(SqliteException exception) =>
        exception.SqliteExtendedErrorCode is 1555 or 2067;

    internal static bool IsUniqueConstraintOn(
        SqliteException exception,
        string column) =>
        IsUniqueConstraint(exception)
        && exception.Message.Contains(column, StringComparison.OrdinalIgnoreCase);

    internal static IResult? ValidatePagination(
        int? requestedPage,
        int? requestedPageSize,
        int defaultPageSize,
        int maxPageSize,
        out PageRequest pagination)
    {
        var page = requestedPage ?? 1;
        var pageSize = requestedPageSize ?? defaultPageSize;
        pagination = new PageRequest(page, pageSize);

        if (page < 1)
            return BadRequest("page_invalid", "page");
        if (pageSize < 1 || pageSize > maxPageSize)
            return BadRequest("page_size_invalid", "pageSize");

        return null;
    }

    private static IResult Error(
        int statusCode,
        string error,
        string? field = null,
        string? message = null) =>
        Results.Json(new ApiErrorResponse(error, field, message), statusCode: statusCode);
}

internal sealed record ApiErrorResponse(
    string Error,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Field = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Message = null);

internal readonly record struct PageRequest(int Page, int PageSize)
{
    internal long Offset => (long)(Page - 1) * PageSize;
}

internal sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);

internal sealed record CommentsPageDto(
    IReadOnlyList<object> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages,
    int CommentCount);

internal sealed record AdminUsersPageDto(
    IReadOnlyList<AdminUserDto> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages,
    int AdminCount);

internal sealed record PublicProfileDto(
    string Login,
    string Name,
    string CharClass,
    string Race,
    int Level,
    string Bio,
    string Avatar,
    string Role,
    bool IsAdmin,
    string Cursor,
    bool ShowWanderers,
    bool ShowDragon,
    bool IsOwner);

internal sealed record AdminUserDto(
    int Id,
    string Login,
    string Name,
    string Role,
    string Avatar,
    string CharClass,
    int Level,
    string CreatedAt,
    int Articles,
    int Comments,
    bool Banned,
    string BanReason,
    string? BannedAt,
    bool IsOwner);

internal sealed record PublicNewsDto(
    int Id,
    string ImageKey,
    string BgPos,
    string Section,
    string Title,
    string Desc,
    string Html);

internal sealed record PublicNewsDetailsDto(
    int Id,
    string ImageKey,
    string BgPos,
    string Section,
    string Title,
    string Html,
    string Desc,
    string Date,
    int Comments);

internal sealed record AdminNewsDto(
    int Id,
    string TitleUa,
    string TitleEn,
    string DescUa,
    string DescEn,
    string ImageKey,
    string BgPos,
    string Section,
    int SortOrder,
    string PublishedAt);

internal sealed class ArticleRow : Article
{
    public string AuthorName { get; init; } = "Adventurer";
    public string AuthorLogin { get; init; } = "";
    public string AuthorClass { get; init; } = "Wizard";
    public string AuthorAvatar { get; init; } = "";
    public int LikesCount { get; init; }
    public int CommentsCount { get; init; }
    public bool Liked { get; init; }
}

internal sealed class CommentRow : Comment
{
    public string AuthorName { get; init; } = "";
    public string AuthorLogin { get; init; } = "";
    public string AuthorAvatar { get; init; } = "";
    public bool AuthorIgnored { get; init; }
    public string TargetType { get; init; } = "";
    public int TargetId { get; init; }
}

internal sealed class AdminUserRow : User
{
    public int ArticlesCount { get; init; }
    public int CommentsCount { get; init; }
}

internal sealed class ActivityRow
{
    public string Kind { get; init; } = "";
    public string TargetType { get; init; } = "";
    public int TargetId { get; init; }
    public string Title { get; init; } = "";
    public string Excerpt { get; init; } = "";
    public DateTime At { get; init; }
}

internal sealed class DiscussionRow
{
    public int Id { get; init; }
    public string TargetType { get; init; } = "";
    public int TargetId { get; init; }
}

internal sealed class CommentPageCounts
{
    public int Total { get; init; }
    public int CommentCount { get; init; }
}

internal record RegisterInput(
    string? Login,
    string? Password,
    string? Name,
    string? CharClass,
    string? Race,
    int? Level);
internal record LoginInput(string? Login, string? Password);
internal record PasswordInput(string? Current, string? New);
internal record ArticleInput(
    string? Title,
    string? Category,
    string? Content,
    string? Format,
    string? Cover);
internal record ProfileInput(
    string? Login,
    string? Name,
    string? CharClass,
    string? Race,
    int? Level,
    string? Bio,
    string? Avatar,
    string? Cursor,
    bool? ShowWanderers,
    bool? ShowDragon);
internal record CommentInput(string? Body, int? ParentId);
internal record RoleInput(string? Role);
internal record ClanInput(
    string? Name,
    string? Tag,
    string? Description,
    string? Emblem);
internal record ClanRoleInput(string? Role);
internal record BanInput(bool? Banned, string? Reason);
internal record AdminPasswordInput(string? Password);
internal record NewsInput(
    string? TitleUa,
    string? TitleEn,
    string? DescUa,
    string? DescEn,
    string? ImageKey,
    string? BgPos,
    string? Section,
    int? SortOrder);
