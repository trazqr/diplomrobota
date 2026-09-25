using Dapper;
using DndForum.Data;
using DndForum.Models;
using Microsoft.Data.Sqlite;

namespace DndForum.Api;

public static class ContentEndpoints
{
    private static readonly string[] ArticleCategories =
        ["lore", "rules", "campaigns", "characters", "equipment"];

    private static readonly TimeSpan ArticleWindow = TimeSpan.FromHours(1);
    private const int ArticleLimit = 10;

    private const string ArticleSelect = """
        SELECT
            article.Id,
            article.Title,
            article.Category,
            article.Content,
            article.Format,
            article.CoverImage,
            article.AuthorId,
            article.CreatedAt,
            article.UpdatedAt,
            author.Name AS AuthorName,
            author.Login AS AuthorLogin,
            author.CharClass AS AuthorClass,
            author.Avatar AS AuthorAvatar,
            (
                SELECT COUNT(*)
                FROM ArticleLikes articleLike
                WHERE articleLike.ArticleId = article.Id
            ) AS LikesCount,
            (
                SELECT COUNT(*)
                FROM Comments comment
                JOIN Discussions discussion ON discussion.Id = comment.DiscussionId
                WHERE discussion.ArticleId = article.Id AND comment.IsDeleted = 0
            ) AS CommentsCount,
            CASE
                WHEN @ViewerId IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM ArticleLikes viewerLike
                    WHERE viewerLike.ArticleId = article.Id
                        AND viewerLike.UserId = @ViewerId
                )
                THEN 1 ELSE 0
            END AS Liked
        FROM Articles article
        JOIN Users author ON author.Id = article.AuthorId
        """;

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/news", GetNews);
        routes.MapGet("/api/news/{id:int}", GetNewsItem);
        routes.MapGet("/api/admin/news/{id:int}", GetAdminNewsItem);
        routes.MapPost("/api/news", CreateNewsItem);
        routes.MapPut("/api/news/{id:int}", UpdateNewsItem);
        routes.MapDelete("/api/news/{id:int}", DeleteNewsItem);

        routes.MapGet("/api/articles", GetArticles);
        routes.MapGet("/api/articles/{id:int}", GetArticle);
        routes.MapPost("/api/articles", CreateArticle);
        routes.MapPut("/api/articles/{id:int}", UpdateArticle);
        routes.MapDelete("/api/articles/{id:int}", DeleteArticle);
        routes.MapPost("/api/articles/{id:int}/like", ToggleLike);

