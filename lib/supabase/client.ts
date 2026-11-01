'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { getSupabaseEnv } from './env';

export function createBrowserSupabaseClient(overrideUrl?: string, overrideKey?: string) {
  const env = getSupabaseEnv();
  const url = (overrideUrl ?? env.url).trim();
  const key = (overrideKey ?? env.publishableKey).trim();

  if (!url || !key) {
    throw new Error(
      `Configuración de Supabase pendiente. Configura ${env.missingVars.join(', ')} en .env.local.`
    );
  }
  return createBrowserClient<Database>(url, key);
}
