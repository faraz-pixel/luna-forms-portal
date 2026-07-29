import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import AdminClient from './AdminClient';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Admin RLS lets these reads span every user.
  const [{ data: requests }, { data: profiles }, { data: forms }, { data: grants }] =
    await Promise.all([
      supabase
        .from('access_requests')
        .select('id, user_id, form_slug, message, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email'),
      supabase
        .from('forms')
        .select('slug, name, status')
        .order('sort_order'),
      supabase.from('grants').select('user_id, form_slug, level'),
    ]);

  const profileList = profiles ?? [];
  const emailById = Object.fromEntries(profileList.map((p) => [p.id, p.email]));
  const formList = forms ?? [];
  const nameBySlug = Object.fromEntries(formList.map((f) => [f.slug, f.name]));

  const pending = (requests ?? []).map((r) => ({
    ...r,
    email: emailById[r.user_id] ?? 'unknown',
    formName: r.form_slug ? nameBySlug[r.form_slug] ?? r.form_slug : 'General access',
  }));

  // { userId: { formSlug: level } }
  const grantMap = {};
  (grants ?? []).forEach((g) => {
    grantMap[g.user_id] ??= {};
    grantMap[g.user_id][g.form_slug] = g.level;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard" className={styles.backBtn} aria-label="Back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <div>
            <h1 className={styles.title}>Admin</h1>
            <p className={styles.subtitle}>Access requests and permissions</p>
          </div>
        </div>
        <div className={styles.adminBadge}>{admin.email}</div>
      </header>

      <main className={styles.main}>
        <AdminClient
          pending={pending}
          profiles={profileList}
          forms={formList}
          grantMap={grantMap}
          adminId={admin.id}
        />
      </main>
    </div>
  );
}