        routes.MapGet("/api/presets", GetPresets);
        routes.MapGet("/api/campaigns", GetCampaigns);
        routes.MapGet("/api/rules", GetRules);
        return routes;
    }

    private static async Task<IResult> GetNews(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? lang,
        string? section)
    {
        if (section is not null && section is not ("main" or "community"))
            return ApiSupport.BadRequest("section_invalid", "section");

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var items = await connection.QueryAsync<NewsItem>(new CommandDefinition("""
            SELECT *
            FROM News
            WHERE @Section IS NULL OR Section = @Section
            ORDER BY Section, SortOrder;
            """,
            new { Section = string.IsNullOrWhiteSpace(section) ? null : section },
            cancellationToken: cancellationToken));

        var isEn = lang == "en";
        return Results.Ok(items.Select(item =>
        {
            var html = ContentSanitizer.SanitizeHtml(
                isEn ? item.DescEn : item.DescUa);
            return new PublicNewsDto(
                item.Id,
                item.ImageKey,
                item.BgPos,
                item.Section,
                isEn ? item.TitleEn : item.TitleUa,
                ContentSanitizer.Excerpt(html, 220),
                html);
        }));
    }

    private static async Task<IResult> GetNewsItem(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        string? lang)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var item = await connection.QuerySingleOrDefaultAsync<NewsDetailsRow>(
            new CommandDefinition("""
                SELECT
                    news.*,
                    (
                        SELECT COUNT(*)
                        FROM Comments comment
                        JOIN Discussions discussion ON discussion.Id = comment.DiscussionId
                        WHERE discussion.NewsId = news.Id AND comment.IsDeleted = 0
                    ) AS CommentsCount
                FROM News news
                WHERE news.Id = @Id;
                """, new { Id = id }, cancellationToken: cancellationToken));

        if (item is null) return ApiSupport.NotFound();
        var isEn = lang == "en";
        var description = ContentSanitizer.SanitizeHtml(
            isEn ? item.DescEn : item.DescUa);
        return Results.Ok(new PublicNewsDetailsDto(
            item.Id,
            item.ImageKey,
            item.BgPos,
            item.Section,
            isEn ? item.TitleEn : item.TitleUa,
            description,
            ContentSanitizer.Excerpt(description, 220),
            ApiSupport.IsoUtc(item.PublishedAt),
            item.CommentsCount));
    }

    private static async Task<IResult> GetAdminNewsItem(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        if (await ApiSupport.RequireAdmin(context, connections) is null)
            return ApiSupport.Forbidden();

        await using var connection = await connections.OpenAsync(context.RequestAborted);
        var item = await connection.QuerySingleOrDefaultAsync<NewsItem>(new CommandDefinition(
            "SELECT * FROM News WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: context.RequestAborted));
        return item is null
            ? ApiSupport.NotFound()
            : Results.Ok(new AdminNewsDto(
                item.Id,
                item.TitleUa,
                item.TitleEn,
                item.DescUa,
                item.DescEn,
                item.ImageKey,
                item.BgPos,
                item.Section,
                item.SortOrder,
                ApiSupport.IsoUtc(item.PublishedAt)));
    }

    private static async Task<IResult> CreateNewsItem(
        HttpContext context,
        SqliteConnectionFactory connections,
        NewsInput? input)
    {
        if (await ApiSupport.RequireAdmin(context, connections) is null)
            return ApiSupport.Forbidden();
        if (ValidateNewsInput(input, requireTitles: true) is { } validationError)
            return validationError;
        var validInput = input!;

        var item = new NewsItem
        {
            TitleUa = validInput.TitleUa!.Trim(),
            TitleEn = validInput.TitleEn!.Trim(),
            DescUa = ContentSanitizer.SanitizeHtml((validInput.DescUa ?? "").Trim()),
            DescEn = ContentSanitizer.SanitizeHtml((validInput.DescEn ?? "").Trim()),
            ImageKey = (validInput.ImageKey ?? "wizard_spells").Trim(),
            BgPos = (validInput.BgPos ?? "center").Trim(),
            Section = validInput.Section == "community" ? "community" : "main",
            SortOrder = validInput.SortOrder ?? 0,
        };

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction(deferred: false);
        item.Id = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT INTO News (
                ImageKey, TitleUa, TitleEn, DescUa, DescEn,
                Section, BgPos, SortOrder, PublishedAt
            )
            VALUES (
                @ImageKey, @TitleUa, @TitleEn, @DescUa, @DescEn,
                @Section, @BgPos, @SortOrder, @PublishedAt
            );
            SELECT last_insert_rowid();
            """, item, transaction, cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition(
            "INSERT INTO Discussions (NewsId) VALUES (@Id);",
            new { item.Id },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.Created($"/api/news/{item.Id}", new { id = item.Id });
    }

    private static async Task<IResult> UpdateNewsItem(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        NewsInput? input)
    {
        if (await ApiSupport.RequireAdmin(context, connections) is null)
            return ApiSupport.Forbidden();
        if (ValidateNewsInput(input, requireTitles: false) is { } validationError)
            return validationError;
        var validInput = input!;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var item = await connection.QuerySingleOrDefaultAsync<NewsItem>(
            new CommandDefinition(
                "SELECT * FROM News WHERE Id = @Id;",
                new { Id = id },
                cancellationToken: cancellationToken));
        if (item is null) return ApiSupport.NotFound();

        if (!string.IsNullOrWhiteSpace(validInput.TitleUa)) item.TitleUa = validInput.TitleUa.Trim();
        if (!string.IsNullOrWhiteSpace(validInput.TitleEn)) item.TitleEn = validInput.TitleEn.Trim();
        if (validInput.DescUa is not null)
            item.DescUa = ContentSanitizer.SanitizeHtml(validInput.DescUa.Trim());
        if (validInput.DescEn is not null)
            item.DescEn = ContentSanitizer.SanitizeHtml(validInput.DescEn.Trim());
        if (!string.IsNullOrWhiteSpace(validInput.ImageKey)) item.ImageKey = validInput.ImageKey.Trim();
        if (!string.IsNullOrWhiteSpace(validInput.BgPos)) item.BgPos = validInput.BgPos.Trim();
        if (validInput.Section is "main" or "community") item.Section = validInput.Section;
        if (validInput.SortOrder is int sortOrder) item.SortOrder = sortOrder;

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE News
            SET TitleUa = @TitleUa,
                TitleEn = @TitleEn,
                DescUa = @DescUa,
                DescEn = @DescEn,
                ImageKey = @ImageKey,
                BgPos = @BgPos,
                Section = @Section,
                SortOrder = @SortOrder
            WHERE Id = @Id;
            """, item, cancellationToken: cancellationToken));
        return Results.Ok(new { id = item.Id });
    }

    private static async Task<IResult> DeleteNewsItem(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        if (await ApiSupport.RequireAdmin(context, connections) is null)
            return ApiSupport.Forbidden();

        await using var connection = await connections.OpenAsync(context.RequestAborted);
        var affected = await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM News WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: context.RequestAborted));
        return affected == 0 ? ApiSupport.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> GetArticles(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? category,
        string? sort,
        int? page,
        int? pageSize)
    {
        if (category is not null && category != "all" && !ArticleCategories.Contains(category))
            return ApiSupport.BadRequest("category_invalid", "category");
        if (sort is not null && sort is not ("date" or "likes"))
            return ApiSupport.BadRequest("sort_invalid", "sort");
        if (ApiSupport.ValidatePagination(
                page, pageSize, defaultPageSize: 12, maxPageSize: 50,
                out var pagination) is { } paginationError)
            return paginationError;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var viewer = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);

        var where = string.IsNullOrWhiteSpace(category) || category == "all"
            ? ""
            : "WHERE article.Category = @Category";
        var order = sort == "likes"
            ? "ORDER BY LikesCount DESC, article.CreatedAt DESC, article.Id DESC"
            : "ORDER BY article.CreatedAt DESC, article.Id DESC";
        var total = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM Articles article\n{where};",
            new { Category = category },
            cancellationToken: cancellationToken));
        var sql = $"{ArticleSelect}\n{where}\n{order}\nLIMIT @PageSize OFFSET @Offset;";

        var rows = await connection.QueryAsync<ArticleRow>(new CommandDefinition(
            sql,
            new
            {
                Category = category,
                ViewerId = viewer?.Id,
                pagination.PageSize,
                pagination.Offset,
            },
            cancellationToken: cancellationToken));

        var items = rows
            .Select(item => ApiSupport.ArticleListDto(item, viewer))
            .ToArray();
        return Results.Ok(new PagedResponse<object>(
            items,
            pagination.Page,
            pagination.PageSize,
            total,
            TotalPages(total, pagination.PageSize)));
    }

    private static async Task<IResult> GetArticle(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var viewer = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        var article = await LoadArticle(
            connection, id, viewer?.Id, cancellationToken);

        return article is null
            ? ApiSupport.NotFound()
            : Results.Ok(ApiSupport.ArticleFullDto(article, viewer));
    }

    private static async Task<IResult> CreateArticle(
        HttpContext context,
        SqliteConnectionFactory connections,
        ArticleInput? input)
    {
        if (ValidateArticleInput(input) is { } validationError)
            return validationError;
        var validInput = input!;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        if (!RateLimiter.TryHitKey(
                $"article:{user.Id}", ArticleLimit, ArticleWindow, out var wait))
            return ApiSupport.TooMany(context, wait);

        var title = (validInput.Title ?? "").Trim();
        var content = (validInput.Content ?? "").Trim();
        var format = validInput.Format == "html" ? "html" : "markdown";
        if (format == "html") content = ContentSanitizer.SanitizeHtml(content);

        var article = new Article
        {
            Title = title,
            Content = content,
            Format = format,
            Category = ArticleCategories.Contains(validInput.Category) ? validInput.Category! : "lore",
            CoverImage = (validInput.Cover ?? "").Trim(),
            AuthorId = user.Id,
        };

        await using var transaction = connection.BeginTransaction(deferred: false);
        article.Id = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT INTO Articles (
                Title, Category, Content, Format, CoverImage,
                AuthorId, CreatedAt, UpdatedAt
            )
            VALUES (
                @Title, @Category, @Content, @Format, @CoverImage,
                @AuthorId, @CreatedAt, @UpdatedAt
            );
            SELECT last_insert_rowid();
            """, article, transaction, cancellationToken: cancellationToken));
        await connection.ExecuteAsync(new CommandDefinition(
            "INSERT INTO Discussions (ArticleId) VALUES (@Id);",
            new { article.Id },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);

        var created = await LoadArticle(connection, article.Id, user.Id, cancellationToken);
        return Results.Created(
            $"/api/articles/{article.Id}",
            ApiSupport.ArticleFullDto(created!, user));
    }

    private static async Task<IResult> UpdateArticle(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id,
        ArticleInput? input)
    {
        if (ValidateArticleInput(input) is { } validationError)
            return validationError;
        var validInput = input!;

        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var article = await LoadArticle(connection, id, user.Id, cancellationToken);
        if (article is null) return ApiSupport.NotFound();
        if (article.AuthorId != user.Id && user.Role != "admin")
            return ApiSupport.Forbidden();

        var title = (validInput.Title ?? "").Trim();
        var content = (validInput.Content ?? "").Trim();
        article.Title = title;
        if (ArticleCategories.Contains(validInput.Category)) article.Category = validInput.Category!;
        article.Format = validInput.Format == "html" ? "html" : "markdown";
        article.Content = article.Format == "html"
            ? ContentSanitizer.SanitizeHtml(content)
            : content;
        if (validInput.Cover is not null) article.CoverImage = validInput.Cover.Trim();
        article.UpdatedAt = DateTime.UtcNow;

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Articles
            SET Title = @Title,
                Category = @Category,
                Content = @Content,
                Format = @Format,
                CoverImage = @CoverImage,
                UpdatedAt = @UpdatedAt
            WHERE Id = @Id;
            """, article, cancellationToken: cancellationToken));

        var updated = await LoadArticle(connection, id, user.Id, cancellationToken);
        return Results.Ok(ApiSupport.ArticleFullDto(updated!, user));
    }

    private static async Task<IResult> DeleteArticle(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
        var cancellationToken = context.RequestAborted;
        await using var connection = await connections.OpenAsync(cancellationToken);
        var user = await Auth.CurrentUser(
            context, connection, cancellationToken: cancellationToken);
        if (user is null) return ApiSupport.Unauthorized();

        var authorId = await connection.QuerySingleOrDefaultAsync<int?>(
            new CommandDefinition(
                "SELECT AuthorId FROM Articles WHERE Id = @Id;",
                new { Id = id },
                cancellationToken: cancellationToken));
        if (authorId is null) return ApiSupport.NotFound();
        if (authorId != user.Id && user.Role != "admin")
            return ApiSupport.Forbidden();

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Articles WHERE Id = @Id;",
            new { Id = id },
            cancellationToken: cancellationToken));
        return Results.NoContent();
    }

    private static async Task<IResult> ToggleLike(
        HttpContext context,
        SqliteConnectionFactory connections,
        int id)
    {
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

        if (await connection.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT COUNT(*) FROM Articles WHERE Id = @Id;",
                new { Id = id },
                transaction,
                cancellationToken: cancellationToken)) == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiSupport.NotFound();
        }

        var removed = await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM ArticleLikes
            WHERE ArticleId = @ArticleId AND UserId = @UserId;
            """,
            new { ArticleId = id, UserId = user.Id },
            transaction,
            cancellationToken: cancellationToken));

        var liked = removed == 0;
        if (liked)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO ArticleLikes (ArticleId, UserId, CreatedAt)
                VALUES (@ArticleId, @UserId, @CreatedAt);
                """,
                new { ArticleId = id, UserId = user.Id, CreatedAt = DateTime.UtcNow },
                transaction,
                cancellationToken: cancellationToken));
        }

        var count = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM ArticleLikes WHERE ArticleId = @ArticleId;",
            new { ArticleId = id },
            transaction,
            cancellationToken: cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { likes = count, liked });
    }

    private static async Task<IResult> GetPresets(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? lang)
    {
        await using var connection = await connections.OpenAsync(context.RequestAborted);
        var items = await connection.QueryAsync<CharacterPreset>(new CommandDefinition(
            "SELECT * FROM Presets ORDER BY SortOrder;",
            cancellationToken: context.RequestAborted));
        var isEn = lang == "en";

        return Results.Ok(items.Select(item => new
        {
            id = item.Slug,
            name = isEn ? item.NameEn : item.NameUa,
            charClass = isEn ? item.ClassEn : item.ClassUa,
            race = isEn ? item.RaceEn : item.RaceUa,
            classKey = item.ClassEn,
            raceKey = item.RaceEn,
            level = item.Level,
            desc = isEn ? item.DescEn : item.DescUa,
            avatarKey = item.AvatarKey,
            bgKey = item.BgKey,
            stats = new Dictionary<string, int>
            {
                ["STR"] = item.Str,
                ["DEX"] = item.Dex,
                ["CON"] = item.Con,
                ["INT"] = item.Int,
                ["WIS"] = item.Wis,
                ["CHA"] = item.Cha,
            },
            spells = ApiSupport.SplitList(isEn ? item.SpellsEn : item.SpellsUa),
        }));
    }

    private static async Task<IResult> GetCampaigns(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? lang)
    {
        await using var connection = await connections.OpenAsync(context.RequestAborted);
        var items = await connection.QueryAsync<Campaign>(new CommandDefinition(
            "SELECT * FROM Campaigns ORDER BY SortOrder;",
            cancellationToken: context.RequestAborted));
        var isEn = lang == "en";

        return Results.Ok(items.Select(item => new
        {
            id = item.Slug,
            imageKey = item.ImageKey,
            bgPos = item.BgPos,
            tag = isEn ? item.TagEn : item.TagUa,
            title = isEn ? item.TitleEn : item.TitleUa,
            desc = isEn ? item.DescEn : item.DescUa,
            btn = isEn ? item.BtnEn : item.BtnUa,
            details = new
            {
                location = isEn ? item.LocationEn : item.LocationUa,
                partySize = item.PartySize,
                dmNotes = isEn ? item.DmNotesEn : item.DmNotesUa,
                highlights = ApiSupport.SplitList(
                    isEn ? item.HighlightsEn : item.HighlightsUa),
            },
        }));
    }

    private static async Task<IResult> GetRules(
        HttpContext context,
        SqliteConnectionFactory connections,
        string? lang,
        string? section)
    {
        await using var connection = await connections.OpenAsync(context.RequestAborted);
        var items = await connection.QueryAsync<RuleCard>(new CommandDefinition("""
            SELECT *
            FROM RuleCards
            WHERE @Section IS NULL OR Section = @Section
            ORDER BY Section, SortOrder;
            """,
            new { Section = string.IsNullOrWhiteSpace(section) ? null : section },
            cancellationToken: context.RequestAborted));
        var isEn = lang == "en";

        return Results.Ok(items.Select(item => new
        {
            id = item.Slug,
            section = item.Section,
            imageKey = item.ImageKey,
            alt = item.Alt,
            title = isEn ? item.TitleEn : item.TitleUa,
            desc = isEn ? item.DescEn : item.DescUa,
        }));
    }

    private static Task<ArticleRow?> LoadArticle(
        SqliteConnection connection,
        int id,
        int? viewerId,
        CancellationToken cancellationToken) =>
        connection.QuerySingleOrDefaultAsync<ArticleRow>(new CommandDefinition(
            $"{ArticleSelect}\nWHERE article.Id = @Id;",
            new { Id = id, ViewerId = viewerId },
            cancellationToken: cancellationToken));

    private static IResult? ValidateArticleInput(ArticleInput? input)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        var title = (input.Title ?? "").Trim();
        if (title.Length is 0 or > 120)
            return ApiSupport.BadRequest("title", "title");

        var content = (input.Content ?? "").Trim();
        if (content.Length == 0)
            return ApiSupport.BadRequest("content", "content");
        if (content.Length > 1_000_000)
            return ApiSupport.BadRequest("content_too_long", "content");
        if (input.Category is not null && !ArticleCategories.Contains(input.Category))
            return ApiSupport.BadRequest("category_invalid", "category");
        if (input.Format is not null && input.Format is not ("markdown" or "html"))
            return ApiSupport.BadRequest("format_invalid", "format");
        if (input.Cover is not null && input.Cover.Trim().Length > 300_000)
            return ApiSupport.BadRequest("cover_too_long", "cover");
        if (!ContentSanitizer.IsSafeImageReference(input.Cover))
            return ApiSupport.BadRequest("cover_invalid", "cover");

        return null;
    }

    private static IResult? ValidateNewsInput(NewsInput? input, bool requireTitles)
    {
        if (input is null)
            return ApiSupport.BadRequest("invalid_request");

        if (requireTitles
            && (string.IsNullOrWhiteSpace(input.TitleUa)
                || string.IsNullOrWhiteSpace(input.TitleEn)))
            return ApiSupport.BadRequest("title_required", "title");
        if (input.TitleUa is not null && input.TitleUa.Trim().Length is 0 or > 200)
            return ApiSupport.BadRequest("title_required", "titleUa");
        if (input.TitleEn is not null && input.TitleEn.Trim().Length is 0 or > 200)
            return ApiSupport.BadRequest("title_required", "titleEn");
        if (input.DescUa is not null && input.DescUa.Length > 100_000)
            return ApiSupport.BadRequest("description_too_long", "descUa");
        if (input.DescEn is not null && input.DescEn.Length > 100_000)
            return ApiSupport.BadRequest("description_too_long", "descEn");
        if (input.ImageKey is not null
            && input.ImageKey.Trim().Length is 0 or > 64)
            return ApiSupport.BadRequest("image_key_invalid", "imageKey");
        if (input.BgPos is not null && input.BgPos.Trim().Length is 0 or > 32)
            return ApiSupport.BadRequest("background_position_invalid", "bgPos");
        if (input.Section is not null && input.Section is not ("main" or "community"))
            return ApiSupport.BadRequest("section_invalid", "section");
        if (input.SortOrder is < -10_000 or > 10_000)
            return ApiSupport.BadRequest("sort_order_invalid", "sortOrder");

        return null;
    }

    private static int TotalPages(int total, int pageSize) =>
        total == 0 ? 0 : (total + pageSize - 1) / pageSize;

    private sealed class NewsDetailsRow : NewsItem
    {
        public int CommentsCount { get; init; }
    }
}
