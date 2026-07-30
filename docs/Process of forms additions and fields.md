# Process of forms additions and fields

Created: 2026-07-30

## Working approach

Changes can be prepared locally in this copied portal folder first.

Security-sensitive work should be reviewed and completed by the developer before anything is pushed live, including:

- encryption or token handling
- authentication protocol
- access-control rules
- GitHub permissions
- Vercel deployment settings
- Supabase row-level security
- final production deployment

## Access and privacy rule

Do not make the portal, repository, forms, or unfinished work public.

The admin should be able to add users for testing, but testing access should be limited to:

- approved `coffeecartel` email accounts, or
- specific users manually approved by the admin.

Do not give broad access to all forms or unfinished areas unless the admin has approved that user and access level.

Intended testing reviewer to add through the live admin/access flow:

- `faisal@coffeecartel.pk`

## Local change process

1. Make the requested form/UI/content changes in this local folder.
2. Preview locally before deployment.
3. Record what changed in this file.
4. Let the developer review security, encryption, protocol, access control, and deployment.
5. Only then push or deploy to the live portal.

## Vercel testing deployment process

If a remote reviewer needs to see the demo from another city, do not use the production/live Vercel project directly.

Create a separate testing project in Vercel, for example:

- `luna-forms-portal-testing-jul30`

Testing deployment rules:

- Import the GitHub repo as a separate Vercel project or ask the developer to push this local testing branch first.
- Do not connect it to the production domain.
- Do not reuse production database/storage unless the developer confirms it is safe.
- For UI-only review, set `NEXT_PUBLIC_LOCAL_DEMO=true` in the testing project's Environment Variables.
- If Supabase is required for testing, use test Supabase credentials, not production credentials.
- Enable Vercel Deployment Protection or password protection if available.
- Add only approved reviewers such as `faisal@coffeecartel.pk`.
- Clearly label the project and shared link as testing only.
- After review, the developer should either remove the testing deployment or keep it separate from production.

Current testing deployment created from this local folder:

- Project: `luna-forms-portal-testing-jul30`
- Team/account: `fc-x-luna`
- Testing URL: `https://luna-forms-portal-testing-jul30.vercel.app`
- Environment variable set in Vercel Production: `NEXT_PUBLIC_LOCAL_DEMO=true`
- Verified routes:
  - `/dashboard`
  - `/forms/store-purchase`
  - `/forms/vendor-kyc`

This testing URL is for UI/workflow review only. It is not the live production portal.

## Field validation source

The Google Sheet `Forms Fields Validations` should be treated as the admin-friendly master list for dropdown values.

Sheet link:

`https://docs.google.com/spreadsheets/d/1tfttCyVzI8iWJxj_zmYN1mdqAnoGv7dYVx7sJBKUIS0/edit?gid=267151725#gid=267151725`

Current intended tab mapping:

| Sheet tab | Portal use |
| --- | --- |
| Location | All form fields that ask for a location, including Location, From Location, and To Location |
| Vendor List | Vendor Name field in Vendor Billing / Direct Purchase, and Payer Full Name in Bank Payment Data |
| Bank names | Bank Name field in Vendor KYC |
| Luna Banks | Payment From Luna Bank field in Bank Payment Data |
| Payment Category | Payment Category field in Bank Payment Data |
| Stock & Inventory | Future product/stock dropdown fields, after confirmation |

Local demo implementation:

- `src/lib/forms/validation-options.js` stores the shared `LOCATIONS` list from the sheet screenshot.
- `src/lib/forms/validation-options.js` also stores `BANK_NAMES` locally for the future Vendor KYC form.
- `src/lib/forms/store-purchase.js` imports `LOCATIONS` from that shared file.
- Future forms should import the same shared validation options instead of defining their own location lists.

Live implementation recommendation:

1. Keep Google Sheet as the simple admin-maintained source.
2. Sync sheet tabs into Supabase validation tables or read them through a secure backend-only sync job.
3. Portal forms should use searchable dropdown/autocomplete controls fed by those synced values.
4. Do not expose private sheet access tokens in browser code.
5. Show only active values if an `Active` column is added later.
6. Searchable dropdown fields must not accept unmatched free text. If the typed value does not exactly match an allowed option, show a validation error and require the user to choose from the list.
7. Any phone/contact number field in any form should use `0300-1234567` format.
8. Any email field in any form should validate as a real email format.
9. Any IBAN field should use 24 alphanumeric characters, for example `PK12ABC...`.
10. Any person/name or vendor/business-name field should require a meaningful non-empty name, trimmed before saving, and should not accept only spaces or random invalid characters.

