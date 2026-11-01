'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-bold text-white">
        No se pudo completar la operación en este momento
      </h2>
      <p className="mt-1.5 max-w-md text-xs text-slate-400">
        Ocurrió un error recuperable al consultar el servicio. Tus datos están protegidos; comprueba tu conexión e inténtalo de nuevo.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Reintentar</span>
      </button>
    </div>
  );
}
