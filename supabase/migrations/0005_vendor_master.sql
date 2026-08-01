-- Migration: 0005_vendor_master.sql
-- Additive migration implementing the refined Vendor Master system.

-- 1. Create Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code                 text NOT NULL UNIQUE,
  name                        text NOT NULL UNIQUE,
  status                      text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Inactive', 'Blacklisted')),
  source                      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'kyc')),
  kyc_submission_id           uuid REFERENCES submissions(id) ON DELETE SET NULL,
  vendor_type                 text NOT NULL DEFAULT 'General',
  
  -- Tax Profile Fields
  ntn                         text,
  strn                        text, -- STRN/GST Registration
  province                    text,
  default_wht_category        text,
  default_gst_category        text,
  tax_exemption_certificate   text,
  certificate_expiry          date,
  filer_status                text DEFAULT 'Non-Filer', -- Active Taxpayer / Filer Status
  
  -- Payment Defaults
  default_payment_method      text DEFAULT 'Bank Transfer',
  credit_days                 integer DEFAULT 0 CHECK (credit_days >= 0),
  currency                    text DEFAULT 'PKR',
  
  -- Core Profile Information
  business_name               text,
  business_address            text,
  contact_email               text,
  contact_phone               text,
  bank_account_title          text,
  iban                        text,
  bank_account_number         text,
  bank_name                   text,
  notes                       text,
  
  created_by                  uuid REFERENCES profiles(id) ON DELETE RESTRICT,
  approved_by                 uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS vendors_code_idx ON vendors (vendor_code);
CREATE INDEX IF NOT EXISTS vendors_name_idx ON vendors (name);
CREATE INDEX IF NOT EXISTS vendors_status_idx ON vendors (status);

-- 2. Alter vendor_bills table to reference vendors via foreign key
ALTER TABLE vendor_bills ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS vendor_bills_vendor_id_idx ON vendor_bills(vendor_id);

-- 3. Create historical mappings table to match raw string inputs to IDs
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name        text NOT NULL UNIQUE,
  vendor_id       uuid REFERENCES vendors(id) ON DELETE SET NULL,
  match_status    text NOT NULL CHECK (match_status IN ('auto_matched', 'manually_matched', 'ambiguous', 'unmatched')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_mappings_raw_name_idx ON vendor_mappings(raw_name);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_mappings ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS vendors_select ON vendors;
CREATE POLICY vendors_select ON vendors
  FOR SELECT TO authenticated
  USING (
    status = 'Approved'
    OR is_admin()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts'
  );

DROP POLICY IF EXISTS vendors_insert ON vendors;
CREATE POLICY vendors_insert ON vendors
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts'
  );

DROP POLICY IF EXISTS vendors_update ON vendors;
CREATE POLICY vendors_update ON vendors
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts'
  )
  WITH CHECK (
    is_admin()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts'
  );

