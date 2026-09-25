using DndForum.Data;

namespace DndForum;

internal static class StartupDiagnostics
{
    internal static void Report(WebApplication app)
    {
        var logger = app.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("DndForum.Startup");

        var urls = app.Configuration["urls"] ?? "(взяты по умолчанию Kestrel)";
        var database = app.Services.GetRequiredService<SqliteConnectionFactory>().DataSource;

        logger.LogInformation(
            "Starting in {Environment}; urls {Urls}; database {Database}",
            app.Environment.EnvironmentName, urls, database);

        if (app.Environment.IsDevelopment()) return;

        if (urls.Contains('*') || urls.Contains('+') || urls.Contains("0.0.0.0"))
        {
            logger.LogWarning(
                "Kestrel listens on a public interface ({Urls}). Requests that "
                + "bypass the reverse proxy carry no forwarded headers, and a "
                + "proxy on another host must be listed in "
                + "ReverseProxy:KnownProxies or KnownNetworks — "
                + "otherwise X-Forwarded-For is dropped and rate limiting counts "
                + "every visitor as one client. See README, section about "
                + "deploying behind a reverse proxy.",
                urls);
        }

        if (string.IsNullOrWhiteSpace(app.Configuration["AllowedHosts"])
            || app.Configuration["AllowedHosts"] == "*")
            throw new InvalidOperationException(
                "AllowedHosts must contain the production site's host names. "
                + "Wildcard hosts are allowed only in Development.");

        if (app.Configuration.GetValue<bool>("Seed:DemoContent"))
        {
            logger.LogWarning(
                "Seed:DemoContent is enabled outside Development: demo articles "
                + "and news will be written to {Database}.", database);
        }
    }
}
