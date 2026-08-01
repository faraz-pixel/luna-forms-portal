# Codex Project Handover — Luna Forms Portal

Updated: 2026-07-31

This handover is for the new Luna Forms Portal repository only.

- Repository: faraz-pixel/luna-forms-portal
- Local path: /Users/fc/Library/CloudStorage/GoogleDrive-faraz@coffeecartel.pk/My Drive/Forms Portal dynamic/luna-forms-portal-github-live
- Production URL documented by the repository: https://luna-forms-portal.vercel.app
- Supabase URL supplied for this portal: https://lommvbgfsnlsvyuxslzu.supabase.co

Do not merge PR #7, copy code from another project, or treat the old portal/source folder as this application. This document records state only; it is not deployment authorization.

## 1. Project purpose and architecture

Luna Forms Portal is an internal Coffee Cartel portal for authenticated staff to use controlled operational forms. The current reference form is Stock Inward / Store Purchase. Admins manage access grants and users. The Accounts role is intended to manage vendor bills, credit-term endorsement, due dates, payments, and payable aging.

Architecture:

- Next.js App Router application under src/app.
- Supabase Auth for authentication.
- Supabase Postgres for profiles, grants, forms, submissions, and Accounts billing data.
- Supabase Row Level Security (RLS) for database authorization.
- Server Components and Server Actions for server-side authorization and writes.
- Client components for interactive forms and tables.
- Vercel is connected to GitHub: branch pushes create previews; merging main deploys production. There is no manual vercel deploy step.
- Google Sheets are configuration/reporting support only. Postgres is the source of truth for submitted accounting data. src/lib/sheets.js performs an optional best-effort submission mirror.

Security rules from AGENTS.md:

- The repository is public; never commit credentials.
- Use only the Supabase publishable/anon key in application configuration, never a Supabase secret key.
- Keep server authorization and RLS together. Do not replace protected policies with public USING (true) policies.
- Use supabase.auth.getUser(), not getSession(), for authorization decisions.
- The shared Supabase project is production data; migrations and test submissions affect live data.

## 2. Current active branch

Current local branch: feature/accounts-billing-controls

Current commit: 9f2d26c Standardize displayed dates across portal

Tracking branch: origin/feature/accounts-billing-controls.

The working tree was clean before this handover file was added. The local origin/main observed during this handover was:

a9096e7 Merge pull request #6 from faraz-pixel/implement-luna-form-workflows

The feature branch is not assumed to be production. Verify GitHub and Vercel before relying on this snapshot.

## 3. Work completed in this conversation

Existing work already in main / PR #6:

