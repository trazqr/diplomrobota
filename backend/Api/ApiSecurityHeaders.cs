namespace DndForum.Api;

internal static class ApiSecurityHeaders
{
    internal static async Task Invoke(HttpContext context, RequestDelegate next)
    {
        var headers = context.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "DENY";
        headers.Append("Referrer-Policy", "no-referrer");
        headers.Append(
            "Content-Security-Policy",
            "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        headers.Append(
            "Permissions-Policy",
            "camera=(), geolocation=(), microphone=()");

        if (context.Request.Path.StartsWithSegments("/api"))
            headers.CacheControl = "no-store";

        await next(context);
    }
}
