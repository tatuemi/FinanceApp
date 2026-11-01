import React from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-400" aria-hidden="true" />
      <p className="text-xs font-medium text-slate-400">
        Consultando datos verificados de tu cuenta...
      </p>
    </div>
  );
}
