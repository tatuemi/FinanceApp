'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserProfileAction } from '@/lib/finance/actions';
import { PwaInstaller } from '@/components/ui/PwaInstaller';
import {
  User,
  ShieldCheck,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface SettingsViewProps {
  userEmail: string;
  fullName: string;
  avatarUrl: string | null;
  baseCurrency: 'USD';
  marketDataProviderName: string;
  isMarketApiConfigured: boolean;
}

export function SettingsView({
  userEmail,
  fullName,
  baseCurrency,
  marketDataProviderName,
  isMarketApiConfigured,
}: SettingsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nameInput, setNameInput] = useState(fullName);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateUserProfileAction({
        fullName: nameInput,
        baseCurrency: 'USD',
      });

      setFeedback({
        type: res.success ? 'ok' : 'err',
        text: res.message,
      });

      if (res.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          Ajustes, Perfil e Instalación PWA
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Preferencias de cuenta, moneda base, estado de integraciones de costo cero e instalación móvil
        </p>
      </div>

      {/* Formulario de Perfil */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Perfil del Usuario</h2>
            <p className="text-xs text-slate-400">
              Identidad autenticada mediante Supabase Auth (Google OAuth 2.0)
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 max-w-lg space-y-4">
          <div>
            <label htmlFor="profile-email" className="block text-xs font-medium text-slate-400">
              Correo electrónico (Google)
            </label>
            <input
              id="profile-email"
              type="email"
              disabled
              value={userEmail}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="profile-name" className="block text-xs font-medium text-slate-300">
              Nombre para mostrar *
            </label>
            <input
              id="profile-name"
              type="text"
              required
              maxLength={120}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="profile-currency" className="block text-xs font-medium text-slate-300">
              Moneda base del sistema
            </label>
            <input
              id="profile-currency"
              type="text"
              disabled
              value={`${baseCurrency} — Dólar estadounidense (v1)`}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 cursor-not-allowed"
            />
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                feedback.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Guardar preferencias</span>
          </button>
        </form>
      </div>

      {/* Guía e Instalador PWA */}
      <PwaInstaller showInlineGuide />

      {/* Estado de Seguridad y Servicios de Costo Cero */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Seguridad y Aislamiento de Datos
            </h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            <li>• Claves sustitutas <code className="text-slate-200">BIGINT GENERATED ALWAYS AS IDENTITY</code> en todas las tablas.</li>
            <li>• Row Level Security (RLS) activo por <code className="text-slate-200">auth.uid() = user_id</code>.</li>
            <li>• El Service Worker excluye estrictamente rutas privadas y datos financieros.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">
              Proveedor Bursátil y Cuota Gratuita ($0 USD)
            </h3>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            <p>
              Proveedor seleccionado:{' '}
              <strong className="uppercase text-white">{marketDataProviderName}</strong>
            </p>
            <p>
              Estado de clave API en servidor:{' '}
              {isMarketApiConfigured ? (
                <span className="font-semibold text-emerald-400">
                  Configurada (Caché activa en PostgreSQL)
                </span>
              ) : (
                <span className="font-semibold text-amber-300">
                  Modo de cotización manual activo (sin clave API externa configurada)
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500">
              Cuando se agota el límite gratuito de un proveedor o no se configura clave, puedes seguir registrando operaciones y actualizando precios manualmente sin costo alguno.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
