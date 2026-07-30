# Luna Forms Portal — setup

A Next.js portal for Coffee Cartel's internal forms, with magic-link sign-in and
per-person, per-form access controlled by an admin.

This is a **separate app** from the Vite branch form at the repository root.
Both stay live; they do not share a database or a spreadsheet.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Any region near
   Karachi (e.g. `ap-south-1`) is fine. Save the database password somewhere.
2. Once it finishes provisioning, open **SQL Editor** → **New query**.
3. Paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and
   **Run**.

   This creates the tables, the RLS policies, the profile-creation trigger, and
   seeds the 9 form rows. It is safe to re-run.

4. Set the admin email. The migration seeds `CHANGE-ME`, so this step is
   required, not optional:

   ```sql
   update app_config set value = 'you@yourdomain.com' where key = 'admin_email';
   ```

   Do this **before** that person's first sign-in — the role is assigned when
   their profile row is created. If you miss it, fix it after the fact with:

   ```sql
   update profiles set role = 'admin' where email = 'you@yourdomain.com';
   ```

## 2. Configure auth

In the Supabase dashboard:

- **Authentication → Providers → Email**: enable it, and turn **Confirm email**
  on. Magic links need no password.
- **Authentication → URL Configuration**:
  - Site URL: your deployed origin (e.g. `https://luna-forms-portal.vercel.app`)
  - Redirect URLs: add both
    `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`

  Sign-in fails with "requested path is invalid" if the callback URL is missing.

Supabase's built-in email sender is rate-limited (a few per hour) and is fine for
testing. For real use, set a custom SMTP provider under **Project Settings →
Auth → SMTP Settings**, or magic links will start silently failing.

## 3. Environment variables

Copy `.env.example` to `.env.local` for local dev, and set the same keys in
**Vercel → Project Settings → Environment Variables**.

| Key | Required | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same page. Safe to expose — RLS is the protection |
| `NEXT_PUBLIC_SITE_URL` | yes | the deployed origin |
| `SHEETS_ENDPOINT` | no | Apps Script `/exec` URL (step 4) |
| `SHEETS_TOKEN` | no | must match `TOKEN` in the Apps Script |
| `ADMIN_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM` | no | enables email alerts on new access requests |

Leaving the optional ones blank degrades gracefully: submissions still save to
Postgres, requests still appear in `/admin`.

## 4. Google Sheets mirror (optional)

1. Open the Google Sheet that should collect Store Purchase rows.
2. **Extensions → Apps Script**, paste
   [`google-apps-script/StorePurchase.gs`](google-apps-script/StorePurchase.gs).
3. Change `TOKEN` to a long random string.
4. Run `setupSheet` once, granting permissions when asked.
5. **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone**.
6. Put the `/exec` URL in `SHEETS_ENDPOINT` and the same token in `SHEETS_TOKEN`.

Access must be "Anyone" because Vercel posts without a Google identity — the
token is what actually stops strangers writing rows. Keep it secret.

---

## Signing in

Two modes, both on the login page.

**Password (default).** The admin creates accounts in the Supabase dashboard:
**Authentication → Users → Add user**, enter the email and a password, and tick
**Auto Confirm User** — without that tick the account cannot sign in. The person
then signs in with those credentials. No email is sent at any point.

The profile row and admin role are assigned by a database trigger on
`auth.users`, so it makes no difference whether an account was created from the
dashboard or by a magic link — both get the right role.

**Magic link.** Available behind "Email me a sign-in link instead". Requires
working email, which means custom SMTP (see below).

### Why password is the default

Supabase's built-in mailer allows roughly **two messages per hour**, project-wide
— it is a smoke-test facility, not a mail service. Past that, magic links stop
arriving with no visible error. Custom SMTP lifts the limit, but the usual route
for a Google Workspace domain (an app password on `smtp.gmail.com`) needs app
passwords enabled by the Workspace admin, which is not always possible.

Password sign-in removes email from the critical path entirely. Set up SMTP when
you can — access-request notifications use it too — but nothing is blocked
without it.

## How access works

New accounts land on an empty dashboard where every form is **locked**, with a
Request Access button.

The admin resolves requests at `/admin`, granting one of two levels per form:

| Level | Can do |
|---|---|
| `submit` | Open the form, file entries, see **only their own** submissions |
| `view_all` | Everything above, plus see **all** submissions for that form |

The admin implicitly holds `view_all` on every form.

**Enforcement is in two independent layers.** Pages are Server Components that
check the grant before rendering, so a locked form's HTML is never sent. Beneath
that, Postgres RLS policies re-check on every query — so a bug in the page layer
still cannot leak rows. The dimmed "No access" cards are presentation only; they
are never the thing keeping data private.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

## Known gaps

- The other 8 forms are seeded as `coming_soon` and have no routes yet. They
  appear on the dashboard but cannot be opened or granted.
- `npm audit` reports 2 high advisories (`postcss`, `sharp`) reachable only as
  transitive dependencies of `next`. `npm audit fix --force` "resolves" them by
  downgrading Next to 9.3.3, which is not a fix. They clear on a future Next
  release.
- There are no automated tests. The RLS policies in particular deserve them.
