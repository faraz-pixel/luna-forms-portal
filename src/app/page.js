import Link from 'next/link';
import { isLocalDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import LoginForm from './LoginForm';
import styles from './page.module.css';

const ERROR_COPY = {
  missing_code: 'That sign-in link was incomplete. Please request a new one.',
  link_expired: 'That sign-in link has expired or was already used. Request a new one below.',
};

export const dynamic = 'force-dynamic';

/**
 * Server Component so the branded card is real HTML on first paint. Only the
 * interactive form below it is a client component.
 */
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const demoMode = isLocalDemoMode() && !configured;

  const next = typeof params?.next === 'string' ? params.next : '';
  const initialError = ERROR_COPY[params?.error] ?? '';

  return (
    <div className={styles.container}>
      <div className={styles.pattern}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Luna</h1>
          <h2 className={styles.subtitle}>Forms Portal</h2>
          <p className={styles.tagline}>Coffee Cartel</p>
        </div>

        {demoMode ? (
          <div className={styles.requestNote}>
            <p style={{ margin: '0 0 16px' }}>
              Local demo mode is on. Database connection is skipped for localhost
              preview only.
            </p>
            <Link href="/dashboard" style={{ color: '#d4af37', fontWeight: 700 }}>
              Open Local Demo
            </Link>
          </div>
        ) : configured ? (
          <LoginForm initialError={initialError} next={next} />
        ) : (
          <p className={styles.requestNote}>
            This deployment is not connected to its database yet. Add
            <code> NEXT_PUBLIC_SUPABASE_URL </code> and
            <code> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY </code> in the Vercel project
            settings, then redeploy. See <strong>SETUP.md</strong> for the steps.
          </p>
        )}
      </div>

      <footer className={styles.footer}>
        Powered by Luna • Coffee Cartel © 2026
      </footer>
    </div>
  );
}
