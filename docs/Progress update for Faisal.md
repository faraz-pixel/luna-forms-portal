# Luna Forms Portal - progress update for Faisal

Date: 2026-07-30

This is a local testing/demo update only. Nothing should be pushed live until the technical/security setup is reviewed.

## Current demo status

- Local demo portal is running and can be reviewed on the laptop.
- Dashboard now shows available demo forms.
- `Stock Inward Entry` replaces the earlier `Store Purchase Form` wording.
- `Vendor KYC Verification` has been added as a Luna-themed portal form.
- `Add New Vendor` from Stock Inward now opens the internal Vendor KYC page instead of the old Google Form.

## Stock Inward Entry changes

- Entry Type controls the workflow:
  - Vendor Billing / Direct Purchase
  - Commissary Dispatch to Branch
  - Branch to Branch Transfer
- Transaction Type is auto-set and read-only, so users do not manually choose inward/outward.
- Vendor Billing / Direct Purchase shows vendor-specific required fields:
  - Vendor Name
  - Vendor Invoice Number
  - Bill / Invoice Date
  - Bill Amount
  - Attach Vendor Bill
- Branch to Branch Transfer shows From Location and To Location.
- Proof attachment is mandatory.
- Requested By Name / Employee ID is shown only when relevant to branch transfer.
- Product section uses clearer headings:
  - Product / Item
  - Unit - Weight / Measure
  - Qty

## Validation approach

- Dropdown fields use searchable selection.
- Free typed text is rejected if it does not match the approved list.
- Location, vendor, bank, product, and unit lists should come from the validation master data.
- Phone/contact format should be `0300-1234567`.
- Email fields should require valid email format.
- IBAN should be 24 alphanumeric characters.

## Master data plan

The Google Sheet `Forms Fields Validations` is intended as the admin-maintained source for dropdown lists:

- Location
- Vendor List
- Bank names
- Stock & Inventory

Live implementation should sync these values through a secure backend or Supabase table. Private sheet/API tokens must not be exposed in browser code.

## Vendor KYC plan

- Internal team can fill Vendor KYC from the portal.
- A vendor-only public link can also be created later, so outside vendors can fill only the KYC form and cannot access the internal dashboard.
- After Vendor KYC is submitted and approved, the vendor name should be added to the Vendor List with trigger/source such as `via KYC`.
- The vendor should then become selectable in Stock Inward Entry.

## Live work required before deployment

- Supabase/Vercel environment variables must be configured.
- Authentication and per-form access must be reviewed.
- File uploads need secure storage.
- Email notifications need SMTP/Resend or another provider.
- Form response export/data view/download needs backend implementation.
- Row-level security and admin-only access need final verification.

## Intended testing access

Please add testing access for:

- `faisal@coffeecartel.pk`

Access should be granted through the proper admin/access process, not by making the portal or repo public.
