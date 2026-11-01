import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Edit3, HelpCircle } from 'lucide-react';

export type QuoteStatusType =
  | 'live'
  | 'manual'
  | 'stale'
  | 'missing'
  | 'quota_exhausted';

interface StatusBadgeProps {
  status: QuoteStatusType;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          <span>{label ?? 'Mercado'}</span>
        </span>
      );
    case 'manual':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
          <Edit3 className="h-3 w-3" aria-hidden="true" />
          <span>{label ?? 'Manual'}</span>
        </span>
      );
    case 'stale':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>{label ?? 'Desactualizada'}</span>
        </span>
      );
    case 'quota_exhausted':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-medium text-orange-300">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          <span>{label ?? 'Límite gratuito alcanzado'}</span>
        </span>
      );
    case 'missing':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
          <HelpCircle className="h-3 w-3" aria-hidden="true" />
          <span>{label ?? 'Sin cotización'}</span>
        </span>
      );
  }
}
