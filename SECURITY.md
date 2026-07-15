# Security notes — mapped to OWASP Top 10 (2021)

This is an honest account of what's actually enforced, what changed in this pass, and
what still needs a decision or a setting on your end. Nothing here is theoretical —
every fix below corresponds to a specific gap that existed in the first version of
this schema/app.

## A01 — Broken Access Control

**Fixed.** This was the real gap in Phase 1: any signed-in user could read the full
row of *every* competition — including all player names and match scores — not just
ones they organized or had been approved into. The approval workflow only gated who
counted as an official participant, not who could see the data.

Now:
- `competitions` SELECT requires being the organizer or an **approved** member
  (`membership_requests.status = 'approved'`)
- Lightweight discovery (so people can still browse what exists and request to join)
  goes through `public.competition_listings`, a view that deliberately excludes the
  `data` column — name, type, status, tags, player count, nothing else
- Every write policy (`INSERT`/`UPDATE`) now has an explicit `WITH CHECK`, not just
  `USING` — this closes the gap where a crafted update could otherwise try to smuggle
  in a different `organizer_id`
- `membership_requests` updates are restricted at the **column** level
  (`grant update (status, decided_at)`) — even for rows an organizer legitimately
  owns, they can never repoint a request at a different `user_id` or `competition_id`
- A user can only ever insert a membership request for themselves, and only as
  `pending` — never pre-approved

## A02 — Cryptographic Failures

Password hashing is handled entirely by Supabase Auth (bcrypt), never by this code —
raw passwords never touch the database or my JS. Two things you control:

- **Password minimum length**: I bumped the client-side check to 10 characters, but
  the client-side check is only a UX nicety — the real enforcement has to happen in
  **Supabase Dashboard > Authentication > Policies**. Set it to match (10+; NIST
  guidance favors length over complexity rules).
- **Transport**: Supabase URLs are HTTPS-only by default, and every static host
  suggested in `README.md` serves HTTPS by default too. Nothing to configure, just
  don't host this over plain HTTP somewhere that allows it.

## A03 — Injection

- **SQL injection**: not applicable in practice — every query goes through Supabase's
  query builder (`.eq()`, `.insert()`, etc.), which parameterizes values. There's no
  raw string-concatenated SQL anywhere in `index.html`.
- **XSS**: audited every place user-controlled text (names, error messages) gets
  written into the page — all of it already goes through `escapeHtml()`. This matters
  more than usual here because Supabase session tokens live in browser storage; if
  stored XSS were possible, that's a session-hijack path, not just a defacement.
- Added a **Content-Security-Policy** meta tag restricting script sources to `'self'`
  and the pinned jsDelivr CDN only — no inline scripts, no `eval`. One relaxation:
  `style-src` allows `'unsafe-inline'` because the app uses inline `style=""`
  attributes throughout. That's a real (if minor) loosening — moving those to CSS
  classes would let this tighten further, but the more important half (script
  execution) stays strict.

## A04 — Insecure Design

- The `UNIQUE (competition_id, user_id)` constraint on `membership_requests` already
  prevented request-spamming a single competition.
- Submit buttons disable while a request is in flight (`state.busy`), which is a
  minor UX/abuse mitigation, not a real rate limit.
- **Not done here, worth adding before wide use**: CAPTCHA on signup (Supabase
  supports hCaptcha/Turnstile natively — Dashboard > Authentication > Bot Protection)
  and reviewing **Authentication > Rate Limits** for the defaults. These require
  external service keys I can't provision for you.

## A05 — Security Misconfiguration

- RLS is enabled on all three tables, confirmed by `alter table ... enable row level
  security` on every one — a table with no RLS enabled at all would otherwise be
  wide open regardless of policies.
- Added the CSP above.
- **HTTP-level headers I can't set via HTML** (`X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) are in
  `_headers` in this folder — that file's format works directly on Netlify; if you
  host elsewhere, the same three headers need to be configured in whatever your host
  calls its headers/rewrites config.
- **Before inviting real people**: turn "Confirm email" back on
  (Authentication > Providers > Email) — the README suggests leaving it off only for
  local testing convenience, and that's a real gap if left off in production, since
  anyone could register with an email they don't own.

## A06 — Vulnerable and Outdated Components

- The Supabase JS client was loading as `@2` (floating to whatever the latest v2.x
  happens to be at page-load time) — pinned to `@2.45.4` instead. Floating versions
  mean your app's behavior can change without you touching anything, for better or
  worse; pin, and update deliberately.
- **Recommended next step**: add a Subresource Integrity hash to the script tag
  (`integrity="sha384-..."`) so the browser refuses to run the file if that exact CDN
  response is ever tampered with. I didn't fabricate one — a wrong hash silently
  breaks the whole app — generate it yourself once you've picked a version:
  `curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4 | openssl dgst -sha384 -binary | openssl base64 -A`

## A07 — Identification and Authentication Failures

- **Fixed**: login failures now always show "Email o contraseña incorrectos"
  regardless of which one was actually wrong, or whether the account exists at all —
  the previous version surfaced Supabase's raw error message, which differs enough
  between "no such user" and "wrong password" to enumerate registered emails.
- **Fixed**: the forgot-password flow shows the same confirmation message whether or
  not the email is registered, for the same reason.
- Added a password-reset entry point (`resetPasswordForEmail`) — previously missing
  entirely, which is itself a security-relevant gap (no recovery path pushes people
  toward weak, memorable, reused passwords).
- Session tokens are managed by Supabase's client library using its default storage
  and refresh-token rotation — verify **Authentication > Sessions** reflects a token
  lifetime you're comfortable with.

## A08 — Software and Data Integrity Failures

Covered by the version pinning and SRI guidance under A06.

## A09 — Security Logging and Monitoring Failures

- Added an `updated_at` column + trigger on `competitions`, so there's at least an
  honest "last modified" timestamp beyond `created_at`.
- Supabase's own **Logs** section (Auth logs, API logs) is your actual audit trail —
  nothing in this app duplicates that, and it shouldn't need to.

## A10 — Server-Side Request Forgery

Not applicable to this architecture — there's no server-side code here making
outbound requests based on user input; Supabase's API is the only backend, and it's
not proxying arbitrary URLs on your behalf.

## Summary: what you still need to do yourself

None of this is code I can write for you — these are Supabase Dashboard settings:

1. Authentication > Policies: set password minimum length to 10+
2. Authentication > Providers > Email: turn Confirm email back on before real use
3. Authentication > Rate Limits: review the defaults
4. Authentication > Bot Protection: consider enabling CAPTCHA
5. Host-level headers: apply `_headers` (or your host's equivalent) at deploy time
6. Generate and add an SRI hash once you've settled on a supabase-js version
