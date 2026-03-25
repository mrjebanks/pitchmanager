# Gregson Lane JFC Pitch Manager V1.1

Baseline release: `V1.1`

The app now supports two operating modes:

- `Local mode`: no Supabase config, data stays in the browser.
- `Hosted mode`: Supabase-backed shared data, login, admin/viewer accounts, per-user write access, and per-user tab visibility overrides.

## Current Backup

- Code snapshot archive: `backups/pitch-management-v1.1-code-2026-03-25.zip`
- Git baseline commit: `e770296` (`chore: baseline v1.1 snapshot`)

Note: browser data is still separate from the code. Use **Export Data** in the app if you want the current live planner data backed up too.

## Run Locally

1. Open `index.html` directly, or serve the folder with a simple local server.
2. With the default `config.js`, the app runs in local browser-storage mode.

Optional local server:

```powershell
cd "c:\Pitch management"
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Recommended Hosted Stack

- Frontend hosting: `Netlify`
- Auth, database, and admin function: `Supabase`

This keeps the app static and simple to manage while adding shared login and shared data.

## Supabase Setup

1. Create a Supabase project.
2. In the SQL editor, run [supabase/schema.sql](/c:/Pitch%20management/supabase/schema.sql).
3. In `Auth -> Users`, create at least two users:
   - one admin account
   - one viewer account
4. Promote the admin account in SQL:

```sql
update public.user_profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

5. Deploy the Edge Function in [supabase/functions/admin-users/index.ts](/c:/Pitch%20management/supabase/functions/admin-users/index.ts).
6. In Supabase Edge Function secrets, set:
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Copy your project URL and anon key into [config.js](/c:/Pitch%20management/config.js).

## Netlify Deploy

1. Push this folder to GitHub.
2. Create a new Netlify site from that repository.
3. Netlify will publish the project root using [netlify.toml](/c:/Pitch%20management/netlify.toml).
4. After deploy, confirm `config.js` contains the correct Supabase URL and anon key.

## Permissions Model

- Roles:
  - `admin`: write by default, full tab access
  - `viewer`: read-only by default
- Per-user overrides:
  - optional write-access override
  - optional tab visibility override per tab

The `Users` tab is admin-only.

## Notes

- `Export Data` works in both local and hosted mode.
- `Import Data` requires write access.
- Hosted mode currently stores the planner as one shared JSON document in Supabase. That is fine for a small number of users, but it is still a shared document model rather than a fully normalized multi-user backend.
