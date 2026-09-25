<div align="center">

# ⚔️ D&D Forum

**A portal and forum for the Dungeons &amp; Dragons community**

Articles and lore, news, campaigns, ready-made characters and living
discussions — dressed as a rulebook, in Ukrainian and English.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![.NET](https://img.shields.io/badge/ASP.NET_Core-10-512bd4?logo=dotnet&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)

</div>

---

## About

This is not a blog with a comment box. It is where a dungeon master and their
players get ready for the session: read the lore and the rules, compare spells,
pick tonight's campaign and build a character. The interface keeps the mood of
a rulebook — parchment, runic headings, themed cursors and a d20 in place of
the usual dividers.

The project is self-contained: a React application, an ASP.NET Core API and a
single-file SQLite database. Clone it, start it with one command, sign up — the
first account becomes the owner of the forum.

## Features

### For players

- **Articles** by category — lore, rules, campaigns, characters, equipment —
  sorted by date or by likes
- **Discussions** nested up to five levels, with editing and deletion of your
  own replies
- **Ready-made characters** — a carousel of presets with stats and spells; any
  of them can be applied to your profile in one click
- **Your own character**: name, class, race, level, biography and avatar
- **Campaigns** — cards with the setting, party size and the master's notes
- **Community news** and a rules reference
- **Two locales** — Ukrainian and English, switched on the fly
- **Sign in with Google** next to the usual login and password — optional, see
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

### For authors

- Tiptap article editor: headings, lists, quotes, code and links
- The cover image is prepared in the browser and shown as the card background
- Markup passes through a tag allow list, so no foreign script reaches the page

### For administrators

- News and account management: roles, bans, password resets
- Discussion moderation, including restoring deleted threads
- A permission hierarchy with an owner whose rights cannot be taken away

## Stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19, Vite 8, Tiptap, oxlint                             |
| Backend  | ASP.NET Core 10, Minimal API, Dapper                         |
| Data     | SQLite, plain SQL migrations                                 |
| Security | HttpOnly cookie sessions, antiforgery, PBKDF2, HtmlSanitizer |

## Quick start

You need **Node.js 20.19+ or 22.12+** (required by Vite 8), **.NET SDK 10.0**
and **Git**.

```powershell
git clone https://github.com/Bahramushka/dnd_forum.git
cd dnd_forum
```

Then two terminals — the API and the site:

```powershell
cd backend
dotnet run
```

```powershell
cd frontend
npm install
npm run dev
```

The site runs at http://localhost:5173, the API at http://localhost:5107. Vite
proxies `/api` to the backend, so the browser sees a single origin.

The database is created on first run together with the ready-made characters,
campaigns and rules. In development mode demo articles and news are added too.

> **The first account registered becomes the forum owner** — sign up right
> after the first start.

## Build and check

```powershell
cd frontend
npm run lint
npm run build

cd ../backend
dotnet build
```

## Layout

```
backend/            ASP.NET Core Web API
  Api/              endpoints: articles, news, comments, profile, admin
  Database/         connection, migrations, reference data seeding
frontend/
  src/pages/        section pages
  src/components/   editor, comments, dialogs, navigation
  src/styles/       styles per section and component
docs/               operations and deployment
```

## Deployment

For a server see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): running behind nginx
or Caddy, the security model, startup diagnostics, backups and database
migrations.

## Contributing

The project is open to the community. Found a bug or want to add a section —
open an issue or send a pull request. Before submitting, run `npm run lint`,
`npm run build` and `dotnet build`.
