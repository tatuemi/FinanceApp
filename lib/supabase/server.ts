import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { getSupabaseEnv } from './env';

export async function createServerSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new Error(
      `Configuración de Supabase pendiente. Configura ${env.missingVars.join(', ')} en .env.local.`
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // En Server Components puros, setAll puede fallar de forma esperada;
          // el middleware se encarga de refrescar las cookies de sesión.
        }
      },
    },
  });
}
