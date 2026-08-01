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
    return {
      ok: false,
      error: 'You do not have access to this form.',
      debugDetails: { type: 'GRANT_DENIED', formSlug: FORM_SLUG, grants },
    };
  }

  const allowedVendors = await getActiveVendors();
  const { valid, errors, value } = validateStorePurchase(payload, allowedVendors);
  if (!valid) {
    return {
      ok: false,
      fieldErrors: errors,
      error: `Server validation failed: ${Object.entries(errors).map(([k, v]) => `${k} (${v})`).join(', ')}`,
      debugDetails: { type: 'SERVER_VALIDATION_FAILED', errors, payload },
    };
  }

  if (isLocalDemoMode() && !isSupabaseConfigured()) {
    return {
      ok: true,
      refNumber: generateRef(),
      createdAt: new Date().toISOString(),
      sheetSynced: false,
      sheetSkipped: true,
      debugDetails: { type: 'DEMO_MODE_SUBMISSION' },
    };
  }

  const supabase = await createClient();

  // Verify storage paths belong to current user if provided
  const uploadedStoragePaths = [];
  if (value.vendorBillStoragePath) {
    if (!value.vendorBillStoragePath.startsWith(`${user.id}/`)) {
      return {
        ok: false,
        error: 'Invalid storage path ownership for vendor bill attachment.',
        debugDetails: { type: 'STORAGE_PATH_OWNERSHIP_MISMATCH', path: value.vendorBillStoragePath, userId: user.id },
      };
    }
    uploadedStoragePaths.push(value.vendorBillStoragePath);
  }
  if (value.proofStoragePath) {
    if (!value.proofStoragePath.startsWith(`${user.id}/`)) {
      return {
        ok: false,
        error: 'Invalid storage path ownership for proof attachment.',
        debugDetails: { type: 'STORAGE_PATH_OWNERSHIP_MISMATCH', path: value.proofStoragePath, userId: user.id },
      };
    }
    uploadedStoragePaths.push(value.proofStoragePath);
  }

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

    // Cleanup orphaned storage objects if database save failed
    if (uploadedStoragePaths.length > 0) {
      try {
        await supabase.storage
          .from('store-purchase-attachments')
          .remove(uploadedStoragePaths);
        console.log('[store-purchase] Orphaned storage files cleaned up:', uploadedStoragePaths);
      } catch (cleanupErr) {
        console.error('[store-purchase] Failed to clean up orphaned storage files:', cleanupErr);
      }
    }

    return {
      ok: false,
      error:
        lastError?.code === '42501'
          ? 'You do not have permission to submit this form.'
          : `Could not save submission: ${lastError?.message || lastError?.code || 'Database insert failed.'}`,
      debugDetails: {
        type: 'SUPABASE_INSERT_FAILED',
        code: lastError?.code,
        message: lastError?.message,
        details: lastError?.details,
        hint: lastError?.hint,
      },
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

/**
 * Generate a short-lived signed download/view URL for an attachment in private storage.
 */
export async function getAttachmentSignedUrl(storagePath) {
  const user = await requireUser();
  if (!storagePath) {
    return { ok: false, error: 'No storage path provided.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from('store-purchase-attachments')
    .createSignedUrl(storagePath, 300); // 5 minutes validity

  if (error || !data?.signedUrl) {
    console.error('[storage] createSignedUrl failed:', error);
    return { ok: false, error: 'Could not generate secure view URL.' };
  }

  return { ok: true, signedUrl: data.signedUrl };
}

