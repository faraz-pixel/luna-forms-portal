# Onboarding — start here

For anyone joining this project. Assumes you have never used git or GitHub.

If a step fails, jump to [When something goes wrong](#when-something-goes-wrong)
at the bottom.

---

## What this project is

An internal web portal for Coffee Cartel. Staff sign in, fill in forms
(inventory, purchases), and an admin decides who is allowed to see which form.

It is live at https://luna-forms-portal.vercel.app

You will make changes on your own computer, and when they are approved they go
live automatically.

---

## The 30-second version of how this works

```
your computer  →  GitHub (the shared copy)  →  Vercel (the live website)
```

1. You copy the project to your computer
2. You make changes and describe them ("commit")
3. You send them to GitHub ("push")
4. You ask for them to be included ("pull request")
5. Faraz looks and approves
6. Vercel automatically rebuilds the live site — about 40 seconds

**You never run a deploy command.** Approval is what deploys.

---

## Part 1 — one-time setup

### Install what you need

- **Node.js** version 20 or newer — https://nodejs.org (pick the LTS download)
- **git** — https://git-scm.com/downloads (Mac: it may already be there, check
  with `git --version`)
- **GitHub CLI** — https://cli.github.com

Check all three worked. Open Terminal (Mac) or PowerShell (Windows) and run:

```bash
node --version
git --version
gh --version
```

Three version numbers means you are good.

### Accept the repo invitation

Faraz invited you. Accept it here:
https://github.com/faraz-pixel/luna-forms-portal/invitations

### Tell git who you are

Every change you make gets stamped with a name and email. Set them once:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Use the same email as your GitHub account, or GitHub will not connect your
changes to your profile.

### Log in to GitHub from the terminal

```bash
gh auth login
```

Answer the prompts:

- **What account?** → `GitHub.com`
- **Preferred protocol?** → `HTTPS`
- **Authenticate Git with your GitHub credentials?** → `Yes`
- **How to authenticate?** → `Login with a web browser`

It shows you an 8-character code, then opens your browser. Paste the code, click
Authorize. Back in the terminal it says `Logged in as yourusername`.

You only ever do this once per computer.

---

## Part 2 — get it running on your computer

### Copy the project down

```bash
git clone https://github.com/faraz-pixel/luna-forms-portal.git
cd luna-forms-portal
```

`clone` means "download a full copy, including its history". The `cd` moves you
into the folder — run every later command from there.

### Install the project's dependencies

```bash
npm install
```

This reads `package.json` and downloads the libraries the project needs into a
`node_modules` folder. Takes a minute. That folder is deliberately not stored in
git — it is rebuilt from `package.json` on every machine.

### Add the settings file

The project needs to know which database to talk to. Create a file named exactly
`.env.local` in the project folder, containing the three values Faraz gives you:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is ignored by git on purpose — it never gets uploaded. Anything
secret goes in here and nowhere else.

### Start it

```bash
npm run dev
```

Open http://localhost:3000. Sign in with the email and password Faraz set up for
you. You are now running the real app against the real database, on your own
machine.

Leave that command running while you work — it reloads automatically when you
save a file. Press `Ctrl+C` to stop it.

---

## Part 3 — make a change and get it live

This is the loop you will repeat forever. Five commands.

### 1. Start a branch

```bash
git checkout -b fix-the-header
```

A **branch** is a separate line of work. It means you can change things without
affecting the live site or anyone else. Name it after what you are doing.

`main` is the special branch that represents the live site. You are not allowed
to change `main` directly — that is deliberate.

### 2. Make your change

Edit files normally in your editor. Check it looks right at
http://localhost:3000.

### 3. Check it builds

```bash
npm run build
```

**Do not skip this.** It catches mistakes that `npm run dev` lets through. If it
prints errors, fix them before continuing. If it ends with a list of routes, you
are fine.

### 4. Save and send your change

```bash
git add .
git commit -m "Fix the header alignment on mobile"
git push -u origin fix-the-header
```

Three separate things, which is confusing at first:

- `git add .` — choose what to include ( `.` means everything you changed)
- `git commit -m "..."` — save it locally with a description
- `git push` — upload it to GitHub

The message matters. "Fix the header alignment on mobile" is useful later;
"changes" and "update" are not.

### 5. Ask for it to go live

```bash
gh pr create --fill
```

This opens a **pull request** — a request to pull your branch into `main`. It
prints a link. Send that link to Faraz.

Within a minute or so, a bot comments on the pull request with a **preview URL** —
a complete private copy of the site with only your change in it. Open it. Check
your change works there, not just on your machine. Share that link with Faraz so
he can see it too.

