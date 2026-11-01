export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
  isConfigured: boolean;
  missingVars: string[];
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'https://tu-proyecto.supabase.co',
  'tu-clave-anon-o-publishable-publica',
  'your-project-url',
  'your-anon-key',
]);

export function getSupabaseEnv(): SupabaseEnvConfig {
  const rawUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ''
  ).trim();
  const rawKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ''
  ).trim();

  const missingVars: string[] = [];

  let isValidUrl = false;
  if (!rawUrl || PLACEHOLDER_VALUES.has(rawUrl)) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  } else {
    try {
      const parsed = new URL(rawUrl);
      isValidUrl = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      if (!isValidUrl) {
        missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
      }
    } catch {
      missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    }
  }

  if (!rawKey || PLACEHOLDER_VALUES.has(rawKey)) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    url: rawUrl,
    publishableKey: rawKey,
    isConfigured: isValidUrl && missingVars.length === 0,
    missingVars,
  };
}

export function getAppBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Sanitiza rutas de redirección post-login para impedir vulnerabilidades Open Redirect.
 */
export function sanitizeRedirectPath(nextParam: string | null | undefined, fallback = '/dashboard'): string {
  if (!nextParam || typeof nextParam !== 'string') {
    return fallback;
  }
  const trimmed = nextParam.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}
