import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic-link landing point. Supabase redirects here with a one-time code,
 * which we exchange for a session cookie.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/?error=link_expired`);
  }

  // Only allow relative paths — an open redirect here would let a crafted
  // magic link bounce a signed-in user to an attacker's site.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
