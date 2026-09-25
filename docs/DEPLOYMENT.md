# Operations and deployment

A reference for running the forum on a server: the security model, working
behind a reverse proxy, startup diagnostics and database maintenance. For a
local run the [README](../README.md) is enough.

## Authentication and CSRF

The session travels in the `dndforum.session` cookie with `HttpOnly` and
`SameSite=Lax`. In production the cookie also always carries `Secure`, so a
production deployment must serve the frontend and `/api` from a single HTTPS
origin. The session token is not reachable from JavaScript and is never stored
in `localStorage`. SQLite keeps only the SHA-256 of the token, so a leaked
database file does not expose active cookies. Migration
`004_session_token_hash.sql` revokes older sessions: after the first upgrade
users have to sign in again.

Changing API requests require the antiforgery token from `GET /api/auth/csrf`
in the `X-CSRF-TOKEN` header. The frontend fetches and refreshes it
automatically. Expired sessions are dropped on access and periodically by a
background service.

## Sign in with Google

External sign-in is optional. Without credentials the application starts
normally, `GET /api/auth/providers` reports `{ "google": false }` and the
frontend hides the button, so nothing breaks in a deployment that does not use
it.

To enable it, create an OAuth client of type "Web application" in the Google
Cloud console and register the redirect URI for every environment separately:

```text
http://localhost:5173/api/auth/google/callback     development
https://forum.example.com/api/auth/google/callback production
```

The path is fixed by the application. In development the browser talks to the
Vite dev server, which proxies `/api` to the backend, so the URI carries port
5173 rather than 5107.

Pass the credentials as environment variables — never in `appsettings.json`,
which is committed:

```powershell
$env:Authentication__Google__ClientId = "…apps.googleusercontent.com"
$env:Authentication__Google__ClientSecret = "…"
```

How an account is resolved on the callback:

1. A known `(provider, provider key)` pair signs in the linked account.
2. Otherwise, if Google reports the address as verified and a local account
   carries the same email, the provider is linked to that account.
3. Otherwise a new account is created with an empty password hash, a login
   derived from the email or the display name, and a numeric suffix when that
   login is taken.

An unverified address is never used for matching: a provider that hands out an
address without confirming it would otherwise let anyone take over an existing
account. An empty password hash means password sign-in is impossible for that
account — `VerifyPassword` rejects it before any comparison.

The first account created still becomes the forum owner, and that applies to a
Google sign-up as well. On a fresh public deployment, register the owner
account before announcing the address.

Failures never surface as a server error: a cancelled consent screen, an
expired state or a tampered callback all redirect back to the site with
`?authError=external_failed`, and the reason is logged once under
`DndForum.ExternalAuth`.

## API protection

The backend does not publish the Kestrel `Server` header and adds `nosniff`,
an embedding ban, a CSP, `Referrer-Policy` and `Permissions-Policy`. Auth,
profile and admin responses are not cached. HSTS is on in production; when TLS
terminates on a reverse proxy, the proxy must set HSTS on the external HTTPS
response as well.

These headers only protect API responses. The site page is served as static
files and carries its own policy: `vite build` embeds a
`Content-Security-Policy` meta tag into `index.html`. It forbids inline scripts
and foreign origins, so markup that somehow slipped past the sanitizer still
cannot run a script or send data elsewhere. The policy is not added in
development mode, where Vite relies on inline scripts for HMR. The only
external origin in the policy is Google Fonts; any new one has to be added to
`vite.config.js` or the browser will block it silently. The same applies to
`VITE_API_URL`: the policy allows requests to the own origin only.

The `frame-ancestors` directive is ignored inside a meta tag by specification,
so the proxy sets it as a header:

```nginx
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
```

Article covers and avatars are validated on the server: an empty value, a key
from the site image set, or an embedded raster `data:image` (PNG, JPEG, GIF or
WebP). External URLs are rejected so that an author cannot use an image as a
tracking pixel and collect readers' addresses. Older external values are
replaced with an empty string on read. Images inside article and news HTML are
removed by the sanitizer for the same reason.

A response to an unknown login takes as long as a wrong password for an
existing user: the empty case runs a throwaway PBKDF2 verification. Otherwise
a list of live accounts could be harvested by timing the responses.

### Allowed host names

