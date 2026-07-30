/**
 * Whether Supabase credentials are present.
 *
 * Lets a fresh deploy render a clear "not configured yet" screen instead of
 * throwing on every request, so the site can go up before the project exists
 * and start working the moment the env vars land.
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isLocalDemoMode() {
  return process.env.NEXT_PUBLIC_LOCAL_DEMO === 'true';
}
