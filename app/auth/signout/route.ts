import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const env = getSupabaseEnv();

  if (env.isConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // Continuar hacia la redirección limpia a /login
    }
  }

  return NextResponse.redirect(`${origin}/login?reason=signed_out`, {
    status: 303,
  });
}
