import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseEnv, sanitizeRedirectPath } from '@/lib/supabase/env';
import { ensureUserProfileForUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const nextPath = sanitizeRedirectPath(searchParams.get('next'), '/dashboard');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    return NextResponse.redirect(`${origin}/login?reason=unconfigured`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(`${origin}/login?error=session_invalid`);
    }

    await ensureUserProfileForUser(user);

    return NextResponse.redirect(`${origin}${nextPath}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_exception`);
  }
}
