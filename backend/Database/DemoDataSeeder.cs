using Dapper;
using Microsoft.Data.Sqlite;

namespace DndForum.Data;

public sealed class DemoDataSeeder(SqliteConnectionFactory connections)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();

        try
        {
            await SeedArticlesAsync(connection, transaction, cancellationToken);
            await SeedNewsAsync(connection, transaction, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task SeedArticlesAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (await CountAsync(connection, transaction, "Articles", cancellationToken) > 0) return;

        var authorId = await connection.QuerySingleOrDefaultAsync<int?>(new CommandDefinition(
            "SELECT Id FROM Users WHERE Login = @Login LIMIT 1;",
            new { Login = Seed.SeedAuthorLogin },
            transaction,
            cancellationToken: cancellationToken));

        if (authorId is null)
        {
            var author = Seed.CreateAuthor();
            authorId = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                INSERT INTO Users (
                    Login, PasswordHash, Name, Role, CharClass, Race, Level,
                    Bio, Avatar, CreatedAt, Cursor, ShowWanderers, ShowDragon, IsOwner, IsBanned, BanReason, BannedAt
                )
                VALUES (
                    @Login, @PasswordHash, @Name, @Role, @CharClass, @Race, @Level,
                    @Bio, @Avatar, @CreatedAt, @Cursor, @ShowWanderers, @ShowDragon, @IsOwner, @IsBanned, @BanReason, @BannedAt
                );
                SELECT last_insert_rowid();
                """,
                author,
                transaction,
                cancellationToken: cancellationToken));
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Articles (
                Title, Category, Content, Format, CoverImage,
                AuthorId, CreatedAt, UpdatedAt
            )
            VALUES (
                @Title, @Category, @Content, @Format, @CoverImage,
                @AuthorId, @CreatedAt, @UpdatedAt
            );
            """,
            Seed.CreateArticles(authorId.Value),
            transaction,
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT OR IGNORE INTO Discussions (ArticleId)
            SELECT Id FROM Articles;
            """, transaction: transaction, cancellationToken: cancellationToken));
    }

    private static async Task SeedNewsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (await CountAsync(connection, transaction, "News", cancellationToken) > 0) return;

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO News (
                ImageKey, TitleUa, TitleEn, DescUa, DescEn,
                Section, BgPos, SortOrder, PublishedAt
            )
            VALUES (
                @ImageKey, @TitleUa, @TitleEn, @DescUa, @DescEn,
                @Section, @BgPos, @SortOrder, @PublishedAt
            );
            """,
            SeedNews.CreateNews(),
            transaction,
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT OR IGNORE INTO Discussions (NewsId)
            SELECT Id FROM News;
            """, transaction: transaction, cancellationToken: cancellationToken));
    }

    private static Task<long> CountAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string table,
        CancellationToken cancellationToken) =>
        connection.ExecuteScalarAsync<long>(new CommandDefinition(
            $"SELECT COUNT(*) FROM \"{table}\";",
            transaction: transaction,
            cancellationToken: cancellationToken));
}
