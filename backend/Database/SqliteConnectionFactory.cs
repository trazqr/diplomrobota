using Microsoft.Data.Sqlite;

namespace DndForum.Data;

public sealed class SqliteConnectionFactory
{
    private readonly string _connectionString;

    public string DataSource { get; }

    public SqliteConnectionFactory(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = configuration.GetConnectionString("Default")
            ?? "Data Source=dndforum.db";
        var builder = new SqliteConnectionStringBuilder(configured);

        if (string.IsNullOrWhiteSpace(builder.DataSource))
            throw new InvalidOperationException("SQLite Data Source is not configured.");

        if (builder.DataSource != ":memory:" && !Path.IsPathFullyQualified(builder.DataSource))
            builder.DataSource = Path.GetFullPath(builder.DataSource, environment.ContentRootPath);

        _connectionString = builder.ConnectionString;
        DataSource = builder.DataSource;
    }

    public async Task<SqliteConnection> OpenAsync(CancellationToken cancellationToken = default)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);

        return connection;
    }
}
