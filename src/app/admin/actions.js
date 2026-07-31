'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const LEVELS = ['submit', 'view_all'];
const ROLES = ['member', 'accounts'];

/**
 * Every action here calls requireAdmin() first. That is the app-layer gate;
 * the `*_admin_write` RLS policies enforce the same thing in Postgres, so a
 * non-admin calling these directly still cannot write.
 */

export async function setGrant(userId, formSlug, level) {
  const admin = await requireAdmin();

  if (!LEVELS.includes(level)) {
    return { ok: false, error: 'Invalid access level.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('grants')
    .upsert(
      { user_id: userId, form_slug: formSlug, level, granted_by: admin.id },
      { onConflict: 'user_id,form_slug' }
    );

  if (error) {
    console.error('[admin] setGrant failed', error);
    return { ok: false, error: 'Could not save the grant.' };
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function revokeGrant(userId, formSlug) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('grants')
    .delete()
    .eq('user_id', userId)
    .eq('form_slug', formSlug);

  if (error) {
    console.error('[admin] revokeGrant failed', error);
    return { ok: false, error: 'Could not revoke access.' };
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function setUserRole(userId, role) {
  const admin = await requireAdmin();
  if (userId === admin.id || !ROLES.includes(role)) {
    return { ok: false, error: 'Invalid team role.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) {
    console.error('[admin] setUserRole failed', error);
    return { ok: false, error: 'Could not update the team role.' };
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function resolveRequest(requestId, decision, level = 'submit') {
  const admin = await requireAdmin();

  if (!['approved', 'denied'].includes(decision)) {
    return { ok: false, error: 'Invalid decision.' };
  }

  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from('access_requests')
    .select('id, user_id, form_slug, status')
    .eq('id', requestId)
    .single();

  if (readError || !request) {
    return { ok: false, error: 'Request not found.' };
  }
  if (request.status !== 'pending') {
    return { ok: false, error: 'That request was already resolved.' };
  }

  if (decision === 'approved') {
    if (!request.form_slug) {
      return { ok: false, error: 'This is a general request — grant a form manually below.' };
    }
    const granted = await setGrant(request.user_id, request.form_slug, level);
    if (!granted.ok) return granted;
  }

  const { error } = await supabase
    .from('access_requests')
    .update({
      status: decision,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    console.error('[admin] resolveRequest failed', error);
    return { ok: false, error: 'Could not update the request.' };
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}
