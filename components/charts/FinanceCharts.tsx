'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  CategoryBreakdownItem,
  DailyBalancePoint,
} from '@/lib/finance/calculations';
import { formatCurrencyUSD, formatPercentage } from '@/lib/utils/format';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

interface FinanceBalanceEvolutionChartProps {
  dailyPoints: DailyBalancePoint[];
  periodLabel: string;
}

export function FinanceBalanceEvolutionChart({
  dailyPoints,
  periodLabel,
}: FinanceBalanceEvolutionChartProps) {
  const hasActivity = dailyPoints.some((p) => p.income > 0 || p.expense > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Evolución del Balance Acumulado
          </h3>
          <p className="text-xs text-slate-400">{periodLabel}</p>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex h-56 items-center justify-center text-center text-xs text-slate-500">
          Sin movimientos registrados en {periodLabel} para graficar la evolución diaria.
        </div>
      ) : (
        <div className="mt-4 h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyPoints} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="dayLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0]?.payload as DailyBalancePoint | undefined;
                  if (!pt) return null;
                  return (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs shadow-xl">
                      <p className="font-semibold text-slate-200">Fecha: {pt.date}</p>
                      <p className="mt-1 text-emerald-400">
                        Ingresos del día: {formatCurrencyUSD(pt.income)}
                      </p>
                      <p className="text-rose-400">
                        Gastos del día: {formatCurrencyUSD(pt.expense)}
                      </p>
                      <p className="mt-1 border-t border-slate-800 pt-1 font-semibold text-indigo-300">
                        Balance acumulado: {formatCurrencyUSD(pt.cumulativeBalance, { showSign: true })}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeBalance"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#balanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface CategoryBreakdownCardProps {
  title: string;
  subtitle: string;
  items: CategoryBreakdownItem[];
  emptyMessage: string;
}

export function CategoryBreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: CategoryBreakdownCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="flex h-44 items-center justify-center text-center text-xs text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    <CategoryIcon iconName={item.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium text-slate-200">{item.categoryName}</span>
                  <span className="text-[11px] text-slate-500">
                    ({item.transactionCount})
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-white">
                    {formatCurrencyUSD(item.totalAmount)}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400">
                    {formatPercentage(item.percentageOfKind)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(2, Number(item.percentageOfKind)))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