- Supabase publishable-key environment variable support was added while retaining legacy anon-key compatibility.
- Stock Inward vendor-entry fields were changed to show Vendor Bill details.
- Vendor Billing / Direct Purchase no longer shows the bottom Proof Details attachment.
- The attachment label is Vendor Bill.
- Amount fields use the accounting-style display equivalent of _(#,##0_);[Red](#,##0).
- Formatted amounts are parsed before server-side validation and storage.
- Vendor bill number and amount are included in Stock Inward receipt/print details.

Accounts billing feature on the feature branch:

- Added Accounts Team role support: admin, accounts, member.
- Added role management in the Admin page.
- Added /billing for Accounts/Admin users.
- Added vendor bill creation from new Vendor Billing / Direct Purchase Stock Inward submissions.
- Added a backfill from historical Vendor Billing submissions into vendor_bills.
- Added Accounts endorsement of credit terms.
- Due dates remain null/hidden until Accounts/Admin endorses credit terms.
- Added vendor payable summary with oldest due date first, vendor/status filters, balances, paid amounts, payable status, and overdue days.
- Added payment recording against vendor bills.
- Added /admin/kpi with basic user/team activity counts.
- Added date display standardization on the Accounts payable table, payment-date control, and Dashboard to dd-mmm-yy, for example 31-Jul-26.
- Date values remain stored/submitted as ISO dates; only visible display changed.
- Added a client-side normalization step so visible 12,389 is submitted as numeric 12389.

Product/master-data analysis:

The private Google Sheet was analyzed from the supplied screenshot. Its Stock & Inventory tab visibly contains columns including Item- Group, Product/ Item, and Materials/ Measure Unit Base. The application still uses hard-coded product arrays in src/lib/forms/store-purchase.js; the sheet is not connected to the live dropdown. No inventory_items table or secure Sheet-to-Supabase sync exists yet.

## 4. Files created or modified

Commit 6cb3377 Add accounts billing controls and KPI views:

- src/app/admin/AdminClient.jsx — Member/Accounts Team role selector.
- src/app/admin/actions.js — setUserRole server action.
- src/app/admin/page.js — role display and KPI link.
- src/app/admin/kpi/page.js — user/team KPI counts.
- src/app/billing/BillingClient.jsx — payable table, filters, endorsement, payment controls.
- src/app/billing/actions.js — endorseVendorBill and recordVendorPayment server actions.
- src/app/billing/page.js — Accounts-protected payable page and summary query.
- src/app/billing/page.module.css — payable-page styling.
- src/app/dashboard/page.js — Accounts/Admin payable link.
- src/app/forms/store-purchase/actions.js — creates a vendor_bills row after Vendor Billing submission.
- src/lib/auth.js — requireAccounts authorization helper.
- supabase/migrations/0004_accounts_billing_controls.sql — Accounts billing database objects and RLS.

Commit 16e72a6 Normalize formatted vendor bill amount on submit:

- src/app/forms/store-purchase/StorePurchaseForm.jsx — retains formatted display text but passes parsed numeric vendorBillAmount to submitStorePurchase.

Commit 9f2d26c Standardize displayed dates across portal:

- src/lib/date.js — shared formatDate(value) returning dd-mmm-yy.
- src/app/billing/BillingClient.jsx — formats invoice/due dates and uses a visible payment-date control.
- src/app/billing/page.module.css — date-control styling.
- src/app/dashboard/page.js — shared Dashboard date formatter.

Existing relevant files:

- src/lib/forms/store-purchase.js — Stock Inward option lists and validateStorePurchase.
- src/lib/forms/amount.js — parseAmount and formatAmount.
- src/lib/forms/submission.js — shared submission write and optional Sheet mirror.
- src/lib/sheets.js — best-effort Google Sheet mirror.
- src/lib/forms/validation-options.js — local validation arrays for locations, banks, vendors, and payment categories.
- src/app/forms/store-purchase/StorePurchaseForm.jsx — Stock Inward UI and receipt/print output.
- src/app/forms/store-purchase/page.js — protected Stock Inward route.
- src/app/forms/bank-payment-data/BankPaymentDataForm.jsx and actions.js — payment form and server write.
- src/app/forms/vendor-kyc/VendorKycForm.jsx and actions.js — internal Vendor KYC flow.
- src/app/admin/AdminClient.jsx, src/app/admin/actions.js, and src/lib/auth.js — admin access controls.
- AGENTS.md and ONBOARDING.md — repository workflow and security instructions.

This handover task creates/updates only this documentation file. No application code should be changed to update it.

## 5. Database tables, views, functions, policies, and migrations

Migration supabase/migrations/0001_init.sql:

Tables: app_config, profiles, forms, grants, access_requests, submissions.

Functions/triggers:

- is_admin() — SECURITY DEFINER admin check.
- grant_level(p_slug text) — returns current-user grant level.
- handle_new_user() — creates a profile after Supabase Auth signup and promotes the configured admin email.
- Trigger on_auth_user_created on auth.users.

Important RLS policy names: app_config_admin, profiles_select, profiles_update_own, profiles_admin_write, forms_select, forms_admin_write, grants_select, grants_admin_write, access_requests_select, access_requests_insert_own, access_requests_admin_update, submissions_insert, submissions_select, and submissions_admin_write.

Migration supabase/migrations/0002_rename_store_purchase_form.sql:

Renames/updates Store Purchase form catalog wording. Inspect it before re-running in any environment.

Migration supabase/migrations/0003_luna_demo_form_catalog.sql:

Adds/updates Luna demo form catalog entries. It is catalog seed data, not the Accounts billing schema.

Migration supabase/migrations/0004_accounts_billing_controls.sql:

Required before /billing can work against Supabase. It creates:

- Table vendor_bills with source_submission_id, vendor_name, bill_number, invoice_date, bill_amount, attachment_name, created_by, credit_terms_days, credit_terms_status, terms_endorsed_by, terms_endorsed_at, due_date, status, and timestamps. It has unique constraints on source_submission_id and (vendor_name, bill_number).
- Table vendor_payments with vendor_bill_id, payment_date, amount, payment_reference, payment_method, entered_by, and created_at.
- View vendor_payables_summary, calculating paid_amount, balance, payable_status, and days_overdue.
- Function set_vendor_bill_due_date().
- Trigger vendor_bill_due_date on vendor_bills.

The trigger sets due_date only when credit_terms_status = endorsed and required endorsement fields exist. Otherwise it clears the due date. The migration backfills eligible historical submissions rows where form_slug = store-purchase and payload.entryType = Vendor Billing / Direct Purchase.

RLS policies created by 0004: vendor_bills_select, vendor_bills_insert, vendor_bills_accounts_update, vendor_payments_select, and vendor_payments_accounts_write.

Migration 0004 status: VERIFIED APPLIED to the connected production Supabase project. /billing depends on this and is unblocked at the database level.

Migration supabase/migrations/0005_vendor_master.sql:

Created in this session. NOT YET APPLIED to any Supabase environment. It creates:

- Table vendors with vendor_code, name, status, source, tax profile fields, payment defaults, contact/bank fields, and audit timestamps.
- Table vendor_mappings to match raw historical name strings to canonical vendor IDs.
- Adds vendor_id FK column on vendor_bills referencing vendors(id).
- Index on vendor_bills(vendor_id).
- RLS policies: vendors_select, vendors_insert, vendors_update, vendor_mappings_all.
- Helper function get_next_vendor_code().
- Seeds all 57 existing approved vendor names.
- Backfills vendor_mappings and links vendor_bills rows to matched vendor IDs.
- Recreates vendor_payables_summary view to join vendors by ID (falling back to vendor_name string).

Migration 0005 status: CREATED BUT NOT APPLIED. An authorized database operator must review and run it once against the intended Supabase project before /admin/vendors has live data or vendor_id links are stored on new submissions.

## 6. Important technical decisions

- This is a new portal. Do not import old-portal code, deployment settings, database assumptions, or credentials.
- Supabase/Postgres is the accounting-data source of truth. Google Sheets are configuration and optional reporting support, not the primary submission database.
- Keep historical field meaning stable. Prefer additive migrations and inactive/renamed options over deletion.
- Keep server authorization and database RLS together.
- Use supabase.auth.getUser(), not getSession(), for authorization decisions.
- Vendor due dates must not appear until Accounts/Admin endorses credit terms; the database trigger is the final guard.
- Amounts display comma grouping and parenthesized negatives, while validation/storage use numeric values.
- Dates display as dd-mmm-yy; stored values remain ISO/date values.
- A future product master-data design should use an additive inventory_items table with stable product key, group/name/unit, active status, sort order, and audit fields. It does not exist yet.
- Testing access remains limited to approved users. Do not make unfinished areas public.
- Current file fields capture filenames in the browser; secure storage/upload handling is still required for production-grade uploads.

## 7. Current unresolved issue and exactly where work stopped

Work stopped after commit 9f2d26c was pushed to origin/feature/accounts-billing-controls.

1. The local branch is feature/accounts-billing-controls at 9f2d26c.
2. The date update was pushed to the feature branch.
3. The user showed PR #8, titled Standardize displayed dates across portal, open with automated checks passed but review required.
4. GitHub offered Merge without waiting for requirements to be met (bypass rules) / Bypass rules and merge. This session did not merge it.
5. Earlier Accounts billing work was associated with PR #7. Per the explicit handover instruction, PR #7 must not be merged or copied by the next session. Verify live GitHub/main state before any action.
6. Production deployment was not verified after the date change.
7. Migration 0004 is VERIFIED APPLIED — this item is resolved.
8. Migration 0005 (vendor master) has been created but not applied. An authorized database operator must review and run supabase/migrations/0005_vendor_master.sql against the production Supabase project. Until applied, /admin/vendors returns empty data and vendor_id is not stored on new submissions; the form falls back to the hard-coded vendor list.
9. The product list is not connected to Supabase or a secure Sheet sync; products remain hard-coded.

If continuing, first verify which PRs are open/merged and what origin/main contains. Do not assume a screenshot, local branch, or Vercel preview means production is updated.

## 8. Commands already run and results

git status --short --branch

Result before this documentation file: clean feature branch tracking origin/feature/accounts-billing-controls.

git log --oneline --decorate -8

Relevant result:

9f2d26c (HEAD -> feature/accounts-billing-controls, origin/feature/accounts-billing-controls) Standardize displayed dates across portal
16e72a6 Normalize formatted vendor bill amount on submit
6cb3377 Add accounts billing controls and KPI views
a9096e7 (origin/main, origin/HEAD) Merge pull request #6 from faraz-pixel/implement-luna-form-workflows

npm run build

Result: passed twice. Next.js compiled, lint/type validity checks passed, static generation completed, and route output was produced.

git diff --check

Result: passed for application changes.

git push origin feature/accounts-billing-controls

Result: initial DNS failure, retry succeeded; remote branch advanced from 16e72a6 to 9f2d26c.

gh pr checkout 7

Result: initial GitHub API connection failure, retry succeeded. The checkout remained on feature/accounts-billing-controls.

gh pr view 7 --json number,title,state,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,url,baseRefName,headRefName

Observed result at that time: PR #7 was open, not draft, checks successful, reviewDecision REVIEW_REQUIRED, and mergeStateStatus BLOCKED. This may have changed; verify live.

No Supabase SQL migration was executed by this session. No production database rows were intentionally changed by this session.

## 9. Build, lint, and test status

- npm run build: passed after amount normalization and again after date standardization.
- git diff --check: passed for application changes.
- npm run lint: unavailable; no lint script is defined in package.json.
- Automated tests: none are defined in package.json or repository guidance.
- RLS tests: not present; this is a known gap and high priority before widening access.
- Repository guidance notes two high npm audit advisories under Next dependencies. Do not run npm audit fix --force; it can downgrade Next to 9.3.3.

## 10. Git commits and pull requests

Commits created/observed:

- 6cb3377 Add accounts billing controls and KPI views
- 16e72a6 Normalize formatted vendor bill amount on submit
- 9f2d26c Standardize displayed dates across portal

Pull requests:

- PR #6: earlier amount/vendor-proof work; observed merged into main as part of a9096e7.
- PR #7: Accounts billing controls, payables aging, credit-term endorsement, and user KPIs. Observed blocked for required review at one point. Do not merge or copy it under this handover instruction.
- PR #8: Standardize displayed dates across portal, shown by the user as open with checks passed and approval required. Date commit: 9f2d26c. This session did not merge it.

Refresh all PR statuses with GitHub before deployment.

## 11. Items that must not be merged or copied from the old portal

- Do not merge PR #7 under this handover instruction.
- Do not copy old-portal code, migrations, .env files, Supabase settings, Vercel settings, or authentication assumptions.
- Do not copy Google Sheet/API credentials, Apps Script tokens, Supabase secret keys, service-role keys, or browser-exposed private credentials.
- Do not replace new-portal RLS with public policies.
- Do not make the portal, repository, unfinished forms, previews, or private data public without explicit approval.
- Do not run destructive SQL, drop tables, delete submissions, or reset production data.
- Do not treat the old Google Form as production Vendor KYC; the intended internal route is /forms/vendor-kyc.
- Do not treat the old Google Sheet as the accounting database.

## 12. Clear next steps for another Codex session

1. Read AGENTS.md, ONBOARDING.md, and this file before touching code.
2. Run git status --short --branch and verify branch/uncommitted state.
3. Refresh GitHub PR/main state. Confirm PR #8 and PR #7 status, but do not merge PR #7 under this instruction.
4. If deployment is explicitly approved, inspect the intended PR diff and use the protected-branch workflow. Confirm Vercel production after merge; preview is not production.
5. Before enabling /billing, inspect Supabase schema/migration history and confirm whether 0004_accounts_billing_controls.sql is applied. If not, an authorized database operator must review and run it once in the intended project.
6. Verify Accounts authorization with admin, Accounts, and member users. Confirm /billing and payment writes are denied for members.
7. Verify pending terms hide due dates, endorsement sets due dates, and direct invalid updates are rejected by trigger/RLS.
8. Test Vendor Billing with formatted 12,389, vendor bill filename, invoice date, vendor, location, and valid products. Confirm the submission and, after migration, its vendor_bills row.
9. Verify visible dates display dd-mmm-yy while database values remain date/ISO values.
10. Plan product master-data separately. Design/review an additive inventory_items table and secure Sheet sync before replacing hard-coded product lists.
11. Add RLS/integration tests before widening access or automating payments.
12. Keep testing private/protected and record future work in a new PR and updated handover.

## Private backup

A private local backup was created before Accounts billing feature work:

/Users/fc/Library/CloudStorage/GoogleDrive-faraz@coffeecartel.pk/My Drive/Forms Portal dynamic/_private_backups/luna-forms-portal-2026-07-31-before-control-center

It is outside Git history, owner-only, and not a production deployment or substitute for version control.

