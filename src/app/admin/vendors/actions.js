'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

/**
 * Creates a new manual vendor with sequental vendor code.
 */
export async function createManualVendor(name, profileData = {}) {
  await requireAdmin();

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return { ok: false, error: 'Vendor name is required' };
  }

  const supabase = await createClient();

  // Generate sequence code
  const { data: codeData, error: seqError } = await supabase.rpc('get_next_vendor_code');
  const code = codeData || `VEND-M${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from('vendors')
    .insert({
      vendor_code: code,
      name: trimmedName,
      status: 'Approved',
      source: 'manual',
      ...profileData,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting manual vendor:', error);
    return { ok: false, error: error.message || 'Failed to create vendor' };
  }

  // Auto create mapping record too
  await supabase
    .from('vendor_mappings')
    .insert({
      raw_name: trimmedName,
      vendor_id: data.id,
      match_status: 'auto_matched',
      notes: 'Automatically generated mapping for manual vendor creation',
    })
    .select()
    .single();

  revalidatePath('/admin/vendors');
  revalidatePath('/forms/store-purchase');

  return { ok: true, vendor: data };
}

/**
 * Resolves or updates a historical vendor name mapping to a stable ID.
 */
export async function resolveVendorMapping(mappingId, vendorId, matchStatus = 'manually_matched', notes = '') {
  await requireAdmin();

  const supabase = await createClient();

  const { data: updatedMapping, error: mapError } = await supabase
    .from('vendor_mappings')
    .update({
      vendor_id: vendorId || null,
      match_status: matchStatus,
      notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mappingId)
    .select()
    .single();

  if (mapError) {
    console.error('Error updating vendor mapping:', mapError);
    return { ok: false, error: mapError.message || 'Failed to update mapping' };
  }

  // If map has a valid vendorId, dynamically update existing null vendor_id bills
  if (vendorId) {
    const { error: billUpdateError } = await supabase
      .from('vendor_bills')
      .update({ vendor_id: vendorId })
      .eq('vendor_name', updatedMapping.raw_name)
      .is('vendor_id', null);

    if (billUpdateError) {
      console.error('Error updating related bills:', billUpdateError);
    }
  }

  revalidatePath('/admin/vendors');

  return { ok: true, mapping: updatedMapping };
}

/**
 * Updates the status of an existing vendor record.
 * Allowed statuses: 'Approved' | 'Pending' | 'Inactive' | 'Blacklisted'
 * Revalidates both the admin vendors page and the store-purchase form so
 * the live vendor dropdown reflects status changes without a redeploy.
 */
export async function updateVendorStatus(vendorId, newStatus) {
  await requireAdmin();

  const ALLOWED_STATUSES = ['Approved', 'Pending', 'Inactive', 'Blacklisted'];
  if (!vendorId) {
    return { ok: false, error: 'Vendor ID is required' };
  }
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return { ok: false, error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vendors')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', vendorId)
    .select('id, vendor_code, name, status')
    .single();

  if (error) {
    console.error('Error updating vendor status:', error);
    return { ok: false, error: error.message || 'Failed to update vendor status' };
  }

  revalidatePath('/admin/vendors');
  revalidatePath('/forms/store-purchase');

  return { ok: true, vendor: data };
}