`AllowedHosts` in the shared `appsettings.json` stays `*` for development,
because the name depends on the machine. In production the backend refuses to
start until the real site names are listed. Set it through an environment
variable:

```powershell
$env:AllowedHosts = "forum.example.com;www.forum.example.com"
```

Names are separated by semicolons and carry no port. nginx and Caddy have the
same filter of their own (`server_name` and the block name), but relying on it
alone is not enough: Kestrel can be reached bypassing the proxy unless the
binding is loopback only.

Login and register have separate per-address rate limits. Login additionally
counts attempts per account name (10 per 15 minutes): brute forcing one
account from many addresses gives a single attempt per address and slips
straight past a per-address counter. A password change is limited to five
attempts per 15 minutes per user, comment creation to eight per minute per
user/address pair, and article creation to ten per hour per account. The `429`
response carries `Retry-After` and the `too_many_attempts` code.

Comment replies are limited to five levels of nesting, the same as in the
interface. Recursive read and hard-delete queries additionally stop after
eight levels so that damaged legacy data cannot create an unbounded CTE. A
hard delete of such an anomalous thread ends with a conflict instead of a
partial delete and requires a manual data check first.

An administrator cannot directly reset the password of another administrator
or of the owner, and cannot revoke administrator rights — only the owner can.
Without that rule the other restrictions would be bypassed in two steps:
demote a peer, then seize the account.

## Running behind a reverse proxy

The backend is designed for a single node: state lives in SQLite and in
process memory. TLS, HTTP/2 and serving the built frontend are normally handled
by nginx or Caddy in front of Kestrel — a supported setup that has to be
configured on both sides.

On the proxy side `X-Forwarded-For` is mandatory: without it Kestrel sees the
proxy's own address, the rate limiter counts every visitor as one client, and
ten failed sign-ins by anyone lock the whole site out for 15 minutes.

nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name forum.example.com;

    root /var/www/dnd-forum;
    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5107;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

Caddy sets `X-Forwarded-For` and `X-Forwarded-Proto` on its own:

```caddy
forum.example.com {
    root * /var/www/dnd-forum
    handle /api/* {
        reverse_proxy 127.0.0.1:5107
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

The frontend and `/api` are served from one origin — required by the `Secure`
session cookie, see "Authentication and CSRF". The backend sets HSTS itself,
but on the external HTTPS response it has to come from the proxy.

`X-Forwarded-Proto` is as mandatory as `X-Forwarded-For`. Without it the
backend treats the request as unencrypted, and since the session and
antiforgery cookies are marked `Secure` they are never issued over a plain
channel — neither sign-in nor any changing action works.

So that this does not look like a random breakage, outside development such
requests get `421 Misdirected Request` with the `insecure_transport` code, and
a single `DndForum.Transport` log entry per process explains what to fix. The
exception is `GET /api/health`: it stays reachable over HTTP because it is
polled locally, bypassing the proxy (docker healthcheck, systemd, monitoring).

### Interface binding

Unless an address is supplied from outside, the backend listens on the
loopback interface only, `http://127.0.0.1:5107`. That makes the API
unreachable around the proxy, so neither TLS nor client address detection can
be bypassed.

When the application and the proxy live in different containers or on
different machines, loopback is not enough — set the address through an
environment variable or a command line argument:

```powershell
$env:ASPNETCORE_URLS = "http://0.0.0.0:5107"
```

The default lives in `Program.cs` rather than in `appsettings.json` on
purpose: `ASPNETCORE_URLS` lands in host configuration, which is read before
the settings file, so the file would override the environment variable and a
public binding would silently fail to apply.

A public binding together with a loopback-only trust list is inconsistent: a
proxy on another host has to be listed in `ReverseProxy:KnownProxies` or
`KnownNetworks`, otherwise its `X-Forwarded-For` is dropped. The backend warns
about this combination at startup.

### Startup diagnostics

The first lines of the log report the environment, the listening addresses and
the database path, and warn about enabled demo data and a public binding. A
missing `AllowedHosts` is treated as an error and stops the start before
migrations run.

```text
info: DndForum.Startup[0]
      Starting in Production; urls http://127.0.0.1:5107; database /srv/dnd/dndforum.db
```

