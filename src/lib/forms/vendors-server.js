import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, isLocalDemoMode } from '@/lib/supabase/config';
import { APPROVED_VENDOR_NAMES } from './validation-options';

/**
 * Fetch approved vendors from Supabase.
 * Falls back to hard-coded values if Supabase is not configured or in local demo mode.
 */
export async function getActiveVendors() {
  if (isLocalDemoMode() && !isSupabaseConfigured()) {
    return APPROVED_VENDOR_NAMES;
  }
  if (!isSupabaseConfigured()) {
    return APPROVED_VENDOR_NAMES;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('status', 'Approved')
      .order('name');

    if (error || !data) {
      console.error('Error fetching vendors from Supabase, falling back to defaults:', error);
      return APPROVED_VENDOR_NAMES;
    }

    return data.map((v) => v.name);
  } catch (err) {
    console.error('Exception fetching vendors from Supabase, falling back to defaults:', err);
    return APPROVED_VENDOR_NAMES;
  }
}

/**
 * Fetch complete vendor objects (id and name mapping) for saving ID relationships.
 */
export async function getActiveVendorMappings() {
  if (isLocalDemoMode() && !isSupabaseConfigured()) {
    return APPROVED_VENDOR_NAMES.map((name, i) => ({ id: `fallback-id-${i}`, name }));
  }
  if (!isSupabaseConfigured()) {
    return APPROVED_VENDOR_NAMES.map((name, i) => ({ id: `fallback-id-${i}`, name }));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('status', 'Approved')
      .order('name');

    if (error || !data) {
      console.error('Error fetching vendor mappings from Supabase, using defaults:', error);
      return APPROVED_VENDOR_NAMES.map((name, i) => ({ id: `fallback-id-${i}`, name }));
    }

    return data;
  } catch (err) {
    console.error('Exception fetching vendor mappings from Supabase, using defaults:', err);
    return APPROVED_VENDOR_NAMES.map((name, i) => ({ id: `fallback-id-${i}`, name }));
  }
}
