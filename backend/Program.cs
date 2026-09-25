using DndForum;
using DndForum.Api;
using DndForum.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

if (string.IsNullOrWhiteSpace(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://127.0.0.1:5107");
builder.Services.AddOpenApi();
builder.Services.AddHsts(options => options.MaxAge = TimeSpan.FromDays(365));
builder.Services.AddSingleton<SqliteConnectionFactory>();
builder.Services.AddSingleton<DatabaseMigrator>();
builder.Services.Configure<RouteHandlerOptions>(options =>
    options.ThrowOnBadRequest = true);
builder.Services.AddSingleton<ReferenceDataSeeder>();
builder.Services.AddSingleton<DemoDataSeeder>();
builder.Services.AddHostedService<ExpiredSessionCleanupService>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.SuppressReadingTokenFromFormBody = true;
    options.Cookie.Name = "dndforum.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];

var authentication = builder.Services.AddAuthentication();
authentication.AddCookie(ExternalAuthEndpoints.ExternalScheme, options =>
{
    options.Cookie.Name = ExternalAuthEndpoints.ExternalCookieName;
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromMinutes(15);
});

if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authentication.AddGoogle(options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
        options.SignInScheme = ExternalAuthEndpoints.ExternalScheme;
        options.CallbackPath = "/api/auth/google/callback";
        options.ClaimActions.MapJsonKey("email_verified", "email_verified");
        options.SaveTokens = false;
        options.Events.OnRemoteFailure = failure =>
        {
            failure.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("DndForum.ExternalAuth")
                .LogWarning(failure.Failure, "Google sign-in did not complete");
            failure.HandleResponse();
            failure.Response.Redirect("/?authError=external_failed");
            return Task.CompletedTask;
        };
    });
}

const string DevCors = "dev-frontend";
builder.Services.AddCors(options => options.AddPolicy(DevCors, policy => policy
    .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();
var forwardedHeadersOptions = CreateForwardedHeadersOptions(app.Configuration);

if (!app.Environment.IsDevelopment())
{
    app.UseForwardedHeaders(forwardedHeadersOptions);
    app.UseHsts();
}

app.Use(ApiSecurityHeaders.Invoke);

if (!app.Environment.IsDevelopment())
    app.Use(ApiTransportGuard.Invoke);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors(DevCors);
}

app.UseAuthentication();

app.Use(ApiExceptionHandling.Invoke);
app.Use(async (context, next) =>
{
    var requiresCsrf = context.Request.Path.StartsWithSegments("/api")
        && !HttpMethods.IsGet(context.Request.Method)
        && !HttpMethods.IsHead(context.Request.Method)
        && !HttpMethods.IsOptions(context.Request.Method);

    if (requiresCsrf)
    {
        var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await antiforgery.IsRequestValidAsync(context))
        {
            await ApiSupport.Forbidden("csrf_invalid").ExecuteAsync(context);
            return;
        }
    }

    await next(context);
});

StartupDiagnostics.Report(app);

await app.Services.GetRequiredService<DatabaseMigrator>()
    .MigrateAsync(app.Lifetime.ApplicationStopping);

if (args.Contains("--migrate-only", StringComparer.OrdinalIgnoreCase))
    return;

await app.Services.GetRequiredService<ReferenceDataSeeder>()
    .SeedAsync(app.Lifetime.ApplicationStopping);
if (app.Configuration.GetValue<bool>("Seed:DemoContent"))
{
    await app.Services.GetRequiredService<DemoDataSeeder>()
        .SeedAsync(app.Lifetime.ApplicationStopping);
}

app.MapGet("/api/health", () => Results.Ok(new { ok = true }));
app.MapGet("/api/auth/csrf", (HttpContext context, IAntiforgery antiforgery) =>
{
    context.Response.Headers.CacheControl = "no-store";
    var tokens = antiforgery.GetAndStoreTokens(context);
    return Results.Ok(new { token = tokens.RequestToken });
});
app.MapAuthProfileEndpoints();
app.MapExternalAuthEndpoints();
app.MapContentEndpoints();
app.MapCommentAdminEndpoints();
app.MapSocialEndpoints();

app.Run();

static ForwardedHeadersOptions CreateForwardedHeadersOptions(IConfiguration configuration)
{
    var options = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    };

    foreach (var value in configuration
                 .GetSection("ReverseProxy:KnownProxies")
                 .Get<string[]>() ?? [])
    {
        if (!IPAddress.TryParse(value, out var address))
            throw new InvalidOperationException(
                $"ReverseProxy:KnownProxies contains an invalid IP address: {value}");
        options.KnownProxies.Add(address);
    }

    foreach (var value in configuration
                 .GetSection("ReverseProxy:KnownNetworks")
                 .Get<string[]>() ?? [])
    {
        if (!System.Net.IPNetwork.TryParse(value, out var network))
            throw new InvalidOperationException(
                $"ReverseProxy:KnownNetworks contains an invalid CIDR network: {value}");
        options.KnownIPNetworks.Add(network);
    }

    return options;
}
