import React from 'react';
import Link from 'next/link';
import { getFinanceDashboardData } from '@/lib/finance/queries';
import { getPortfolioSnapshotData } from '@/lib/investments/queries';
import {
  formatCurrencyUSD,
  formatDateISOToDisplay,
  formatPercentage,
  formatSharePriceUSD,
  formatShareQuantity,
  formatTimestampToDisplay,
} from '@/lib/utils/format';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Briefcase,
  ArrowRight,
  AlertTriangle,
  Receipt,
} from 'lucide-react';

export default async function MainDashboardPage() {
  const [financeData, portfolioData] = await Promise.all([
    getFinanceDashboardData(),
    getPortfolioSnapshotData(),
  ]);

  const { current, previous, balanceDiff } = financeData.metrics.comparison;
  const { overview } = portfolioData;

  const unrealizedPositive =
    overview.totalUnrealizedGainLoss !== null &&
    Number(overview.totalUnrealizedGainLoss) >= 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Resumen General
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Panorama consolidado de tus finanzas personales ({current.periodLabel}) y tu portafolio de inversiones en USD
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/finances"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Wallet className="h-3.5 w-3.5 text-indigo-400" />
            <span>Ir a Finanzas</span>
          </Link>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Ver Portafolio</span>
          </Link>
        </div>
      </div>

      {/* Bloque 1: Indicadores de Finanzas Personales del Mes */}
      <section aria-labelledby="dash-finance-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="dash-finance-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Módulo 1 · Finanzas Personales ({current.periodLabel})
          </h2>
          <Link
            href="/finances"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            <span>Gestionar mes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Ingresos del mes</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              {formatCurrencyUSD(current.incomeTotal)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {current.incomeCount} operación(es) de ingreso
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Gastos del mes</span>
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-400">
              {formatCurrencyUSD(current.expenseTotal)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {current.expenseCount} operación(es) de gasto
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Balance Mensual</span>
              <Scale className="h-4 w-4 text-indigo-400" />
            </div>
            <p
              className={`mt-2 text-2xl font-bold ${
                Number(current.netBalance) >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrencyUSD(current.netBalance, { showSign: true })}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              vs {previous.periodLabel}: {formatCurrencyUSD(balanceDiff, { showSign: true })}
            </p>
          </div>
        </div>
      </section>

      {/* Bloque 2: Indicadores del Portafolio de Inversiones */}
      <section aria-labelledby="dash-portfolio-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="dash-portfolio-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Módulo 2 · Portafolio de Acciones y ETF
          </h2>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            <span>Detalle y gráficos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {overview.isValuationIncomplete && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Valoración parcial: <strong>{overview.unquotedSymbols.join(', ')}</strong> aún no tiene(n) cotización registrada.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <span className="text-xs font-medium text-slate-400">
              Valor de Mercado Valorado
            </span>
            <p className="mt-2 text-2xl font-bold text-white">
              {overview.valuedPositionsCount > 0
                ? formatCurrencyUSD(overview.totalMarketValue)
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Actualizado: {formatTimestampToDisplay(overview.lastQuoteUpdateAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <span className="text-xs font-medium text-slate-400">
              Costo Base en Cartera
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {formatCurrencyUSD(overview.totalCostBasis)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {overview.activePositionsCount} posición(es) abierta(s)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <span className="text-xs font-medium text-slate-400">
              G/P No Realizada
            </span>
            <p
              className={`mt-2 text-2xl font-bold ${
                overview.totalUnrealizedGainLoss === null
                  ? 'text-slate-400'
                  : unrealizedPositive
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {overview.totalUnrealizedGainLoss !== null
                ? formatCurrencyUSD(overview.totalUnrealizedGainLoss, { showSign: true })
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Rentabilidad:{' '}
              {formatPercentage(overview.totalUnrealizedReturnPct, { showSign: true })}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <span className="text-xs font-medium text-slate-400">
              Resultado Realizado (Ventas)
            </span>
            <p
              className={`mt-2 text-2xl font-bold ${
                Number(overview.totalRealizedGainLoss) >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {formatCurrencyUSD(overview.totalRealizedGainLoss, { showSign: true })}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Activos registrados: {overview.totalAssetsRegistered}
            </p>
          </div>
        </div>
      </section>

      {/* Bloque 3: Actividad Reciente y Posiciones Principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Últimos Movimientos Financieros
            </h3>
            <Link
              href="/transactions"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Ver todo
            </Link>
          </div>

          {financeData.recentTransactions.length === 0 ? (
            <div className="my-8 flex flex-col items-center justify-center text-center">
              <Receipt className="h-8 w-8 text-slate-600" />
              <p className="mt-2 text-xs text-slate-400">
                Sin movimientos registrados en {current.periodLabel}.
              </p>
              <Link
                href="/finances"
                className="mt-3 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                + Registrar movimiento
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/70">
              {financeData.recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-white">{tx.description}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateISOToDisplay(tx.transaction_date)} ·{' '}
                      {tx.category?.name ?? 'Categoría'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-semibold ${
                      tx.transaction_type === 'income'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {tx.transaction_type === 'income' ? '+' : '-'}
                    {formatCurrencyUSD(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Principales Posiciones en Cartera
            </h3>
            <Link
              href="/portfolio"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Ver portafolio
            </Link>
          </div>

          {overview.positions.length === 0 ? (
            <div className="my-8 flex flex-col items-center justify-center text-center">
              <Briefcase className="h-8 w-8 text-slate-600" />
              <p className="mt-2 text-xs text-slate-400">
                Sin posiciones activas en el portafolio.
              </p>
              <Link
                href="/assets"
                className="mt-3 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                + Añadir activo
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/70">
              {overview.positions.slice(0, 5).map((pos) => (
                <div
                  key={pos.assetId}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{pos.symbol}</span>
                      <span className="text-[11px] text-slate-400">
                        {formatShareQuantity(pos.quantity)} títulos
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Costo prom: {formatSharePriceUSD(pos.averageCostPerShare)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {pos.marketValue !== null
                        ? formatCurrencyUSD(pos.marketValue)
                        : formatCurrencyUSD(pos.costBasis)}
                    </p>
                    <p className="text-[11px] text-indigo-300">
                      {pos.portfolioWeightPct !== null
                        ? `Peso: ${formatPercentage(pos.portfolioWeightPct)}`
                        : 'Cotización pendiente'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
