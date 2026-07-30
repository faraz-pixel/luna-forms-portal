import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getGrantMap } from '@/lib/auth';
import { isLocalDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import FormsGrid from './FormsGrid';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

const STAT_ICONS = {
  forms: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></>,
  check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></>,
  clock: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
};

function StatIcon({ kind }) {
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STAT_ICONS[kind]}
    </svg>
  );
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const DEMO_FORMS = [
  {
    slug: 'store-purchase',
    name: 'Stock Inward Entry',
    description: 'Record vendor deliveries, purchase bills, and commissary receiving',
    status: 'active',
    color: 'blue',
    icon: 'ShoppingCart',
  },
  {
    slug: 'bank-payment-data',
    name: 'Bank Payment Data',
    description: 'Record outgoing bank payments and payment categories',
    status: 'active',
    color: 'green',
    icon: 'CreditCard',
  },
  {
    slug: 'vendor-kyc',
    name: 'Vendor KYC Verification',
    description: 'Verify vendor credentials',
    status: 'active',
    color: 'orange',
    icon: 'ShieldCheck',
  },
  {
    slug: 'staff-penalty',
    name: 'Staff Penalties',
    description: 'Record staff penalty cases',
    status: 'coming_soon',
    color: 'red',
    icon: 'AlertTriangle',
  },
  {
    slug: 'karachi-club-pos',
    name: 'Karachi Club POS Data',
    description: 'POS records for Karachi Club',
    status: 'coming_soon',
    color: 'purple',
    icon: 'Monitor',
  },
  {
    slug: 'new-joiner',
    name: 'Staff Onboarding',
    description: 'Employee onboarding records',
    status: 'coming_soon',
    color: 'teal',
    icon: 'UserPlus',
  },
];

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const user = await requireUser();
  const grants = await getGrantMap(user);
  const demoMode = isLocalDemoMode() && !isSupabaseConfigured();

  let forms = DEMO_FORMS;
  let recent = [];
  let todayCount = 0;
  let pendingCount = 0;
  let memberCount = 1;

  if (!demoMode) {
    const supabase = await createClient();

    const { data: formsData } = await supabase
      .from('forms')
      .select('slug, name, description, status, color, icon')
      .order('sort_order');
    forms = formsData ?? [];

    // RLS decides what comes back here — a user with no grants gets an empty
    // array, not a filtered-in-the-browser list.
    const { data: recentData } = await supabase
      .from('submissions')
      .select('id, ref_number, form_slug, user_email, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    recent = recentData ?? [];

    const { count: todayDataCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday());
    todayCount = todayDataCount ?? 0;

    const { count: pendingDataCount } = await supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingCount = pendingDataCount ?? 0;

    if (user.isAdmin) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      memberCount = count ?? 0;
    }
  }

  const formList = forms;
  const grantedCount = formList.filter((f) => grants[f.slug]).length;
  const formsBySlug = Object.fromEntries(formList.map((f) => [f.slug, f.name]));

  const stats = [
    {
      label: user.isAdmin ? 'Total Forms' : 'Forms You Can Use',
      value: user.isAdmin ? formList.length : grantedCount,
      icon: 'forms',
    },
    { label: 'Submissions Today', value: todayCount ?? 0, icon: 'check' },
    {
      label: user.isAdmin ? 'Pending Requests' : 'Your Pending Requests',
      value: pendingCount ?? 0,
      icon: 'clock',
    },
    user.isAdmin
      ? { label: 'Team Members', value: memberCount ?? 0, icon: 'users' }
      : { label: 'Your Submissions', value: (recent ?? []).filter((r) => r.user_email === user.email).length, icon: 'users' },
  ];

  const displayName = (user.full_name || user.email.split('@')[0] || '').trim();
  const initial = (displayName[0] || '?').toUpperCase();
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const denied = params?.denied
    ? formsBySlug[params.denied] || params.denied
    : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          Luna Forms
        </div>
        <div className={styles.userInfo}>
          {(user.isAdmin || user.role === 'accounts') && (
            <Link href="/billing" className={styles.adminLink}>Payables</Link>
          )}
          {user.isAdmin && (
            <Link href="/admin" className={styles.adminLink}>
              Admin
              {pendingCount > 0 && <span className={styles.pendingDot}>{pendingCount}</span>}
            </Link>
          )}
          <div className={styles.email}>{user.email}</div>
          <div className={styles.avatar}>{initial}</div>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOut}>Sign out</button>
          </form>
        </div>
      </header>

      <main className={styles.main}>
        {denied && (
          <div className={styles.deniedBanner} role="alert">
            You do not have access to <strong>{denied}</strong>. Request it below
            and the admin will review it.
          </div>
        )}

        <section className={styles.welcomeSection}>
          <h1 className={styles.welcomeHeading}>
            Welcome back, <span>{displayName}</span> 👋
          </h1>
          <p className={styles.welcomeSubtitle}>
            Here&apos;s what&apos;s happening today, {currentDate}
          </p>
        </section>

        <section className={styles.statsRow}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <div className={styles.statIcon}><StatIcon kind={stat.icon} /></div>
              <div className={styles.statInfo}>
                <h3>{stat.label}</h3>
                <p>{stat.value}</p>
              </div>
            </div>
          ))}
        </section>

        <FormsGrid forms={formList} grants={grants} isAdmin={user.isAdmin} />

        <section className={styles.tableSection}>
          <div className={styles.sectionHeader}>
            <h2>Recent Submissions</h2>
          </div>
          <div className={styles.tableContainer}>
            {(recent ?? []).length === 0 ? (
              <p className={styles.emptyState}>
                No submissions you can see yet. Once you have access to a form and
                file an entry, it will show up here.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Form</th>
                    <th>Submitted By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.ref_number}</td>
                      <td>{formsBySlug[sub.form_slug] ?? sub.form_slug}</td>
                      <td>{sub.user_email}</td>
                      <td>{relativeTime(sub.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
