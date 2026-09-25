using Dapper;
using Microsoft.Data.Sqlite;

namespace DndForum.Data;

public sealed class ReferenceDataSeeder(SqliteConnectionFactory connections)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();

        try
        {
            await SeedPresetsAsync(connection, transaction, cancellationToken);
            await SeedCampaignsAsync(connection, transaction, cancellationToken);
            await SeedRulesAsync(connection, transaction, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task SeedPresetsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (await CountAsync(connection, transaction, "Presets", cancellationToken) > 0) return;

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Presets (
                Slug, NameUa, NameEn, ClassUa, ClassEn, RaceUa, RaceEn,
                Level, DescUa, DescEn, AvatarKey, BgKey,
                Str, Dex, Con, Int, Wis, Cha, SpellsUa, SpellsEn, SortOrder
            )
            VALUES (
                @Slug, @NameUa, @NameEn, @ClassUa, @ClassEn, @RaceUa, @RaceEn,
                @Level, @DescUa, @DescEn, @AvatarKey, @BgKey,
                @Str, @Dex, @Con, @Int, @Wis, @Cha, @SpellsUa, @SpellsEn, @SortOrder
            );
            """,
            SeedContent.CreatePresets(),
            transaction,
            cancellationToken: cancellationToken));
    }

    private static async Task SeedCampaignsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (await CountAsync(connection, transaction, "Campaigns", cancellationToken) > 0) return;

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Campaigns (
                Slug, TitleUa, TitleEn, DescUa, DescEn, BtnUa, BtnEn,
                TagUa, TagEn, ImageKey, BgPos, LocationUa, LocationEn,
                PartySize, DmNotesUa, DmNotesEn, HighlightsUa, HighlightsEn, SortOrder
            )
            VALUES (
                @Slug, @TitleUa, @TitleEn, @DescUa, @DescEn, @BtnUa, @BtnEn,
                @TagUa, @TagEn, @ImageKey, @BgPos, @LocationUa, @LocationEn,
                @PartySize, @DmNotesUa, @DmNotesEn, @HighlightsUa, @HighlightsEn, @SortOrder
            );
            """,
            SeedContent.CreateCampaigns(),
            transaction,
            cancellationToken: cancellationToken));
    }

    private static async Task SeedRulesAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (await CountAsync(connection, transaction, "RuleCards", cancellationToken) > 0) return;

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO RuleCards (
                Slug, Section, TitleUa, TitleEn, DescUa, DescEn,
                ImageKey, Alt, SortOrder
            )
            VALUES (
                @Slug, @Section, @TitleUa, @TitleEn, @DescUa, @DescEn,
                @ImageKey, @Alt, @SortOrder
            );
            """,
            SeedContent.CreateRules(),
            transaction,
            cancellationToken: cancellationToken));
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
