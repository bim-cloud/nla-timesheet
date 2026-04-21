# NLA Timesheet

Web dashboard for **Nature Landscape Architects** — daily timesheet entry, project tracking, team overview and desktop-agent activity monitoring.

Live app: https://nla-timesheet.vercel.app

---

## What's inside

| File / folder | What it is |
|---|---|
| `index.html` | Main dashboard — employee + manager views, login, users admin |
| `agent.html` | Mockup of the Windows desktop-agent UI |
| `*.jsx` | React components (loaded via Babel in the browser — no build step) |
| `*.css` | Styles |
| `assets/` | Logo and static assets |

No bundler, no framework install — everything loads directly from `index.html`/`index.html` via CDN-hosted React + Babel.

---

## Local preview

Any static file server works. Easiest:

```bash
# with Python (comes with macOS / most Linux)
python3 -m http.server 8080

# OR with Node
npx serve .
```

Then open <http://localhost:8080/NLA%20Timesheet.html>.

---

## Seeded login accounts

The current build stores users in `localStorage` (demo only — see **Production TODO** below).

**Admins (Manager view)**

| Username | Password |
|---|---|
| `admin`   | `admin123`  |
| `sanil`   | `welcome123` |
| `adithya` | `welcome123` |

**Employees**

| Username | Password |
|---|---|
| `afsal`, `sandra`, `rivin`, `mehnas`, `elbin` | `welcome123` |

Everyone lands on the employee view. Managers unlock the manager view from the top-bar toggle (re-asks for the password).

---

## Deploy to Vercel (5 min)

1. Push this repo to GitHub (already configured — see `vercel.json`).
2. On [vercel.com](https://vercel.com) → **Add New → Project → Import** this repo.
3. Framework Preset: **Other**. Build command / output directory: leave blank.
4. Click **Deploy**. You'll get `nla-timesheet-xxx.vercel.app` in ~30 s.
5. Optional: Settings → Domains → add `timesheet.naturelandscape.ae`, then point the CNAME at your domain registrar.

Every `git push` to `main` auto-deploys.

---

## Production TODO — wire Supabase

This prototype stores everything in `localStorage` so each browser sees only its own data.
To make it a real multi-user app, swap the `Auth` module and `data.jsx` out for [Supabase](https://supabase.com).

**1. Tables to create (SQL Editor):**

```sql
create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  name text not null,
  role text not null,
  user_type text not null check (user_type in ('employee','manager')),
  initials text,
  tz text default 'Asia/Dubai',
  tz_label text default 'UAE',
  created_at timestamp default now()
);

create table entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  date date not null,
  project_id text not null,
  hours numeric not null,
  notes text,
  status text default 'draft',
  created_at timestamp default now()
);

create table app_usage (
  id bigserial primary key,
  user_id uuid references profiles(id) not null,
  date date not null,
  app_key text not null,
  focus_seconds integer not null,
  sampled_at timestamp default now()
);

alter table profiles  enable row level security;
alter table entries   enable row level security;
alter table app_usage enable row level security;

create policy "own profile"       on profiles  for all    using (auth.uid() = id);
create policy "mgr sees all"      on profiles  for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.user_type = 'manager')
);
create policy "own entries"       on entries   for all    using (auth.uid() = user_id);
create policy "mgr read entries"  on entries   for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.user_type = 'manager')
);
create policy "own app usage"     on app_usage for all    using (auth.uid() = user_id);
create policy "mgr read usage"    on app_usage for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.user_type = 'manager')
);
```

**2. In the dashboard code:**
- Replace `auth.jsx` `Auth` object with calls to `supabase.auth.signInWithPassword()` / `signUp()` / `signOut()`.
- Replace the in-memory sample data in `data.jsx` with Supabase queries (`supabase.from('entries').select()`).

---

## Windows Desktop Agent — separate project

The `.exe` agent is **not part of this repo** — it's a separate Electron (or Tauri) project that:

1. Samples the foreground window + idle time every 5 s.
2. POSTs app-usage samples to Supabase REST API (`/rest/v1/app_usage`).
3. Lives in the system tray.

See `agent.html` for the UI mockup. A freelancer can build this in ~2–3 weeks for $3–5k plus a code-signing cert (~$300/yr).

---

## Project structure

```
├── index.html                  # main entry (/ route)
├── agent.html                  # agent UI (/agent route)
├── app.jsx                     # App shell, routing, Tweaks
├── auth.jsx                    # login screen + Auth store (localStorage)
├── auth-components.jsx         # UserMenu, UsersAdmin, IdleModal
├── activity-monitor.jsx        # Manager → Activity monitor tab
├── chrome.jsx                  # Sidebar + Topbar
├── employee.jsx                # Employee dashboard
├── manager.jsx                 # Manager dashboard
├── data.jsx                    # Sample data (replace with Supabase)
├── icons.jsx                   # Inline stroke icons
├── styles.css                  # Base styles
├── auth.css                    # Auth + admin styles
├── activity-monitor.css        # Activity monitor tab styles
├── agent.css                   # Agent UI styles
├── assets/
│   └── nature-logo.png
└── vercel.json                 # Vercel config
```

---

## License

Internal / proprietary — © Nature Landscape Architects.
