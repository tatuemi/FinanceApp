import React from 'react';
import { requireAuthenticatedUser, ensureUserProfileForUser } from '@/lib/auth/session';
import { AppShell } from '@/components/dashboard/AppShell';
import { AlertTriangle } from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthenticatedUser();
  const profile = await ensureUserProfileForUser(user);
  const isSchemaPending = profile.id === '0';

  return (
    <AppShell
      userEmail={user.email ?? 'usuario@google.com'}
      fullName={profile.full_name ?? user.email?.split('@')[0] ?? 'Usuario'}
      avatarUrl={profile.avatar_url}
    >
      {isSchemaPending && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">
              Migración SQL pendiente en tu instancia de Supabase
            </p>
            <p className="mt-1 leading-relaxed text-amber-200/90">
              Tu sesión con Google OAuth está activa, pero las 7 tablas del proyecto aún no han sido creadas en tu base de datos de Supabase. Abre el{' '}
              <strong>SQL Editor</strong> de tu panel de Supabase, pega el contenido de{' '}
              <code className="rounded bg-amber-950/70 px-1.5 py-0.5 font-mono text-amber-300">
                supabase/migrations/20261028000001_initial_schema_and_security.sql
              </code>{' '}
              y pulsa <strong>Run</strong> para activar todas las tablas, triggers y políticas RLS.
            </p>
          </div>
        </div>
      )}
      {children}
    </AppShell>
  );
}
