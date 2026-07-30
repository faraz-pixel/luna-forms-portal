import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import styles from '../../admin/page.module.css';

export const dynamic = 'force-dynamic';

export default async function KpiPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles }, { data: submissions }, { data: bills }, { data: payments }] = await Promise.all([
    supabase.from('profiles').select('id, email, role').order('email'),
    supabase.from('submissions').select('user_id, form_slug'),
    supabase.from('vendor_bills').select('created_by, credit_terms_status'),
    supabase.from('vendor_payments').select('entered_by'),
  ]);

  const countBy = (rows, key, value) => (rows ?? []).filter((row) => row[key] === value).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin" className={styles.backBtn} aria-label="Back to admin">←</Link>
          <div>
            <h1 className={styles.title}>User KPIs</h1>
            <p className={styles.subtitle}>Recorded work from portal activity</p>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Team activity</h2>
          <div className={styles.tableWrap}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.personCol}>Person</th>
                  <th>Submissions</th>
                  <th>Vendor bills entered</th>
                  <th>Terms endorsed</th>
                  <th>Payments recorded</th>
                </tr>
              </thead>
              <tbody>
                {(profiles ?? []).map((person) => (
                  <tr key={person.id}>
                    <td className={styles.personCol}>{person.email}{person.role === 'accounts' ? ' (Accounts)' : ''}</td>
                    <td>{countBy(submissions, 'user_id', person.id)}</td>
                    <td>{countBy(bills, 'created_by', person.id)}</td>
                    <td>{countBy((bills ?? []).filter((bill) => bill.credit_terms_status === 'endorsed'), 'created_by', person.id)}</td>
                    <td>{countBy(payments, 'entered_by', person.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