### 6. Faraz approves

He clicks Approve, then Merge. Vercel rebuilds and the change is live at
https://luna-forms-portal.vercel.app in about 40 seconds.

### 7. Get back in sync and go again

```bash
git checkout main
git pull
```

`checkout main` switches you back to the main line. `pull` downloads everything
that changed while you were working — including your own merged change. Now
start your next branch from Part 3 step 1.

---

## What Faraz does (so you both know)

When a pull request arrives:

1. Open the link, click the **Files changed** tab to see exactly what changed
2. Open the **preview URL** the bot posted, click around, check it actually works
3. If good → **Approve**, then **Merge pull request**
4. If not → leave a comment saying what to fix. The developer pushes more commits
   to the same branch and the pull request updates itself

Merging is what deploys. There is no separate deploy step, and nothing reaches
the live site without a merge.

---

## Part 4 — Supabase (the database)

Supabase holds the accounts, the permissions, and every form submission.

### If you only need to look at data

Ask Faraz for access to the Supabase dashboard. Then **SQL Editor → New query**:

```sql
select ref_number, user_email, created_at
from submissions
order by created_at desc
limit 20;
```

`select` queries are safe — they read and change nothing.

### ⚠️ There is only one database

Your computer, the preview URLs, and the live site **all talk to the same
database.** There is no separate test copy.

That means:

- Test submissions you create are real rows in the real table
- Any change you make to a table affects the live site immediately
- There is no undo

Prefix obvious test data so it can be found and cleaned up later.

### Creating new tables

You may well need to. Two hard rules.

**Rule 1 — always enable RLS on a new table.**

```sql
create table my_new_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- NOT OPTIONAL:
alter table my_new_table enable row level security;

create policy my_new_table_select on my_new_table
  for select to authenticated
  using (user_id = auth.uid() or is_admin());
```

**Why this matters more than it looks:** the key the browser uses to talk to
Supabase is public — it ships inside the website to every visitor. The only thing
stopping a stranger reading a table is its RLS policy. **A new table without RLS
enabled is readable by anyone on the internet.** Not "insecure in theory" —
actually readable, today, by anyone who looks.

The helper functions `is_admin()` and `grant_level('form-slug')` already exist;
use them in your policies rather than inventing new logic.

**Rule 2 — write changes as a new migration file, and never edit `0001_init.sql`.**

Add `supabase/migrations/0002_whatever.sql` with your statements, so the next
person setting this up gets the same database you have. Run it in the SQL Editor
yourself, then commit the file.

Additive only. Never `drop table`, never `drop column`, never `alter column` on
something with data in it, in a migration file.

### Ask before you run it

If a statement contains `drop`, `delete`, `truncate`, or `alter ... type`, send
it to Faraz before running it. On a shared production database that is a
five-minute conversation instead of a lost afternoon.

---

## Read this too

[AGENTS.md](AGENTS.md) covers the rules that are not obvious from reading the
code — particularly why access checks must stay on the server, and why you must
never use Supabase's `sb_secret_...` key. It is short. Read it before your first
change.

---

## When something goes wrong

**`gh: command not found`**
GitHub CLI is not installed, or the terminal was open before you installed it.
Close the terminal, open a new one, try again.

**`Permission denied` or `403` when pushing**
Either you have not accepted the repo invitation, or you are pushing to `main`.
Check with `git branch --show-current`. If it says `main`, you skipped making a
branch — see below.

**You edited files while on `main` by mistake**
Nothing is lost. Move your work onto a branch:
```bash
git checkout -b my-change
git add .
git commit -m "Describe what you did"
git push -u origin my-change
```

**`npm run dev` fails with "supabase url is required" or a blank page**
`.env.local` is missing, misnamed, or has a typo. It must be exactly
`.env.local`, in the project root, and you must restart `npm run dev` after
creating it — it is only read at startup.

**The site loads but you cannot sign in**
Your account may not exist yet, or was created without **Auto Confirm User**
ticked. Ask Faraz to check.

**`npm run build` fails but the site looked fine in dev**
Normal — `build` is stricter. Read the first error, not the last. Fix it before
pushing.

**Your pull request says "This branch is out-of-date"**
Someone merged something while you were working:
```bash
git checkout main
git pull
git checkout your-branch-name
git merge main
git push
```

**You are lost and want to see where you are**
```bash
git status                 # what have I changed?
git branch --show-current  # which branch am I on?
git log --oneline -5       # what were the last 5 changes?
```

`git status` is the single most useful command in git. When confused, run it.
