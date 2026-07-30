import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublishableKey } from './config';

/** Supabase client for Client Components (browser only). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    getSupabasePublishableKey()
  );
}
