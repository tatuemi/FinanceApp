import React from 'react';
import { getSupabaseEnv, sanitizeRedirectPath } from '@/lib/supabase/env';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';
import { ShieldCheck, TrendingUp, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    reason?: string;
    next?: string;
  }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'El inicio de sesión con Google fue cancelado o denegado.',
  missing_code: 'No se recibió un código de autorización válido.',
  exchange_failed: 'El código de autenticación expiró o ya fue utilizado. Intenta iniciar sesión nuevamente.',
  session_invalid: 'No se pudo verificar la identidad del usuario.',
  callback_exception: 'Ocurrió un error al establecer la sesión segura.',
};

const REASON_MESSAGES: Record<string, string> = {
  session_required: 'Tu sesión ha expirado o necesitas autenticarte para acceder a esa sección.',
  signed_out: 'Has cerrado sesión correctamente.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const env = getSupabaseEnv();
  const nextPath = sanitizeRedirectPath(params.next, '/dashboard');
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? 'Error de autenticación.' : null;
  const reasonMessage = params.reason ? REASON_MESSAGES[params.reason] ?? null : null;

  return (
    <main className="flex min-h-screen flex-col justify-center bg-[#090d16] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
            <TrendingUp className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Finanzas & Portafolio
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Gestión personal de ingresos, gastos y portafolio de acciones y ETF en USD
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-xl backdrop-blur sm:p-8">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {reasonMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              <span>{reasonMessage}</span>
            </div>
          )}

          {!env.isConfigured && (
            <div
              role="region"
              aria-label="Instrucciones de configuración de credenciales"
              className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Configuración de Supabase pendiente</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-amber-200/90">
                Para activar la autenticación con Google y la persistencia en PostgreSQL, copia{' '}
                <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-amber-300">
                  .env.example
                </code>{' '}
                a{' '}
                <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-amber-300">
                  .env.local
                </code>{' '}
                y configura:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-[11px] text-amber-300">
                {env.missingVars.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-200/80">
                No se utilizan datos ficticios ni sesiones simuladas: las rutas privadas permanecen protegidas hasta contar con una sesión verificada.
              </p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Acceso a tu cuenta</h2>
              <p className="mt-1 text-xs text-slate-400">
                Si ya tienes cuenta inicia sesión con tu correo y contraseña, o crea una cuenta nueva si eres nuevo.
              </p>
            </div>

            <EmailAuthForm isConfigured={env.isConfigured} nextPath={nextPath} />

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-800" />
              <span className="mx-3 shrink-0 text-[11px] uppercase tracking-wider text-slate-500">
                o acceso rápido con
              </span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <GoogleSignInButton
              isConfigured={env.isConfigured}
              supabaseUrl={env.isConfigured ? env.url : undefined}
              supabaseKey={env.isConfigured ? env.publishableKey : undefined}
              nextPath={nextPath}
            />

            <div className="border-t border-slate-800 pt-5">
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Aislamiento total por usuario mediante PostgreSQL Row Level Security (RLS)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Wallet className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span>Control de ingresos, gastos, acciones, ETF y criptos en USD ($0/mes)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Aplicación personal de registro financiero y seguimiento de portafolio. No ejecuta órdenes de bróker ni constituye asesoría financiera.
        </p>
      </div>
    </main>
  );
}
