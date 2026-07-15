# Liga Tracker — Web (Phase 1)

Multi-user, hosted version of Liga Tracker. This first phase covers: sign up / log in,
create a League as an organizer, manage its players and match results, and view
standings — all backed by a real shared database instead of your browser's storage.

Not included yet (next phases): Tournament and Season types, the join-request workflow
for registered users, tags/search, and the 8-theme system. Those build on this same
foundation.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account + new project.
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema

1. In your Supabase project, open **SQL Editor**.
2. Paste in the entire contents of `schema.sql` from this folder and run it.
3. You should see three new tables under **Table Editor**: `profiles`, `competitions`,
   `membership_requests`.

## 3. Get your API keys

1. In your Supabase project, go to **Project Settings > API**.
2. Copy the **Project URL** and the **anon public** key (not the `service_role` key —
   that one must never appear in frontend code).
3. Open `index.html` in a text editor and find this block near the top of the
   `<script>` tag:

   ```js
   const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```

   Replace both placeholder strings with your actual values.

## 4. Recommended Auth settings

- **Authentication > Policies**: set minimum password length to at least 10, to
  match what the app's signup form already expects.
- **Authentication > Providers > Email**: while testing locally, you can turn off
  **Confirm email** to skip that step — turn it back on before inviting real people,
  so accounts can't be created with emails the person doesn't actually own.

See `SECURITY.md` for the full reasoning (mapped to OWASP Top 10) behind these and a
few other settings worth reviewing before this goes live with real users.

## 5. Try it locally

Just open `index.html` directly in your browser — no build step, no server needed for
local testing (Supabase is a plain HTTPS API, it works fine from a `file://` page).

## 6. Host it for real

Once it works locally, put `index.html` **and `_headers`** on any static host so
other people can reach it — Netlify, Vercel, GitHub Pages, or Cloudflare Pages all
have free tiers and work by just dragging the files in or connecting a repo. The
`_headers` file (Netlify's format) applies a few extra security headers at the HTTP
level that can't be set from inside the HTML itself — see `SECURITY.md`. If you're
not on Netlify, translate those same three headers into your host's config format.

The `SUPABASE_URL`/`SUPABASE_ANON_KEY` values are meant to be public (that's what Row
Level Security in `schema.sql` is for), so there's no secret-management step here.

## Notes on how this maps to the original app

- Every league's `players` and `matches` live in one `jsonb` column (`competitions.data`),
  the same shape the original single-file app used with `localStorage`. The
  fixture-generation and standings math (`generateFixtures`, `computeStandings`, etc.)
  is copied verbatim — same functions, same tested behavior.
- What's new is everything *around* that: accounts, ownership (`organizer_id`), and
  permissions enforced server-side via Row Level Security policies in `schema.sql`,
  instead of the old model where anyone with the file could edit anything.
- I can't test this against a live Supabase project from where I'm building it — I've
  verified the fixture/standings logic still behaves identically to the original (no
  duplicate pairings, correct point totals), but the Supabase wiring itself (auth,
  insert/update/RLS) needs a real run-through on your end. If something doesn't work,
  the browser console (F12) and Supabase's **Logs** section are the first places to look.
