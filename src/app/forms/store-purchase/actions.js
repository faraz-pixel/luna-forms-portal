'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getGrantMap } from '@/lib/auth';
import { mirrorToSheet } from '@/lib/sheets';
import { isLocalDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import { getActiveVendors } from '@/lib/forms/vendors-server';
import {
  FORM_SLUG,
  validateStorePurchase,
  generateRef,
} from '@/lib/forms/store-purchase';

const MAX_REF_ATTEMPTS = 5;

/**
 * Persist a Store Purchase submission.
 *
 * Order matters: authorise, then validate, then write. The RLS policy on
 * `submissions` independently requires a grant, so even if the check below were
 * removed the insert would still be refused.
 */
export async function submitStorePurchase(payload) {
  const user = await requireUser();
  const grants = await getGrantMap(user);

  if (!grants[FORM_SLUG]) {
    return { ok: false, error: 'You do not have access to this form.' };
  }

  const allowedVendors = await getActiveVendors();
  const { valid, errors, value } = validateStorePurchase(payload, allowedVendors);
  if (!valid) {
    return { ok: false, fieldErrors: errors, error: 'Please fix the highlighted fields.' };
  }

  if (isLocalDemoMode() && !isSupabaseConfigured()) {
    return {
      ok: true,
      refNumber: generateRef(),
      createdAt: new Date().toISOString(),
      sheetSynced: false,
      sheetSkipped: true,
    };
  }

  const supabase = await createClient();

  // ref_number is UNIQUE; on the rare collision, try a fresh one.
  let inserted = null;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt += 1) {
    const refNumber = generateRef();
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        form_slug: FORM_SLUG,
        ref_number: refNumber,
        user_id: user.id,
        user_email: user.email,
        payload: value,
      })
      .select('id, ref_number, created_at')
      .single();

    if (!error) {
      inserted = data;
      break;
    }

    lastError = error;
    // 23505 = unique_violation. Anything else is not worth retrying.
    if (error.code !== '23505') break;
  }

  if (!inserted) {
    console.error('[store-purchase] insert failed', lastError);
    return {
      ok: false,
      error:
        lastError?.code === '42501'
          ? 'You do not have permission to submit this form.'
          : 'Could not save the submission. Please try again.',
    };
  }

  let billingRecorded = false;
  if (value.entryType === 'Vendor Billing / Direct Purchase') {
    let finalVendorId = value.vendorId;
    if (!finalVendorId && value.vendorName) {
      const { data: vRecord } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', value.vendorName)
        .single();
      if (vRecord) {
        finalVendorId = vRecord.id;
      }
    }

    const { error: billingError } = await supabase.from('vendor_bills').insert({
      source_submission_id: inserted.id,
      vendor_id: finalVendorId || null,
      vendor_name: value.vendorName,
      bill_number: value.vendorInvoiceNumber,
      invoice_date: value.vendorInvoiceDate,
      bill_amount: value.vendorBillAmount,
      attachment_name: value.vendorBillAttachmentName,
      created_by: user.id,
    });
    if (billingError) {
      console.error('[store-purchase] billing record failed', billingError);
    } else {
      billingRecorded = true;
    }
  }

  const mirror = await mirrorToSheet({
    formSlug: FORM_SLUG,
    refNumber: inserted.ref_number,
    userEmail: user.email,
    createdAt: inserted.created_at,
    payload: value,
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
    // Surfaced so the user knows the Sheet copy lagged — the submission itself
    // is safe either way.
    sheetSynced: Boolean(mirror.ok),
    sheetSkipped: Boolean(mirror.skipped),
    billingRecorded,
  };
}
