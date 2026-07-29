import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in user's profile, or null.
 *
 * Uses getUser() rather than getSession() — getUser() revalidates the token
 * against Supabase, whereas getSession() trusts whatever is in the cookie.
 * Never gate access on getSession().
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { ...profile, isAdmin: profile.role === 'admin' };
}

/** Redirect to sign-in unless someone is logged in. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  return user;
}

/** Redirect unless the signed-in user is the admin. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect('/dashboard');
  return user;
}

/**
 * Every grant the current user holds, as { [form_slug]: 'submit' | 'view_all' }.
 * Admin implicitly holds view_all on everything.
 */
export async function getGrantMap(user) {
  const supabase = await createClient();

  if (user.isAdmin) {
    const { data: forms } = await supabase.from('forms').select('slug');
    return Object.fromEntries((forms ?? []).map((f) => [f.slug, 'view_all']));
  }

  const { data: grants } = await supabase
    .from('grants')
    .select('form_slug, level')
    .eq('user_id', user.id);

  return Object.fromEntries((grants ?? []).map((g) => [g.form_slug, g.level]));
}

/**
 * Assert the user may act on a form. Returns their level.
 *
 * This is the app-layer check. RLS enforces the same rule in the database, so
 * forgetting to call this cannot by itself leak rows — it just produces a
 * worse error than a clean redirect.
 */
export async function requireFormAccess(slug, { needViewAll = false } = {}) {
  const user = await requireUser();
  const grants = await getGrantMap(user);
  const level = grants[slug];

  if (!level) redirect(`/dashboard?denied=${encodeURIComponent(slug)}`);
  if (needViewAll && level !== 'view_all') {
    redirect(`/dashboard?denied=${encodeURIComponent(slug)}`);
  }

  return { user, level };
}
