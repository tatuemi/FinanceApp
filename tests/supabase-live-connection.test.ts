import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { getSupabaseEnv } from '@/lib/supabase/env';

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

describe('Conexión Real con Supabase y Google OAuth 2.0 (.env.local)', () => {
  it('valida las credenciales reales en .env.local y verifica el endpoint de Google OAuth y PostgREST', async () => {
    const localVars = loadEnvLocal();
    if (localVars.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = localVars.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (localVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = localVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (localVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
        localVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    }

    const env = getSupabaseEnv();
    expect(env.isConfigured).toBe(true);
    expect(env.url).toBe('https://bthuewjxzhuggrcpmwvf.supabase.co');

    const supabase = createClient(env.url, env.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Verificar generación de URL de inicio de sesión con Google OAuth 2.0
    const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        scopes: 'openid email profile',
        skipBrowserRedirect: true,
      },
    });

    expect(oauthError).toBeNull();
    expect(oauthData?.url).toContain('https://bthuewjxzhuggrcpmwvf.supabase.co/auth/v1/authorize');
    expect(oauthData?.url).toContain('provider=google');

    // 2. Verificar el endpoint Auth Settings de la instancia real de Supabase
    const authSettingsRes = await fetch(`${env.url}/auth/v1/settings`, {
      headers: {
        apikey: env.publishableKey,
      },
    });
    expect(authSettingsRes.status).toBe(200);
    const authSettings = (await authSettingsRes.json()) as {
      external?: { google?: boolean };
    };
    expect(authSettings.external?.google).toBe(true);

    // 3. Verificar que las 7 tablas existan en PostgREST y bloqueen acceso anónimo (RLS / REVOKE anon)
    const tables = [
      'profiles',
      'finance_categories',
      'finance_transactions',
      'investment_assets',
      'investment_transactions',
      'investment_quote_cache',
      'investment_price_history',
    ] as const;

    for (const table of tables) {
      const { data: anonRows, error: anonError } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      expect(anonRows).toBeNull();
      expect(anonError).not.toBeNull();
      expect(anonError?.code).not.toBe('PGRST205');
      expect(anonError?.code).toBe('42501');
    }
  });
});
