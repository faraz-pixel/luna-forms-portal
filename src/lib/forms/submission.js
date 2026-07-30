import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getGrantMap } from '@/lib/auth';
import { mirrorToSheet } from '@/lib/sheets';

export async function persistFormSubmission({ formSlug, payload, prefix }) {
  const user = await requireUser();
  const grants = await getGrantMap(user);

  if (!grants[formSlug]) {
    return { ok: false, error: 'You do not have access to this form.' };
  }

  const supabase = await createClient();
  let inserted = null;
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    const refNumber = `${prefix}-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        form_slug: formSlug,
        ref_number: refNumber,
        user_id: user.id,
        user_email: user.email,
        payload,
      })
      .select('id, ref_number, created_at')
      .single();

    if (!error) {
      inserted = data;
      break;
    }

    lastError = error;
    if (error.code !== '23505') break;
  }

  if (!inserted) {
    console.error(`[${formSlug}] insert failed`, lastError);
    return {
      ok: false,
      error: lastError?.code === '42501'
        ? 'You do not have permission to submit this form.'
        : 'Could not save the submission. Please try again.',
    };
  }

  const mirror = await mirrorToSheet({
    formSlug,
    refNumber: inserted.ref_number,
    userEmail: user.email,
    createdAt: inserted.created_at,
    payload,
  });

  if (mirror.ok) {
    await supabase
      .from('submissions')
      .update({ sheet_synced: true })
      .eq('id', inserted.id);
  }

  revalidatePath('/dashboard');

  return {
    ok: true,
    refNumber: inserted.ref_number,
    createdAt: inserted.created_at,
    sheetSynced: Boolean(mirror.ok),
    sheetSkipped: Boolean(mirror.skipped),
  };
}
