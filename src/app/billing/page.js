import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAccounts } from '@/lib/auth';
import BillingClient from './BillingClient';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function BillingPage({ searchParams }) {
  await requireAccounts();
  const params = await searchParams;
  const status = typeof params?.status === 'string' ? params.status : '';
  const vendor = typeof params?.vendor === 'string' ? params.vendor.trim() : '';
  const supabase = await createClient();

  let query = supabase
    .from('vendor_payables_summary')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: true });

  if (status) query = query.eq('payable_status', status);
  if (vendor) query = query.ilike('vendor_name', `%${vendor}%`);

  const { data: bills, error } = await query;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
        <div>
          <h1>Vendor Payables</h1>
          <p>Accounts review, endorsed due dates, and aging order</p>
        </div>
      </header>

      {error && <div className={styles.error}>Billing data is not available yet. Run migration 0004 in Supabase first.</div>}

      <form className={styles.filters} method="get">
        <input name="vendor" defaultValue={vendor} placeholder="Search vendor" />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="terms_pending">Terms pending</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due soon</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
        </select>
        <button type="submit">Filter</button>
        <Link href="/billing" className={styles.clear}>Clear</Link>
      </form>

      <BillingClient bills={bills ?? []} />
    </div>
  );
}
