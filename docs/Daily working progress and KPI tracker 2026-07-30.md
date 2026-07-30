# Luna Forms Portal - Daily Working Progress and KPI Tracker

Date: 2026-07-30  
Owner: Faraz  
Phase: Local testing/demo  
Production deployment: Not approved

## Today's outcome

The local portal now has a usable testing dashboard and three reviewable demo forms. The main Stock Inward workflow has been separated into vendor purchase, commissary dispatch, and branch transfer behavior. Shared validation lists, searchable dropdowns, required-field checks, and the Bank Payment Data demo are in place for local review.

## KPI snapshot

| KPI | Today | Target/status |
| --- | ---: | --- |
| Reviewable demo forms | 3 | Met for current testing phase |
| Coming-soon form cards | 3 | Met: Staff Penalties, Karachi Club POS Data, Staff Onboarding |
| Main form workflows | 3 | Met: vendor billing, commissary dispatch, branch transfer |
| Validation master-data areas mapped | 6 | In progress: Location, Vendor List, Bank names, Luna Banks, Payment Category, Stock & Inventory |
| Searchable dropdown fields | 10+ | In progress across demo forms |
| Required conditional fields | Implemented | Needs broader cross-form testing |
| Phone/email/IBAN validation rules | Implemented locally | Needs live backend validation review |
| Local route checks | Passing | Dashboard, Stock Inward, Vendor KYC, Bank Payment Data |
| Production deployment | 0 | Correct for this phase; tech review required |
| Real database/file storage | Not connected | Pending Supabase and secure storage setup |

## Completed today

- Added local demo mode so the portal can be reviewed without production Supabase credentials.
- Renamed the main workflow to `Stock Inward Entry`.
- Added Entry Type-driven behavior with automatic read-only transaction direction.
- Added vendor billing fields: vendor, invoice number, invoice date, bill amount, and bill attachment.
- Added commissary dispatch and branch transfer workflow options.
- Added location validation and branch transfer From/To Location fields.
- Added mandatory proof details before Additional Info where required.
- Added fixed product headings: `Product / Item`, `Unit - Weight / Measure`, and `Qty`.
- Added searchable dropdown behavior with rejection of unmatched typed values.
- Added internal Luna-themed Vendor KYC demo at `/forms/vendor-kyc`.
- Added `Add New Vendor` routing to the internal Vendor KYC demo.
- Added phone format validation: `0300-1234567`.
- Added email format and 24-character IBAN validation for the Vendor KYC demo.
- Added Bank Payment Data demo at `/forms/bank-payment-data`.
- Added payment mode options: `Cheque` and `Online`.
- Added Luna bank, payment category, vendor, and payment-location list mappings for local demo use.
- Added dashboard cards for Staff Penalties, Karachi Club POS Data, and Staff Onboarding as Coming Soon.
- Updated the process documentation for the tech guy.

## Current local testing links

- Dashboard: `http://localhost:3000/dashboard`
- Stock Inward Entry: `http://localhost:3000/forms/store-purchase`
- Vendor KYC: `http://localhost:3000/forms/vendor-kyc`
- Bank Payment Data: `http://localhost:3000/forms/bank-payment-data`

The local preview is for this laptop only. It is not a remote testing link and it is not the live portal.

## What to test today

1. Open each active form and confirm the visual layout remains consistent.
2. Select every Entry Type in Stock Inward Entry and confirm only the correct conditional fields appear.
3. Type an invalid location, vendor, product, or unit and confirm submission is blocked with a clear error.
4. Test the searchable dropdowns using partial text and then select the matching option.
5. Confirm Vendor Billing requires invoice number, invoice date, amount, vendor bill, products, and proof.
6. Confirm Bank Payment Data uses the intended payment mode, Luna bank, vendor, location, and category lists.
7. Confirm the three Coming Soon cards do not open unfinished workflows.

## Open work for the tech guy

- Connect Supabase securely and configure Vercel environment variables.
- Replace local validation arrays with secure Google Sheet sync or backend-managed validation tables.
- Implement real authentication, approved-user access, and per-form permissions.
- Add secure file uploads for bills, proofs, and Vendor KYC documents.
- Implement database-backed submissions, response viewing, exports, downloads, and PDF/print support.
- Implement email notifications to the submitter and approved internal recipients.
- Complete the Vendor KYC approval flow and write approved vendors to `Vendor List`.
- Add backend validation so browser-side checks cannot be bypassed.
- Review encryption, tokens, Supabase RLS, audit logging, and production deployment settings.

## Next-day KPI targets

- Complete one full test pass for each active form.
- Record at least three valid and three invalid dropdown tests.
- Confirm all Google Sheet tab names and column rules.
- Document any missing locations, vendors, banks, products, or payment categories.
- Keep production deployment at zero until the tech review is complete.

## Change log

Update this file at the end of each working day with:

- what was completed;
- what was tested and passed;
- what remains blocked;
- the next-day targets;
- the date and person responsible for each follow-up.
