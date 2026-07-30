-- Promote the locally reviewed forms into the production catalog.
-- This migration changes catalog metadata only; it does not grant access to
-- any user. Admins still control grants through the existing access workflow.

insert into forms (slug, name, description, status, color, icon, sort_order)
values (
  'bank-payment-data',
  'Bank Payment Data',
  'Record outgoing bank payments and payment categories',
  'active',
  'green',
  'CreditCard',
  4
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

update forms
set name = 'Stock Inward Entry',
    description = 'Record vendor deliveries, purchase bills, and commissary receiving',
    status = 'active',
    color = 'blue',
    icon = 'ShoppingCart',
    sort_order = 1
where slug = 'store-purchase';

update forms
set name = 'Vendor KYC Verification',
    description = 'Verify vendor credentials',
    status = 'active',
    color = 'orange',
    icon = 'ShieldCheck',
    sort_order = 3
where slug = 'vendor-kyc';

update forms
set name = 'Staff Penalties',
    description = 'Record staff penalty cases',
    status = 'coming_soon',
    color = 'red',
    icon = 'AlertTriangle',
    sort_order = 8
where slug = 'staff-penalty';

update forms
set name = 'Karachi Club POS Data',
    description = 'POS records for Karachi Club',
    status = 'coming_soon',
    color = 'purple',
    icon = 'Monitor',
    sort_order = 6
where slug = 'karachi-club-pos';

update forms
set name = 'Staff Onboarding',
    description = 'Employee onboarding records',
    status = 'coming_soon',
    color = 'teal',
    icon = 'UserPlus',
    sort_order = 5
where slug = 'new-joiner';
