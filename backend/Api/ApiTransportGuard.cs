namespace DndForum.Api;

internal static class ApiTransportGuard
{
    private static int _reported;

    internal static async Task Invoke(HttpContext context, RequestDelegate next)
    {
        if (context.Request.IsHttps
            || context.Request.Path.StartsWithSegments("/api/health"))
        {
            await next(context);
            return;
        }

        if (Interlocked.Exchange(ref _reported, 1) == 0)
        {
            context.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("DndForum.Transport")
                .LogError(
                    "Request for {Path} arrived over HTTP. Session and antiforgery "
                    + "cookies are Secure and cannot be issued, so every changing "
                    + "request will fail. Terminate TLS on a reverse proxy and make "
                    + "it send X-Forwarded-Proto (and X-Forwarded-For); see README, "
                    + "section about deploying behind a reverse proxy. Reported once "
                    + "per process.",
                    context.Request.Path);
        }

        await ApiSupport.Misdirected(
                "insecure_transport",
                "This deployment requires HTTPS. A reverse proxy must forward "
                + "X-Forwarded-Proto.")
            .ExecuteAsync(context);
    }
}
