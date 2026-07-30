# Luna Forms Portal

Internal forms portal for Coffee Cartel. Staff sign in, file entries against the
forms they have been granted, and an admin controls who can see what — per person,
per form.

**Live:** https://luna-forms-portal.vercel.app

## Stack

Next.js 15 (App Router) · React 19 · Supabase (Postgres + Auth) · CSS Modules ·
deployed on Vercel

No UI framework and no CSS framework — styling is hand-written CSS Modules.

## How access control works

Two grant levels per form:

| Level | Can do |
|---|---|
| `submit` | Open the form, file entries, see **only their own** submissions |
| `view_all` | Everything above, plus see **all** submissions for that form |

Enforcement sits in two independent layers:

1. **Server Components** check the grant before rendering, so a form a user
   cannot access never has its HTML generated
2. **Postgres RLS policies** re-check on every query

A bug in the first layer cannot leak rows on its own. The dimmed "No access"
cards on the dashboard are presentation only — they are never what keeps data
private.

## Routes

| Route | Who | What |
|---|---|---|
| `/` | anyone | Sign in — password, or magic link |
| `/dashboard` | signed in | Form cards, locked where no grant exists, plus your submissions |
| `/forms/store-purchase` | granted only | The one implemented form |
| `/admin` | admin only | Resolve access requests, grant and revoke per form |

Eight further forms are seeded as `coming_soon` and have no routes yet.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

Full setup, including the database migration, is in [SETUP.md](SETUP.md).

## Contributing

Read [AGENTS.md](AGENTS.md) first — it covers the invariants that are not
obvious from the code, particularly around access control and the shared
production database.

`main` is protected. Branch, open a PR, get a review.
