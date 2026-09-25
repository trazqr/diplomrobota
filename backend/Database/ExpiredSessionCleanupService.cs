using Dapper;

namespace DndForum.Data;

internal sealed class ExpiredSessionCleanupService(
    SqliteConnectionFactory connections,
    ILogger<ExpiredSessionCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await connections.OpenAsync(stoppingToken);
                await connection.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM Sessions WHERE ExpiresAt <= @Now;",
                    new { Now = DateTime.UtcNow },
                    cancellationToken: stoppingToken));
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Failed to remove expired sessions");
            }

            try
            {
                await Task.Delay(CleanupInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
