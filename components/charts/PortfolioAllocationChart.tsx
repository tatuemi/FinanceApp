'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AssetPositionValuation } from '@/lib/investments/calculations';
import { formatCurrencyUSD, formatPercentage } from '@/lib/utils/format';
import { PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';

interface PortfolioAllocationChartProps {
  positions: AssetPositionValuation[];
  unquotedSymbols: string[];
}

const CHART_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#f43f5e', // Rose
];

export function PortfolioAllocationChart({
  positions,
  unquotedSymbols,
}: PortfolioAllocationChartProps) {
  const valuedPositions = positions.filter(
    (p) => p.hasValidQuote && p.marketValue !== null && Number(p.marketValue) > 0
  );

  const chartData = valuedPositions.map((pos, index) => ({
    symbol: pos.symbol,
    name: pos.name,
    marketValue: Number(pos.marketValue ?? '0'),
    weightPct: Number(pos.portfolioWeightPct ?? '0'),
    color: CHART_PALETTE[index % CHART_PALETTE.length]!,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Distribución del Portafolio
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Peso porcentual por activo sobre el valor de mercado valorado
          </p>
        </div>

        <div className="my-8 flex flex-col items-center justify-center text-center">
          <PieChartIcon className="h-9 w-9 text-slate-600" />
          <p className="mt-2 text-sm font-medium text-slate-300">
            No hay posiciones valorables actualmente
          </p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Registra una compra y asigna una cotización de mercado o manual para visualizar la distribución porcentual.
          </p>
        </div>

        {unquotedSymbols.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Posiciones pendientes de cotización (no se asume precio $0):{' '}
              <strong>{unquotedSymbols.join(', ')}</strong>.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div>
        <h3 className="text-sm font-semibold text-white">
          Distribución del Portafolio
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Peso (%) = Valor del activo / Valor total valorado × 100
        </p>
      </div>

      <div className="mt-4 grid items-center gap-4 sm:grid-cols-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="marketValue"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.symbol} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload as (typeof chartData)[number] | undefined;
                  if (!item) return null;
                  return (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs shadow-xl">
                      <p className="font-bold text-white">
                        {item.symbol} — {item.name}
                      </p>
                      <p className="mt-1 text-slate-300">
                        Valor: <strong className="text-emerald-400">{formatCurrencyUSD(item.marketValue)}</strong>
                      </p>
                      <p className="text-slate-300">
                        Peso: <strong className="text-indigo-400">{formatPercentage(item.weightPct)}</strong>
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {chartData.map((item) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="truncate">
                  <span className="font-semibold text-white">{item.symbol}</span>
                  <span className="ml-1.5 text-[11px] text-slate-400 truncate">{item.name}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-slate-100">{formatPercentage(item.weightPct)}</p>
                <p className="text-[11px] text-slate-400">{formatCurrencyUSD(item.marketValue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {unquotedSymbols.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Valoración parcial: <strong>{unquotedSymbols.join(', ')}</strong> no cuenta(n) con cotización disponible y no se incluyen en el gráfico para no distorsionar los porcentajes.
          </span>
        </div>
      )}
    </div>
  );
}
