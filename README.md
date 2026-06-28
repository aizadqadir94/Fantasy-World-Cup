# Fantasy Knockout Online — Supabase Version

This version stores players, PINs, fixtures, predictions, sessions, locks, and results in Supabase Postgres.
It is safe for Render Free because data is not stored on Render's temporary filesystem.

## Required environment variables on Render

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`
- `SESSION_SECRET`

Never put the service role key in frontend code or GitHub.

## Supabase setup

1. Create a free Supabase project.
2. Open SQL Editor.
3. Paste and run the contents of `supabase_schema.sql`.
4. Go to Project Settings / API Keys and copy:
   - Project URL
   - service_role key
5. Put those into Render Environment Variables.

## Render setup

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

## Data persistence

Render can restart or sleep. That is fine. Your data stays in Supabase.

Supabase Free projects can pause after a week of inactivity. Pausing should not delete your data, but the app may need the project to be restored if nobody uses it for a week.
