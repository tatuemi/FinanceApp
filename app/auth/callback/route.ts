import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseEnv, sanitizeRedirectPath } from '@/lib/supabase/env';
import { ensureUserProfileForUser } from '@/lib/auth/session';
import type { Database } from '@/types/database';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type') as
    | 'signup'
    | 'invite'
    | 'magiclink'
    | 'recovery'
    | 'email_change'
    | 'email'
    | null;
  const errorParam = searchParams.get('error');
  const nextPath = sanitizeRedirectPath(searchParams.get('next'), '/dashboard');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    return NextResponse.redirect(`${origin}/login?reason=unconfigured`);
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Construimos la respuesta de redirección y adjuntamos explícitamente las cookies de sesión en ella
  const redirectResponse = NextResponse.redirect(`${origin}${nextPath}`);

  try {
    const supabase = createServerClient<Database>(env.url, env.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        // Si el navegador reintentó la URL pero la sesión ya quedó establecida en el primer intento, continuar al dashboard
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        if (existingUser) {
          await ensureUserProfileForUser(existingUser);
          return redirectResponse;
        }

        return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
      }
    } else if (tokenHash && otpType) {
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });

      if (otpError) {
        return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
      }
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(`${origin}/login?error=session_invalid`);
    }

    await ensureUserProfileForUser(user);

    return redirectResponse;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_exception`);
  }
}
