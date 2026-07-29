# Luna Forms Portal — auth, roles, and per-form access

**Date:** 2026-07-29
**Status:** Implemented (pending Supabase project + deploy)

## Problem

`luna-forms-portal/` was a Next.js 15 app with no backend. Sign-in was a 1.5s
`setTimeout` that redirected anyone to the dashboard; the dashboard's stats,
submissions table, and user identity were hardcoded; the store-purchase form's
submit was a fake delay that saved nothing. Two dashboard links pointed at
`/forms`, a route that did not exist, producing 404s.

The ask: real authentication, an admin (`faraz@coffeecartel.pk`) who can grant
individual people access to individual forms, an access-request flow for
everyone else, and a locked state on forms a person cannot use.

## Key constraint

Blurring or hiding a section in the browser is presentation, not access control.
If the page receives the data, it is readable in DevTools regardless of CSS. Any
design that satisfies "other people can't see this" must refuse on the server.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Auth + data store | Supabase | Magic-link email built in (no separate mail provider for sign-in), Postgres, and RLS to enforce access in the database |
| Grant model | Per-form, two levels: `submit`, `view_all` | Matches the real case — a clerk files entries but should not read other branches' data |
| Locked UX | Cards visible, dimmed, with Request Access | Lets people discover what exists so they can ask for it; server still sends no data |
| Submissions | Postgres source of truth, best-effort mirror to Google Sheets | Postgres is needed for per-user filtering; the Sheet preserves the existing reporting workflow |
| Requests | `/admin` page + optional email alert | In-app approval with per-form level toggles; email so requests aren't missed |
| Enforcement | Server Components + Server Actions, RLS underneath | Two independent layers; a bug in one is not a breach |
| Relationship to root Vite app | Separate forms, both stay live | Confirmed with user — portal's Store Purchase is not the branch Inward/Outward form |

## Schema

Five tables plus `app_config`:

- `profiles` — one row per user, created by trigger on first sign-in. `role` is
  `admin` or `member`; the admin is whoever matches `app_config.admin_email`.
- `forms` — the 9 cards as data, with `status` of `active` or `coming_soon`.
- `grants` — `(user_id, form_slug) → level`, unique per pair.
- `access_requests` — pending/approved/denied, with an optional message.
- `submissions` — `form_slug`, unique `ref_number`, `payload` jsonb,
  `user_email` denormalised, `sheet_synced` flag.

`payload` is jsonb because 8 more forms with different field sets are planned;
adding a form should be a row, not a migration. Field-shape validation therefore
lives in app code (`src/lib/forms/<slug>.js`) and runs in the Server Action
before insert.

`user_email` is denormalised deliberately: `profiles` RLS hides other users, so
a `view_all` holder joining `submissions → profiles` would see null for everyone
but themselves.

### RLS rules

- `forms` — readable by every authenticated user. Deliberate; it is what allows
  locked cards to render.
- `submissions` — insert requires any grant on that form and `user_id = auth.uid()`.
  Select returns all rows for the form to `view_all` holders, only own rows to
  `submit` holders, everything to admin.
- `grants`, `access_requests`, `profiles` — own rows for members, everything for
  admin. Only admin writes grants.

`is_admin()` and `grant_level()` are `SECURITY DEFINER` so policies that consult
`profiles`/`grants` do not recurse.

## Architecture

Server Components decide access before producing markup:

- `/dashboard` — `requireUser()`, then fetches forms + RLS-scoped submissions and
  computes real stats. Passes grants to a small client component for search and
  the request-access button.
- `/forms/store-purchase` — `requireFormAccess(slug)` in the page shell;
  redirects to `/dashboard?denied=...` without rendering the form.
- `/admin` — `requireAdmin()`; redirects members to the dashboard.
- `middleware.js` — refreshes the Supabase cookie and bounces anonymous traffic
  off non-public paths. Coarse only: it answers "signed in", not "may see".
- `/forms` — redirect to `/dashboard`, fixing the two 404 links.

Auth uses `getUser()` rather than `getSession()` everywhere, since `getSession()`
trusts the cookie without revalidating it.

## Incidental fixes

- `vendor-invoice` seeded as `coming_soon` — it was `active` with no route.
- Print receipt now HTML-escapes interpolated values.
- `html2canvas` moved from a runtime CDN `<script>` to a local dynamic import.
- Removed the dead "Save Draft" button (no handler was ever attached).
- Dropped `maximumScale: 1` / `userScalable: false` from viewport (WCAG 1.4.4).
- Replaced the `if (!mounted) return null` blank-flash hack, now unnecessary
  because the dashboard renders on the server.
- Product-row state no longer mutated in place.
- Reference numbers are generated server-side as `SP-YYYYMMDD-NNNN` with a
  unique constraint and retry, rather than 6 random digits client-side.

## Out of scope

The 8 unbuilt forms, automated tests, and a re-sync tool for submissions whose
Sheet mirror failed.