-- Admin-only mapping updates
DROP POLICY IF EXISTS vendor_mappings_all ON vendor_mappings;
CREATE POLICY vendor_mappings_all ON vendor_mappings
  FOR ALL TO authenticated
  USING (is_admin() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts')
  WITH CHECK (is_admin() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'accounts');

-- Helper function to generate incremental sequence numbers for vendor codes
CREATE OR REPLACE FUNCTION get_next_vendor_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq integer;
BEGIN
  SELECT count(*) + 1 INTO v_seq FROM vendors;
  RETURN 'VEND-' || to_char(v_seq, 'FM00000');
END;
$$;

-- 6. Seed initial vendor master list with generated codes
DO $$
DECLARE
  vendor_names text[] := ARRAY[
    'A&A Traders', 'Achha Foods (Pvt.) Ltd.', 'Afil Industries', 'AL- Momin Enterprises', 
    'Al-Wasay', 'Americom Technologies (Pvt.) Ltd.', 'Apex Packages (SMC-Private) Ltd.', 
    'Asif Brother CD', 'Asif Brothers CD', 'At- Tahur Ltd.', 'AT-Tahur Limited', 
    'Axiom International Trading', 'Bennys By Benedition', 'Big Bird Foods Ltd', 
    'Bismillah Electronics', 'Bismillah Special Sabzi Suppliers', 'Bismillah Special Sabzi Supply', 
    'BK Enterprises', 'Brenqo', 'Cafe And Beverages Lab', 'Corporate Chef And Co', 
    'Gamco Agencies', 'Haaniya International', 'Hilltop Enterprise', 'Horeca Mondo', 
    'Horeca Systems', 'International Brands Distributions', 'Irshad Brothers Gas Agency', 
    'Khurram Enterprises', 'M.I.A Holidays', 'Maple Star Food Solutions', 'Markhor Now', 
    'Mirwan (Market At Spring)', 'Muhammad Fahad Aslam', 'Muhammad Wasi', 'Multiple Trading', 
    'MYD Ventures (Pvt.) Ltd.', 'Nur Enterprises', 'Opal Distributor (Pvt.) Ltd.', 
    'Orish Foods (Pvt.) Ltd.', 'Ozone Enterprises', 'Printeze', 'Pura Springs (Pvt.) Ltd.', 
    'Raim Enterprises', 'Salsabakes', 'SH Traders', 'Sharif Milk Products (Pvt.) Ltd.', 
    'Sheheryar Enterprises', 'Smores', 'Swiss Packaging', 'The Vittles Company', 
    'Trade Distributor', 'Tradsol', 'TZ Marketing', 'Umer Traders', 'Usman Brothers (Pvt.) Ltd.', 
    'Venus Food Services Ltd.', 'Wild Flour Bakery'
  ];
  name_text text;
  v_code text;
BEGIN
  FOREACH name_text IN ARRAY vendor_names LOOP
    IF NOT EXISTS (SELECT 1 FROM vendors WHERE name = name_text) THEN
      v_code := get_next_vendor_code();
      INSERT INTO vendors (vendor_code, name, status, source)
      VALUES (v_code, name_text, 'Approved', 'manual');
    END IF;
  END LOOP;
END;
$$;

-- 7. Automatically backfill exact matches from historical vendor bills
DO $$
DECLARE
  r RECORD;
  v_id uuid;
BEGIN
  -- Insert mapping values for existing active vendors
  INSERT INTO vendor_mappings (raw_name, vendor_id, match_status, notes)
  SELECT name, id, 'auto_matched', 'Seeded auto-match for active vendor list'
  FROM vendors
  ON CONFLICT (raw_name) DO NOTHING;

  -- Create unmatched mapping entries for raw names found in vendor_bills that do not exist in vendors table
  INSERT INTO vendor_mappings (raw_name, match_status, notes)
  SELECT DISTINCT vendor_name, 'unmatched', 'Unmatched historical name variation'
  FROM vendor_bills
  WHERE vendor_name NOT IN (SELECT name FROM vendors)
  ON CONFLICT (raw_name) DO NOTHING;

  -- Link vendor_bills where mapped vendor_id is present
  FOR r IN SELECT raw_name, vendor_id FROM vendor_mappings WHERE vendor_id IS NOT NULL LOOP
    UPDATE vendor_bills
    SET vendor_id = r.vendor_id
    WHERE vendor_name = r.raw_name AND vendor_id IS NULL;
  END LOOP;
END;
$$;

-- 8. Update vendor_payables_summary view to use the new stable vendor relationship
CREATE OR REPLACE VIEW vendor_payables_summary
WITH (security_invoker = true) AS
SELECT
  b.id,
  COALESCE(v.name, b.vendor_name) as vendor_name,
  b.vendor_id,
  b.bill_number,
  b.invoice_date,
  b.bill_amount,
  b.credit_terms_days,
  b.credit_terms_status,
  b.due_date,
  COALESCE(sum(p.amount), 0)::numeric(14, 2) as paid_amount,
  greatest(b.bill_amount - COALESCE(sum(p.amount), 0), 0)::numeric(14, 2) as balance,
  CASE
    WHEN b.credit_terms_status <> 'endorsed' THEN 'terms_pending'
    WHEN greatest(b.bill_amount - COALESCE(sum(p.amount), 0), 0) = 0 THEN 'paid'
    WHEN b.due_date < current_date THEN 'overdue'
    WHEN b.due_date <= current_date + 7 THEN 'due_soon'
    ELSE 'open'
  END as payable_status,
  greatest(current_date - b.due_date, 0) as days_overdue
FROM vendor_bills b
LEFT JOIN vendors v ON v.id = b.vendor_id
LEFT JOIN vendor_payments p ON p.vendor_bill_id = b.id
GROUP BY b.id, v.name;
