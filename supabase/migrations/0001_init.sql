-- Luna Forms Portal — initial schema, RLS, and seed data.
-- Paste this whole file into the Supabase SQL editor and run it once.

-- ─────────────────────────────────────────────────────────────
-- Config
-- ─────────────────────────────────────────────────────────────
-- Who is the admin. Set this once after running the migration:
--   update app_config set value = 'you@yourdomain.com' where key = 'admin_email';
-- Do it BEFORE that person's first sign-in — the role is assigned when their
-- profile row is created.
create table if not exists app_config (
  key   text primary key,
  value text not null
);

-- `do nothing`, not `do update`: re-running this migration must never clobber a
-- configured admin email and lock the real admin out of their own portal.
insert into app_config (key, value)
values ('admin_email', 'CHANGE-ME')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null unique,
  full_name  text,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists forms (
  slug        text primary key,
  name        text not null,
  description text not null default '',
  status      text not null default 'coming_soon' check (status in ('active', 'coming_soon')),
  color       text not null default 'blue',
  icon        text not null default 'FileText',
  sort_order  int  not null default 0
);

create table if not exists grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  form_slug  text not null references forms(slug)  on delete cascade,
  level      text not null check (level in ('submit', 'view_all')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  unique (user_id, form_slug)
);

create table if not exists access_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  form_slug   text references forms(slug) on delete cascade, -- null = general request
  message     text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);

create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  form_slug    text not null references forms(slug) on delete restrict,
  ref_number   text not null unique,
  user_id      uuid not null references profiles(id) on delete restrict,
  -- Denormalised on purpose: profiles RLS hides other users, so a view_all
  -- holder joining submissions -> profiles would get null for everyone but
  -- themselves. Storing the email at write time keeps the table readable.
  user_email   text not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  sheet_synced boolean not null default false
);

create index if not exists submissions_form_created_idx on submissions (form_slug, created_at desc);
create index if not exists submissions_user_idx         on submissions (user_id);
create index if not exists grants_user_idx              on grants (user_id);
create index if not exists access_requests_status_idx   on access_requests (status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Helper functions
--
-- SECURITY DEFINER so they bypass RLS on the tables they read. Without this,
-- a policy on `profiles` that calls is_admin() (which reads `profiles`) would
-- recurse infinitely.
-- ─────────────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function grant_level(p_slug text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select level from grants
  where user_id = auth.uid() and form_slug = p_slug;
$$;

-- Auto-create a profile on first sign-in, promoting the configured admin.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin text;
begin
  select value into v_admin from app_config where key = 'admin_email';

  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when v_admin is not null and lower(new.email) = lower(v_admin) then 'admin'
      else 'member'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table app_config      enable row level security;
alter table profiles        enable row level security;
alter table forms           enable row level security;
alter table grants          enable row level security;
alter table access_requests enable row level security;
alter table submissions     enable row level security;

-- app_config: admin only. The trigger reads it via SECURITY DEFINER.
drop policy if exists app_config_admin on app_config;
create policy app_config_admin on app_config
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- profiles: you see yourself; admin sees everyone.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or is_admin());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- forms: every signed-in user reads the catalog. This is deliberate — it is
-- what lets locked cards render at all. Only admin may change it.
drop policy if exists forms_select on forms;
create policy forms_select on forms
  for select to authenticated
  using (true);

drop policy if exists forms_admin_write on forms;
create policy forms_admin_write on forms
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- grants: you see your own; only admin creates or revokes.
drop policy if exists grants_select on grants;
create policy grants_select on grants
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists grants_admin_write on grants;
create policy grants_admin_write on grants
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- access_requests: you raise and see your own; admin sees and resolves all.
drop policy if exists access_requests_select on access_requests;
create policy access_requests_select on access_requests
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists access_requests_insert_own on access_requests;
create policy access_requests_insert_own on access_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists access_requests_admin_update on access_requests;
create policy access_requests_admin_update on access_requests
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- submissions: the core rule.
--   insert   — needs any grant on that form, and you may only file as yourself
--   select   — view_all sees the whole form; submit sees only its own rows
--   mutate   — admin only
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and grant_level(form_slug) is not null
  );

drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions
  for select to authenticated
  using (
    is_admin()
    or grant_level(form_slug) = 'view_all'
    or (grant_level(form_slug) = 'submit' and user_id = auth.uid())
  );

drop policy if exists submissions_admin_write on submissions;
create policy submissions_admin_write on submissions
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- Seed: the form catalog
--
-- Only store-purchase is real today. vendor-invoice is coming_soon because
-- /forms/vendor-invoice does not exist — marking it active produced a 404.
-- ─────────────────────────────────────────────────────────────
insert into forms (slug, name, description, status, color, icon, sort_order) values
  ('store-purchase',  'Store Purchase Form',     'Track store purchases and inventory', 'active',      'blue',   'ShoppingCart',  1),
  ('vendor-invoice',  'Vendor Invoice/Billing',  'Manage vendor invoices',              'coming_soon', 'purple', 'FileText',      2),
  ('vendor-kyc',      'Vendor KYC Verification', 'Verify vendor credentials',           'coming_soon', 'orange', 'ShieldCheck',   3),
  ('payment-data',    'Payment Data',            'Record payment transactions',         'coming_soon', 'green',  'CreditCard',    4),
  ('new-joiner',      'New Joiner 2026',         'Employee onboarding',                 'coming_soon', 'gold',   'UserPlus',      5),
  ('karachi-club-pos','Karachi Club POS',        'POS records',                         'coming_soon', 'red',    'Monitor',       6),
  ('stock-in-out',    'Stock In or Out',         'Inventory management',                'coming_soon', 'cyan',   'Package',       7),
  ('staff-penalty',   'Staff Penalty',           'Staff penalty records',               'coming_soon', 'blue',   'AlertTriangle', 8),
  ('wip-store',       'WIP-Store',               'Store WIP tracking',                  'coming_soon', 'purple', 'Briefcase',     9)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  status      = excluded.status,
  color       = excluded.color,
  icon        = excluded.icon,
  sort_order  = excluded.sort_order;