## Vendor KYC / new vendor flow

When a user selects Vendor Billing / Direct Purchase and searches Vendor Name:

1. Vendor Name should be a searchable dropdown sourced from the `Vendor List` validation tab.
2. If the vendor is not found, show an `Add New Vendor` option.
3. In local testing, `Add New Vendor` shows an `Open Vendor KYC` link to the internal Luna-themed Vendor KYC form at `/forms/vendor-kyc`.
4. Live target: `Add New Vendor` should continue opening the internal Luna-themed Vendor KYC form, not the Google Form UI.
5. The internal Vendor KYC form should replicate the current Google Form fields from:

   `https://forms.gle/sDTLax3Hdaysbphf8`

6. Once Vendor KYC is completed and approved, the vendor should be added to the vendor master list.
7. After approval/sync, the new vendor should become selectable in Vendor Billing / Direct Purchase.

Current `Vendor List` sheet structure:

| Column | Meaning |
| --- | --- |
| Entry/update | Shows whether vendor was added manually or pushed by the Vendor KYC process |
| Vendor Name | Vendor name used in portal searchable dropdowns |

Suggested Vendor KYC fields based on the current Google Form:

| Field | Type | Required? |
| --- | --- | --- |
| Full Legal Business Name | Text | Yes |
| Business Registration Number or NTN | Text | Yes |
| SRB / PRA Number | Text | Yes |
| Business Structure | Select | Yes |
| Primary Industry | Select | Yes |
| Registered Business Address | Long text | Yes |
| Primary Contact Email Address | Email | Yes |
| Primary Contact Phone Number | Text with validation | Yes |
| Business Registration Certificate / NTN / CNIC upload | File | Yes |
| Any bill / invoice upload | File | Yes |
| Bank Account Title | Text | Yes |
| IBAN Number | Text | Yes |
| Bank Account Number | Text | No |
| Bank Name | Searchable select | Yes |
| Other Notes | Text | No |

Important live implementation notes:

- File uploads must use secure storage; the local demo can only capture filenames.
- Vendor should not appear in the purchase form until KYC is submitted and approved.
- Bank Name should come from the `Bank names` validation tab.
- If Google Sheet remains the admin source, sync approved vendor names and bank names into Supabase or a backend cache before showing them in portal dropdowns.
- To fully automate this, the developer needs edit/API access to either the Google Form response destination sheet or an internal Vendor KYC database table.
- The Vendor KYC approval process should write approved vendor names into `Vendor List` with `Entry/update` set to something like `KYC`.

## Fields to add or change

| Field name | Form/page | Type | Required? | Notes |
| --- | --- | --- | --- | --- |
| Entry Type | Stock Inward Entry | Select | Yes | Options: Vendor Billing / Direct Purchase, Commissary Dispatch to Branch, Branch to Branch Transfer |
| Vendor Name | Stock Inward Entry | Text | Conditional | Required only for Vendor Billing / Direct Purchase |
| Vendor Invoice Number | Stock Inward Entry | Text | Conditional | Required only for Vendor Billing / Direct Purchase |
| Vendor Bill / Invoice Date | Stock Inward Entry | Date | Conditional | Required only for Vendor Billing / Direct Purchase |
| Vendor Bill Amount | Stock Inward Entry | Number | Conditional | Required only for Vendor Billing / Direct Purchase |
| Vendor Bill Attachment | Stock Inward Entry | File | Conditional | Required only for Vendor Billing / Direct Purchase. Local demo captures selected filename only; live needs secure file storage |
| From Location | Stock Inward Entry | Select | Conditional | Required only for Branch to Branch Transfer |
| To Location | Stock Inward Entry | Select | Conditional | Required only for Branch to Branch Transfer |
| Dispatch / Reference Number | Stock Inward Entry | Text | Conditional | Required when receiving against a commissary or branch transfer dispatch |
| Requested By Name / Employee ID | Stock Inward Entry | Text | Conditional | Required only for Branch to Branch Transfer |
| Proof Attachment | Stock Inward Entry | File | Yes | Mandatory before Additional Info. Local demo captures selected filename only; live needs secure file storage |

## Intended one-form workflow

Keep this as one form, but do not let users manually choose professional/accounting direction values like inward/outward.

