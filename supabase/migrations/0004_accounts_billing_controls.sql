-- Accounts billing controls, vendor bills, payment links, and audit-ready KPI data.
-- All tables are additive. Existing submissions remain the historical source.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'accounts', 'member'));

create table if not exists vendor_bills (
  id                    uuid primary key default gen_random_uuid(),
  source_submission_id  uuid unique references submissions(id) on delete set null,
  vendor_name           text not null,
  bill_number           text not null,
  invoice_date          date not null,
  bill_amount           numeric(14, 2) not null check (bill_amount > 0),
  attachment_name       text not null default '',
  created_by            uuid not null references profiles(id) on delete restrict,
  credit_terms_days     integer check (credit_terms_days >= 0),
  credit_terms_status   text not null default 'pending'
                        check (credit_terms_status in ('pending', 'endorsed')),
  terms_endorsed_by     uuid references profiles(id) on delete set null,
  terms_endorsed_at     timestamptz,
  due_date              date,
  status                text not null default 'unpaid'
                        check (status in ('unpaid', 'partially_paid', 'paid')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (vendor_name, bill_number)
);

create table if not exists vendor_payments (
  id                    uuid primary key default gen_random_uuid(),
  vendor_bill_id        uuid not null references vendor_bills(id) on delete restrict,
  payment_date          date not null,
  amount                numeric(14, 2) not null check (amount > 0),
  payment_reference     text not null default '',
  payment_method        text not null default '',
  entered_by            uuid not null references profiles(id) on delete restrict,
  created_at            timestamptz not null default now()
);

create index if not exists vendor_bills_due_idx on vendor_bills (due_date, status);
create index if not exists vendor_bills_terms_idx on vendor_bills (credit_terms_status);
create index if not exists vendor_payments_bill_idx on vendor_payments (vendor_bill_id, payment_date);

-- Backfill vendor bills from existing Stock Inward submissions.
insert into vendor_bills (
  source_submission_id, vendor_name, bill_number, invoice_date, bill_amount,
  attachment_name, created_by
)
select
  s.id,
  s.payload->>'vendorName',
  s.payload->>'vendorInvoiceNumber',
  (s.payload->>'vendorInvoiceDate')::date,
  (s.payload->>'vendorBillAmount')::numeric,
  coalesce(s.payload->>'vendorBillAttachmentName', ''),
  s.user_id
from submissions s
where s.form_slug = 'store-purchase'
  and s.payload->>'entryType' = 'Vendor Billing / Direct Purchase'
  and nullif(s.payload->>'vendorName', '') is not null
  and nullif(s.payload->>'vendorInvoiceNumber', '') is not null
  and (s.payload->>'vendorInvoiceDate')::date is not null
  and (s.payload->>'vendorBillAmount')::numeric > 0
on conflict (source_submission_id) do nothing;

alter table vendor_bills enable row level security;
alter table vendor_payments enable row level security;

drop policy if exists vendor_bills_select on vendor_bills;
create policy vendor_bills_select on vendor_bills
  for select to authenticated
  using (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts' or created_by = auth.uid());

drop policy if exists vendor_bills_insert on vendor_bills;
create policy vendor_bills_insert on vendor_bills
  for insert to authenticated
  with check (created_by = auth.uid() or is_admin() or (select role from profiles where id = auth.uid()) = 'accounts');

drop policy if exists vendor_bills_accounts_update on vendor_bills;
create policy vendor_bills_accounts_update on vendor_bills
  for update to authenticated
  using (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts')
  with check (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts');

drop policy if exists vendor_payments_select on vendor_payments;
create policy vendor_payments_select on vendor_payments
  for select to authenticated
  using (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts' or entered_by = auth.uid());

drop policy if exists vendor_payments_accounts_write on vendor_payments;
create policy vendor_payments_accounts_write on vendor_payments
  for all to authenticated
  using (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts')
  with check (is_admin() or (select role from profiles where id = auth.uid()) = 'accounts');

-- Only a confirmed Accounts/Admin update may set the due date. The application
-- also enforces this, while this trigger prevents accidental direct updates.
create or replace function set_vendor_bill_due_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.credit_terms_status = 'endorsed' then
    if new.credit_terms_days is null or new.terms_endorsed_by is null or new.terms_endorsed_at is null then
      raise exception 'Endorsed vendor bills require credit terms and an endorser';
    end if;
    new.due_date := new.invoice_date + new.credit_terms_days;
  else
    new.due_date := null;
    new.terms_endorsed_by := null;
    new.terms_endorsed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vendor_bill_due_date on vendor_bills;
create trigger vendor_bill_due_date
  before insert or update on vendor_bills
  for each row execute function set_vendor_bill_due_date();

-- A read-only summary used by the Accounts dashboard and KPI view.
create or replace view vendor_payables_summary
with (security_invoker = true) as
select
  b.id,
  b.vendor_name,
  b.bill_number,
  b.invoice_date,
  b.bill_amount,
  b.credit_terms_days,
  b.credit_terms_status,
  b.due_date,
  coalesce(sum(p.amount), 0)::numeric(14, 2) as paid_amount,
  greatest(b.bill_amount - coalesce(sum(p.amount), 0), 0)::numeric(14, 2) as balance,
  case
    when b.credit_terms_status <> 'endorsed' then 'terms_pending'
    when greatest(b.bill_amount - coalesce(sum(p.amount), 0), 0) = 0 then 'paid'
    when b.due_date < current_date then 'overdue'
    when b.due_date <= current_date + 7 then 'due_soon'
    else 'open'
  end as payable_status,
  greatest(current_date - b.due_date, 0) as days_overdue
from vendor_bills b
left join vendor_payments p on p.vendor_bill_id = b.id
group by b.id;
