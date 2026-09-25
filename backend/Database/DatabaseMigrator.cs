using System.Reflection;
using Dapper;
using Microsoft.Data.Sqlite;

namespace DndForum.Data;

public sealed class DatabaseMigrator(SqliteConnectionFactory connections, ILogger<DatabaseMigrator> logger)
{
    private const string MigrationPrefix = "DndForum.Database.Migrations.";

    public async Task MigrateAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);

        await connection.ExecuteAsync(new CommandDefinition("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                Version INTEGER NOT NULL PRIMARY KEY,
                Name TEXT NOT NULL,
                AppliedAt TEXT NOT NULL
            );
            """, cancellationToken: cancellationToken));

        await PrepareLegacyDatabaseAsync(connection, cancellationToken);

        var applied = (await connection.QueryAsync<int>(new CommandDefinition(
            "SELECT Version FROM schema_migrations;",
            cancellationToken: cancellationToken))).ToHashSet();

        var migrations = Assembly.GetExecutingAssembly()
            .GetManifestResourceNames()
            .Where(name => name.StartsWith(MigrationPrefix, StringComparison.Ordinal)
                && name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            .Select(name => new
            {
                Resource = name,
                FileName = name[MigrationPrefix.Length..],
                Version = ParseVersion(name[MigrationPrefix.Length..]),
            })
            .OrderBy(migration => migration.Version)
            .ToArray();

        foreach (var migration in migrations)
        {
            if (applied.Contains(migration.Version)) continue;

            await using var stream = Assembly.GetExecutingAssembly()
                .GetManifestResourceStream(migration.Resource)
                ?? throw new InvalidOperationException($"Migration resource not found: {migration.Resource}");
            using var reader = new StreamReader(stream);
            var sql = await reader.ReadToEndAsync(cancellationToken);

            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            try
            {
                await connection.ExecuteAsync(new CommandDefinition(
                    sql,
                    transaction: transaction,
                    cancellationToken: cancellationToken));

                var foreignKeyViolations = await connection.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM pragma_foreign_key_check;",
                        transaction: transaction,
                        cancellationToken: cancellationToken));
                if (foreignKeyViolations > 0)
                    throw new InvalidOperationException(
                        $"Migration {migration.FileName} created {foreignKeyViolations} foreign-key violation(s).");

                await connection.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO schema_migrations (Version, Name, AppliedAt)
                    VALUES (@Version, @Name, @AppliedAt);
                    """,
                    new
                    {
                        migration.Version,
                        Name = migration.FileName,
                        AppliedAt = DateTime.UtcNow,
                    },
                    transaction,
                    cancellationToken: cancellationToken));

                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation("Applied database migration {Version}: {Name}",
                    migration.Version, migration.FileName);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }
    }

    private static int ParseVersion(string fileName)
    {
        var separator = fileName.IndexOf('_');
        var prefix = separator >= 0 ? fileName[..separator] : fileName[..fileName.IndexOf('.')];
        return int.TryParse(prefix, out var version)
            ? version
            : throw new InvalidOperationException($"Invalid migration name: {fileName}");
    }

    private static async Task PrepareLegacyDatabaseAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var usersExist = await connection.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT COUNT(*)
            FROM sqlite_master
            WHERE type = 'table' AND name = 'Users';
            """, cancellationToken: cancellationToken)) > 0;

        if (!usersExist) return;

        var columns = (await connection.QueryAsync<ColumnInfo>(new CommandDefinition(
            "PRAGMA table_info('Users');",
            cancellationToken: cancellationToken)))
            .Select(column => column.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var additions = new (string Name, string Ddl)[]
        {
            ("Cursor", "TEXT NOT NULL DEFAULT ''"),
            ("IsOwner", "INTEGER NOT NULL DEFAULT 0"),
            ("IsBanned", "INTEGER NOT NULL DEFAULT 0"),
            ("BanReason", "TEXT NOT NULL DEFAULT ''"),
            ("BannedAt", "TEXT NULL"),
        };

        foreach (var addition in additions)
        {
            if (columns.Contains(addition.Name)) continue;

            var sql = $"ALTER TABLE Users ADD COLUMN \"{addition.Name}\" {addition.Ddl};";
            await connection.ExecuteAsync(new CommandDefinition(
                sql,
                cancellationToken: cancellationToken));
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE Users
            SET IsOwner = 1
            WHERE Id = (
                SELECT Id
                FROM Users
                WHERE Role = 'admin'
                ORDER BY Id
                LIMIT 1
            )
            AND NOT EXISTS (SELECT 1 FROM Users WHERE IsOwner = 1);
            """, cancellationToken: cancellationToken));
    }

    private sealed class ColumnInfo
    {
        public string Name { get; init; } = "";
    }
}
