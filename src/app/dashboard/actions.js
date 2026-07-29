'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { notifyAdminOfRequest } from '@/lib/notify';

/**
 * Raise an access request for a form. Idempotent per (user, form): re-asking
 * while one is already pending is a no-op rather than a duplicate row.
 */
export async function requestAccess(prevState, formData) {
  const user = await requireUser();
  const formSlug = formData.get('formSlug');
  const message = (formData.get('message') || '').toString().slice(0, 500);

  if (!formSlug) {
    return { ok: false, error: 'No form specified.' };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('access_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('form_slug', formSlug)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyPending: true, formSlug };
  }

  const { error } = await supabase.from('access_requests').insert({
    user_id: user.id,
    form_slug: formSlug,
    message,
    status: 'pending',
  });

  if (error) {
    return { ok: false, error: 'Could not submit the request. Please try again.' };
  }

  // Best-effort — a failed notification must not fail the request itself.
  await notifyAdminOfRequest({ email: user.email, formSlug, message });

  revalidatePath('/dashboard');
  return { ok: true, formSlug };
}
