# Working on this repo

Notes for anyone — human or agent — making changes to the Luna Forms Portal.

## Deploying

**You do not run `vercel deploy`.** The repo is connected to Vercel:

- Push a branch → Vercel builds a **preview** deployment at its own URL
- Merge to `main` → Vercel deploys to **production** at
  https://luna-forms-portal.vercel.app

`main` is protected and requires one approving review, so the flow is:

```bash
git checkout -b your-change
# ...edit...
npm run build          # must pass before you push
git push -u origin your-change
gh pr create --fill    # then wait for review
```

Do not try to push straight to `main` — it will be rejected.

## This repository is public

Anyone can read it. Before every commit, assume a stranger will:

- **Never commit real credentials.** `.env.local` is gitignored; keep it that way.
  Only `.env.example` (placeholders) belongs in git.
- Secrets committed here are public **the moment you push**, and stay in the git
  history even after a later "fix" commit. Rotate anything leaked, don't just
  delete it.

## Never use the Supabase secret key

The app uses the **publishable** key (`sb_publishable_...`) only. The
`sb_secret_...` key bypasses every Row Level Security policy — it can read and
write every table as any user. It has no legitimate use in this codebase. Do not
add it to env vars, do not use it to "make a query work".

If a query returns nothing and you think you need the secret key, the real
answer is almost always that an RLS policy is correct and you are querying as
the wrong user.

## The database is production

There is **one** Supabase project, shared by local dev, preview deploys, and
production. Consequences:

- Test submissions you create land in the real submissions table
- A migration you run affects live data immediately
- `supabase/migrations/0001_init.sql` is written to be re-runnable. Keep it that
  way, and check every statement is still idempotent before you extend it. Note
  that the `app_config` insert uses `on conflict do nothing` specifically so
  re-running cannot overwrite the configured admin email.

Prefer additive migrations. Never `drop table` in a migration file.

## The access-control invariant

Two independent layers enforce who can see what:

1. **Server Components** check grants before rendering
   (`requireUser`, `requireAdmin`, `requireFormAccess` in `src/lib/auth.js`)
2. **RLS policies** re-check on every query in Postgres

Both must stay in place. Specifically:

- Do not move access decisions into client components. A locked form's data must
  never reach the browser — hiding it with CSS is not access control.
- Do not add `USING (true)` to a policy on `submissions`, `grants`,
  `access_requests`, or `profiles` to "fix" a query.
- Use `supabase.auth.getUser()`, never `getSession()`, to gate anything.
  `getSession()` trusts the cookie without revalidating it.
- Validate form input server-side against the option lists in
  `src/lib/forms/<slug>.js`. The client renders from the same arrays, so a
  hand-crafted POST cannot smuggle in an unknown product or location.

`forms` is deliberately readable by every signed-in user — that is what lets
locked cards render at all. That one is intentional; leave it.

## Adding a form

1. Add a row to the `forms` seed in the migration (`status: 'coming_soon'`)
2. Create `src/lib/forms/<slug>.js` with the option lists and a validator
3. Create `src/app/forms/<slug>/page.js` as a Server Component that calls
   `requireFormAccess(FORM_SLUG)` before rendering anything
4. Put the interactive UI in a sibling client component
5. Put the write in a Server Action that re-checks the grant
6. Flip the row to `status: 'active'` only once the route exists — an `active`
   form with no route is a 404 on the dashboard

Copy `store-purchase` as the reference implementation.

## Local setup

See [SETUP.md](SETUP.md). Short version:

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

## Known gaps

- No automated tests. The RLS policies deserve them most.
- 8 of the 9 forms are `coming_soon` with no routes.
- `npm audit` shows 2 high advisories under `next` (postcss, sharp).
  `npm audit fix --force` "fixes" them by downgrading Next to 9.3.3 — do not
  run it. They clear on a future Next release.
