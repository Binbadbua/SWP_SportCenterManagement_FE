# SWP SportCenter — how to run the project

This repository has two parts:

| Folder | What it is | Tech |
|---|---|---|
| `SWP_SportCenter.Api`, `SWP_SportCenter.Service`, `SWP_SportCenter.Repository` | Back-end REST API | ASP.NET Core 8, EF Core 8, PostgreSQL |
| `SWP_SportCenter.FrontEnd` | Front-end website + staff area (all UI/UX lives here) | React 19, React Router 7, Vite 8 |

What was fixed in the back-end, with before/after code, is in **[BACKEND_FIXES.md](BACKEND_FIXES.md)**.

---

## 1. Install these first (once per computer)

| Tool | Version | Check with | Download |
|---|---|---|---|
| .NET SDK | **8.0.x** (the SDK, not only the runtime) | `dotnet --list-sdks` | https://dotnet.microsoft.com/download/dotnet/8.0 |
| PostgreSQL | 14 or newer | `psql --version` | https://www.postgresql.org/download/ |
| Node.js | **20.19+ or 22.12+** | `node --version` | https://nodejs.org |
| EF Core CLI | 8.x | `dotnet ef --version` | `dotnet tool install --global dotnet-ef --version 8.*` |

> `global.json` pins the .NET SDK to **8.0.x**. If you only have .NET 9 or 10 installed, `dotnet build` fails with
> *"A compatible .NET SDK was not found"*. Install the .NET 8 SDK next to it (they can live side by side).

---

## 2. Run the back-end

### 2.1 Point the API at your database