That line exists mainly to verify the environment. `dotnet run` reads
`Properties/launchSettings.json`, and variables defined there override the ones
passed from outside: an attempt to start a production configuration with
`dotnet run` silently falls back to Development, with demo data and relaxed
cookies. For a local production check use `--no-launch-profile`, or better the
published build, which does not contain `launchSettings.json` at all:

```powershell
dotnet publish -c Release -o out
$env:ASPNETCORE_ENVIRONMENT = "Production"
dotnet out/backend.dll
```

Nothing has to be configured on the application side when the proxy runs on
the same host: `UseForwardedHeaders` is enabled outside development and by
default trusts the header from loopback addresses only (`127.0.0.0/8` and
`::1`). With no proxy at all the configuration is safe too — a header from an
outside client is ignored.

If the proxy lives on another host — for example the application and nginx in
separate Docker containers, and the backend sees an address like `172.18.0.5` —
declare it in the production configuration:

```json
{
  "ReverseProxy": {
    "KnownProxies": ["172.18.0.5"],
    "KnownNetworks": ["10.20.0.0/16"]
  }
}
```

The same can be passed through the `ReverseProxy__KnownProxies__0` and
`ReverseProxy__KnownNetworks__0` environment variables. Values are validated at
startup; a malformed IP or CIDR stops the application before migrations.

Never call `KnownIPNetworks.Clear()` and `KnownProxies.Clear()`. That means
"trust `X-Forwarded-For` from anyone", and the header is set by the client:
any limit is then bypassed with a random address on every request. That is
worse than not enabling the middleware at all.

To confirm the real address arrives: make 11 failed sign-in attempts from one
address and check that a second address still gets `401` rather than `429`.

## Database

The SQLite file `backend/dndforum.db` is created on the first backend start.
Data access goes through Dapper. The schema is managed by sequential SQL
migrations from `backend/Database/Migrations`; applied versions are recorded in
the `schema_migrations` table.

The database holds users and sessions, articles, likes, discussions and
comments, news, ready-made characters, campaigns and rule cards. On a normal
start migrations are applied automatically before the HTTP server comes up.

Required reference data (ready-made characters, campaigns and rules) is added
to every new database. Archive articles and news are demo data: in development
they are enabled through `Seed:DemoContent=true`, in production they are off by
default. To turn them on explicitly use the `Seed__DemoContent=true`
environment variable. The setting never deletes existing records.

Apply migrations and exit without starting the server:

```powershell
cd backend
dotnet run -- --migrate-only
```

Before moving or upgrading an existing database, stop the backend and take a
backup of `backend/dndforum.db`:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force C:\backups\dnd-forum | Out-Null
Copy-Item backend\dndforum.db "C:\backups\dnd-forum\dndforum-$stamp.db"
```

Run experimental migrations on a copy only, with a separate connection string:

```powershell
Copy-Item backend\dndforum.db C:\temp\dndforum-migration-check.db
$env:ConnectionStrings__Default = "Data Source=C:\temp\dndforum-migration-check.db"
dotnet run --project backend -- --migrate-only
Remove-Item Env:ConnectionStrings__Default
```

If a migration or `pragma_foreign_key_check` fails, its transaction is rolled
back and the version is not written to `schema_migrations`. Do not rerun the
migration on the live database before finding the cause. For
`003_owner_uniqueness.sql` first make sure that at most one account has
`IsOwner = 1`.

A manual backup and restore smoke check runs without touching the live file:

1. Create a backup of the stopped database and a separate migration copy with
   the commands above.
2. Run `--migrate-only` on the migration copy, then start the backend with that
   connection string and check `/api/health`, `/api/articles` and `/api/news`.
3. Copy the backup to a new `C:\temp\dndforum-restore-check.db`, run
   `--migrate-only` on it and repeat the same API checks.

For a real restore stop the backend, keep the damaged file under a new name,
copy the chosen backup to `backend/dndforum.db`, then run `--migrate-only`
first and start the API only after it succeeds.

Data can be inspected with a SQLite client or through the API:

```text
http://localhost:5107/api/articles
http://localhost:5107/api/news
http://localhost:5107/api/presets
```

A completely fresh install only needs the database file to be absent: it will
be created on start. Do not delete a live database whose data has to be kept.

## Environment quirk

When `NODE_ENV=production` is set, a plain `npm install` may skip the
development tooling:

```powershell
$env:NODE_ENV = "development"
npm install --include=dev
```