The form should set transaction direction automatically based on the selected entry workflow:

| Entry workflow | Transaction direction | User behavior |
| --- | --- | --- |
| Vendor Billing / Direct Purchase | Inward | User records vendor name, received location, products, units, and quantities received |
| Commissary Dispatch to Branch | Outward | Commissary records stock being sent to a branch; system creates a reference number |
| Branch Transfer - Send Stock | Outward | Sending branch records products and quantities being sent; system creates a reference number |
| Branch to Branch Transfer | Inward / acknowledgement | Receiving branch enters the sending reference number, then confirms received items |

In the UI, `Transaction Type` should remain visible, but as an automatically selected read-only value instead of a dropdown. Users should only choose `Entry Type`; the system should decide the transaction direction.

For branch or commissary receiving acknowledgement, the preferred final behavior is:

1. Receiver enters the dispatch/reference number.
2. Portal loads the products from the original sending entry.
3. Receiver confirms each product with a simple `Yes / No`.
4. If quantity differs, receiver can enter received quantity and discrepancy note.
5. Receiver should not refill the full procurement/vendor form when the goods came from commissary or another branch.

This reference-based receiving flow requires database lookup and access-control review before going live. It can be mocked locally for UI testing, but the developer should complete the secure implementation.

## Changes completed locally

- Local demo mode added with `NEXT_PUBLIC_LOCAL_DEMO=true` so localhost can preview without Supabase credentials.
- Store Purchase wording changed locally to Stock Inward Entry.
- Entry Type selector added locally. Commissary wording changed to `Commissary Dispatch to Branch` because this is clearer for food and beverage operations than `Stock Outward`.
- Vendor Name field added locally.
- Transaction Type changed locally from a user dropdown to a read-only auto value based on Entry Type.
- Vendor fields now show only for Vendor Billing / Direct Purchase: Vendor Name, Vendor Invoice Number, Bill / Invoice Date, Bill Amount, Attach Vendor Bill.
- Branch to Branch Transfer now shows From Location and To Location instead of the normal single Location selector.
- Proof Details section added before Additional Info with Requested By Name / Employee ID and Attach Proof as mandatory fields.
- Requested By Name / Employee ID is now shown and required only for Branch to Branch Transfer.
- Product row wording changed locally: `Unit...` is now `Unit - Weight/Measure...`, and `Count` is now `Qty`.
- Location, From Location, To Location, Vendor Name, Product / Item, and Unit fields changed locally to custom dark searchable dropdown-style inputs.
- Searchable dropdown-style fields now validate typed values against their option lists; invalid typed text is rejected on submit.
- Product row now has a fixed heading row: Product / Item, Unit - Weight / Measure, Qty.
- Selecting `Add New Vendor` now shows an `Open Vendor KYC` link to the internal `/forms/vendor-kyc` page in local testing.
- Local demo Vendor KYC page added at `/forms/vendor-kyc` and dashboard card made available in local demo mode.
- Vendor KYC demo dropdowns changed to the same custom searchable list approach.
- Vendor KYC phone validates `0300-1234567`, IBAN validates 24 alphanumeric characters, and email validates email format.
- Local Vendor KYC submit only shows a mock success message; live needs approval workflow, secure uploads, and sync to `Vendor List`.
- Local demo Bank Payment Data form added at `/forms/bank-payment-data`.
- Bank Payment Data uses searchable dropdown-style fields for Payer Full Name, Bank, Location, and Payment Category.
- Bank Payment Data Payer Full Name should come from the `Vendor List` validation tab in the live implementation.
- Bank Payment Data now includes required `Payment Mode` with options `Cheque` and `Online`.
- Bank Payment Data location options should use the `For payments` column from the `Location` validation tab in the live implementation.
- Bank Payment Data `Payment From Luna Bank` options should come from the `Luna Banks` validation tab in the live implementation.
- Bank Payment Data payment categories should come from the `Payment Category` validation tab in the live implementation.
- Local dashboard now shows these coming soon cards: Staff Penalties, Karachi Club POS Data, and Staff Onboarding.
- Local demo submit returns a mock receipt instead of writing to Supabase.

## Developer review required

- Confirm no private form data is exposed.
- Confirm only approved users can access test or live forms.
- Confirm Supabase RLS still protects all submissions.
- Confirm Vercel environment variables are not exposed.
- Confirm encryption/token/protocol requirements before live deployment.

## Questions / pending items

- 