Open `SWP_SportCenter.Api/appsettings.Development.json` and set **your** PostgreSQL user and password:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost:5432;Database=sport;Username=postgres;Password=YOUR_PASSWORD"
}
```

Better (keeps your password out of Git) — use user secrets instead of editing the file:

```bash
cd SWP_SportCenter.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost:5432;Database=sport;Username=postgres;Password=YOUR_PASSWORD"
```

### 2.2 Create the database tables

From the repository root:

```bash
dotnet ef database update --project SWP_SportCenter.Repository --startup-project SWP_SportCenter.Api
```

This creates the `sport` database (if it doesn't exist) and all tables from the `Initial` migration.

> **The database must use UTF-8.** Vietnamese names (e.g. *Bơi lội*) fail to save in a `WIN1252` database with
> *"character with byte sequence … has no equivalent in encoding WIN1252"*.
> Check with `SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = 'sport';`
> If it isn't `UTF8`, drop it and create it again before running the migration:
> `CREATE DATABASE sport WITH ENCODING 'UTF8' TEMPLATE template0;`

### 2.3 Start the API

```bash
dotnet run --project SWP_SportCenter.Api --launch-profile http
```

- API: http://localhost:5047
- Swagger (try every endpoint): http://localhost:5047/swagger

---

## 3. Run the front-end

In a **second** terminal:

```bash
cd SWP_SportCenter.FrontEnd
npm install          # first time only
cp .env.example .env # first time only (Windows PowerShell: Copy-Item .env.example .env)
npm run dev
```

Open http://localhost:5173.

The dev server forwards every `/api/...` request to the back-end (see `vite.config.js`), so you don't need to set up CORS for development.

**If the back-end is not running**, the website still opens and shows *"Showing sample data"* with example content. Start the API and press **Try again**.

Build for production: `npm run build` → static files in `SWP_SportCenter.FrontEnd/dist`.

---

## 4. Signing in (preview)

There is **no login API yet** (`/api/auth/*` is still to do), so the sign-in page lets you pick a role:
Member, Coach, Receptionist or Manager.

- **Member** → website + *My account* (bookings, attendance…)
- **Coach / Receptionist / Manager** → staff area at http://localhost:5173/staff (menu changes per role)

Pages that call the API need **real IDs from your database**. On the sign-in page open
**"Use IDs from your database"** and paste, for example, a `member.member_id` or `coach.coach_id`.

### Demo data to get started

Accounts, members and receptionists have no API yet, so add a few rows with SQL (pgAdmin or `psql`):

```sql
INSERT INTO account (account_id, username, password, role, status) VALUES
 ('11111111-1111-1111-1111-111111111111','member1','x',1,1),   -- role 1 = Member
 ('22222222-2222-2222-2222-222222222222','coach1','x',2,1),    -- role 2 = Coach
 ('33333333-3333-3333-3333-333333333333','recep1','x',3,1),    -- role 3 = Receptionist
 ('44444444-4444-4444-4444-444444444444','manager1','x',4,1);  -- role 4 = Center manager

INSERT INTO member (member_id, full_name, dob, gender, phone, email, avatar, training_goal, account_id, "CreatedAt")
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Nguyễn Văn An','2000-01-01T00:00:00Z','Male',
        '0900000001','an@test.com','','Lose weight','11111111-1111-1111-1111-111111111111', now());

INSERT INTO receptionist (receptionist_id, full_name, phone, email, working_shift, account_id, "CreatedAt")
VALUES ('bbbbbbbb-0000-0000-0000-000000000001','Bùi Thanh Tâm','0900000002','tam@test.com','Morning',
        '33333333-3333-3333-3333-333333333333', now());
```

Then, signed in as **Manager** in the staff area:

1. **Sports** → add a sport, **Rooms** → add a room.
2. **Coaches** → add a coach with Account ID `22222222-2222-2222-2222-222222222222`.
3. **Classes** → add a class, **Schedule** → add sessions.
4. Sign in as **Member** with Member ID `aaaaaaaa-0000-0000-0000-000000000001` and book the class on the website.

---

## 5. Moving to another computer — what to configure

| What | Where | When to change it |
|---|---|---|
| Database connection string | `SWP_SportCenter.Api/appsettings.Development.json` or `dotnet user-secrets` | **Always** — every computer has its own PostgreSQL password/port. |
| Database encoding | PostgreSQL | Must be `UTF8` (see 2.2). |
| .NET SDK version | `global.json` | Install .NET 8 SDK. Don't edit `global.json` unless the whole team upgrades. |
| API port (`5047`) | `SWP_SportCenter.Api/Properties/launchSettings.json` → `applicationUrl` | Only if 5047 is already used. Then also change `VITE_API_PROXY_TARGET` in `SWP_SportCenter.FrontEnd/.env`. |
| Front-end → API address | `SWP_SportCenter.FrontEnd/.env` → `VITE_API_PROXY_TARGET` | If the API runs on another port or another machine. |
| Front-end port (`5173`) | `SWP_SportCenter.FrontEnd/vite.config.js` → `server.port` | Only if 5173 is used. Then add the new address to `Cors:AllowedOrigins` in `appsettings*.json`. |
| CORS allowed origins | `appsettings.json` / `appsettings.Development.json` → `Cors:AllowedOrigins` | When the website is served from a different address than `http://localhost:5173` (e.g. a deployed site). |
| JWT settings | `appsettings*.json` → `JwtOptions` | Not used yet. Before release, move `SecretKey` to user secrets / environment variables. |
| Node packages | `SWP_SportCenter.FrontEnd/node_modules` | Never copy this folder — run `npm install` on each computer. |

Environment variables work too (useful on servers). Use `__` for nested keys, for example:

```bash
ConnectionStrings__DefaultConnection="Host=...;Database=sport;Username=...;Password=..."
Cors__AllowedOrigins__0="https://your-site.example.com"
```

---

## 6. Front-end structure

```
SWP_SportCenter.FrontEnd/
├─ public/images/          sport photos (Unsplash licence)
├─ src/
│  ├─ api/
│  │  ├─ client.js         fetch wrapper, turns API errors into readable messages
│  │  ├─ endpoints.js      every endpoint the back-end has today
│  │  ├─ previewStore.js   in-browser data for features with NO API yet
│  │  └─ mockData.js       sample data (offline mode + previews)
│  ├─ components/          buttons, cards, header, footer, modal, toasts…
│  ├─ context/AuthContext  preview sign-in (replace with /api/auth/login later)
│  ├─ layouts/             StoreLayout (website) and StaffLayout (staff area)
│  ├─ pages/store/         Home, Classes, ClassDetail, Schedule, Memberships, Coaches, Account, Login, Register, Help
│  ├─ pages/staff/         Dashboard, Attendance, Bookings, CrudPage + resources.jsx (all list/edit pages)
│  └─ styles/              base (design tokens), components, store, staff
└─ vite.config.js          dev server + /api proxy
```

### Which pages use the real API

| Uses the API now | UI preview only (marked **Preview**) — API not built yet |
|---|---|
| Classes, class detail, schedule, coaches, sports, rooms | Sign-in / register |
| Booking and cancelling a class | Members, receptionists, accounts |
| Attendance (take and view) | Membership packages, memberships, payments |
| Invoices, center managers, audit log | Training plans and results |
| Coach: my classes, my members | Notifications, reports (dashboard numbers), member profile |

**To connect a preview page when its API is ready:** add the endpoint to `src/api/endpoints.js`, then in
`src/pages/staff/resources.jsx` change `source: preview.xxx` to `source: api.xxx`. The page itself doesn't change.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `A compatible .NET SDK was not found` | Install the .NET 8 SDK (see section 1). |
| `dotnet ef` is not recognised | `dotnet tool install --global dotnet-ef --version 8.*`, then open a new terminal. |
| `password authentication failed for user "postgres"` | Wrong password in the connection string (section 2.1). |
| `... has no equivalent in encoding "WIN1252"` | The database isn't UTF-8 — recreate it (section 2.2). |
| Website shows *"Showing sample data"* | The API isn't running, or it runs on a different port than `VITE_API_PROXY_TARGET`. |
| `Failed to bind to address http://127.0.0.1:5047` | Port 5047 is in use — close the other API window or change the port (section 5). |
| Browser console: *blocked by CORS policy* | You opened the site from an address not listed in `Cors:AllowedOrigins`. |
| Staff form shows *"Tài khoản này không có vai trò …"* | The Account ID you entered has a different role — check `account.role`. |
