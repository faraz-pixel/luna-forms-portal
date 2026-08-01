import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import VendorsClient from './VendorsClient';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminVendorsPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Fetch all vendors
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .order('name');

  // Fetch mappings
  const { data: mappings } = await supabase
    .from('vendor_mappings')
    .select('*')
    .order('raw_name');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin" className={styles.backBtn} aria-label="Back to admin dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <div>
            <h1 className={styles.title}>Vendor Master Management</h1>
            <p className={styles.subtitle}>Manage core vendors, profile information, and historical mappings</p>
          </div>
        </div>
        <div className={styles.adminBadge}>
          {admin.email}
        </div>
      </header>

      <main className={styles.main}>
        <VendorsClient
          initialVendors={vendors || []}
          initialMappings={mappings || []}
        />
      </main>
    </div>
  );
}
