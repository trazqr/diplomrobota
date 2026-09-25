using System.Collections.Concurrent;

public static class RateLimiter
{
    private sealed class Window
    {
        public int Count;
        public DateTimeOffset ExpiresAt;
    }

    private static readonly ConcurrentDictionary<string, Window> Windows = new();
    private static readonly object SweepLock = new();
    private static DateTimeOffset _lastSweep = DateTimeOffset.UtcNow;

    public static bool TryHit(HttpContext ctx, string action, int limit, TimeSpan window, out int retryAfter) =>
        TryHitKey($"{action}:{ClientKey(ctx)}", limit, window, out retryAfter);

    public static bool TryHitKey(string key, int limit, TimeSpan window, out int retryAfter)
    {
        var now = DateTimeOffset.UtcNow;
        Sweep(now);

        var entry = Windows.GetOrAdd(
            key,
            _ => new Window { ExpiresAt = now + window });

        lock (entry)
        {
            if (now >= entry.ExpiresAt)
            {
                entry.Count = 0;
                entry.ExpiresAt = now + window;
            }

            entry.Count++;
            if (entry.Count <= limit)
            {
                retryAfter = 0;
                return true;
            }

            retryAfter = Math.Max(1, (int)(entry.ExpiresAt - now).TotalSeconds);
            return false;
        }
    }

    public static void Reset(HttpContext ctx, string action) =>
        ResetKey($"{action}:{ClientKey(ctx)}");

    public static void ResetKey(string key) => Windows.TryRemove(key, out _);

    private static string ClientKey(HttpContext ctx) =>
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static void Sweep(DateTimeOffset now)
    {
        if (now - _lastSweep < TimeSpan.FromMinutes(1)) return;

        lock (SweepLock)
        {
            if (now - _lastSweep < TimeSpan.FromMinutes(1)) return;
            _lastSweep = now;
            foreach (var (key, value) in Windows)
                if (now >= value.ExpiresAt) Windows.TryRemove(key, out _);
        }
    }
}
