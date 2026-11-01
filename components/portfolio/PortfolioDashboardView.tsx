'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InvestmentAssetRow } from '@/types/database';
import type {
  AssetPositionValuation,
  PortfolioOverviewMetrics,
} from '@/lib/investments/calculations';
import { upsertManualQuoteAction } from '@/lib/investments/actions';
import {
  formatCurrencyUSD,
  formatPercentage,
  formatSharePriceUSD,
  formatShareQuantity,
  formatTimestampToDisplay,
} from '@/lib/utils/format';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PortfolioAllocationChart } from '@/components/charts/PortfolioAllocationChart';
import { AssetPriceChart } from '@/components/charts/AssetPriceChart';
import {
  RefreshCw,
  Edit3,
  AlertTriangle,
  TrendingUp,
  Briefcase,
  ArrowLeftRight,
  Clock,
  Info,
  X,
  Loader2,
} from 'lucide-react';

interface PortfolioDashboardViewProps {
  assets: InvestmentAssetRow[];
  overview: PortfolioOverviewMetrics;
}

export function PortfolioDashboardView({
  assets,
  overview,
}: PortfolioDashboardViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{
    type: 'ok' | 'warn';
    text: string;
  } | null>(null);

  // Estado de modal de cotización manual
  const [manualModalAsset, setManualModalAsset] = useState<AssetPositionValuation | null>(
    null
  );
  const [manualPrice, setManualPrice] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const autoRefreshTriggeredRef = useRef(false);

  // Refresco automático no bloqueante al abrir el portafolio si existen posiciones sin cotización o con caché vencida (>15 min)
  useEffect(() => {
    if (autoRefreshTriggeredRef.current) return;
    const staleOrMissing = overview.positions.filter(
      (p) => !p.hasValidQuote || p.isQuoteStale
    );
    if (staleOrMissing.length === 0) return;

    autoRefreshTriggeredRef.current = true;
    let cancelled = false;

    async function autoSyncMissingOrStaleQuotes() {
      let updatedAny = false;
      for (const pos of staleOrMissing) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/market/quote?assetId=${encodeURIComponent(pos.assetId)}`,
            { method: 'GET', headers: { Accept: 'application/json' } }
          );
          if (res.ok) {
            const payload = (await res.json()) as {
              quote?: unknown;
              fromCache?: boolean;
              quotaExhausted?: boolean;
            };
            if (payload.quote && !payload.fromCache) {
              updatedAny = true;
            }
            if (payload.quotaExhausted) {
              break;
            }
          }
        } catch {
          // Ignorar silenciosamente si no hay proveedor automático configurado
        }
      }
      if (!cancelled && updatedAny) {
        router.refresh();
      }
    }

    void autoSyncMissingOrStaleQuotes();

    return () => {
      cancelled = true;
    };
  }, [overview.positions, router]);

  async function handleRefreshAllQuotes() {
    if (overview.positions.length === 0) return;
    setIsRefreshingQuotes(true);
    setRefreshMessage(null);

    let updatedCount = 0;
    let quotaHit = false;
    let lastWarning: string | null = null;

    for (const pos of overview.positions) {
      try {
        const res = await fetch(
          `/api/market/quote?assetId=${encodeURIComponent(pos.assetId)}&force=true`,
          { method: 'GET', headers: { Accept: 'application/json' } }
        );
        const payload = (await res.json()) as {
          quote?: unknown;
          quotaExhausted?: boolean;
          warningMessage?: string;
          message?: string;
        };

        if (payload.quotaExhausted) {
          quotaHit = true;
          lastWarning =
            payload.warningMessage ??
            payload.message ??
            'Límite gratuito de la API alcanzado (429).';
          break;
        }
        if (res.ok && payload.quote) {
          updatedCount += 1;
        } else if (payload.message) {
          lastWarning = payload.message;
        }
      } catch {
        lastWarning = 'No se pudo conectar con el servidor de cotizaciones.';
      }
    }

    setIsRefreshingQuotes(false);

    if (quotaHit) {
      setRefreshMessage({
        type: 'warn',
        text:
          lastWarning ??
          'Se alcanzó el límite gratuito del proveedor. Puedes continuar utilizando cotizaciones manuales.',
      });
    } else if (updatedCount > 0) {
      setRefreshMessage({
        type: 'ok',
        text: `Cotizaciones actualizadas para ${updatedCount} activo(s).`,
      });
    } else if (lastWarning) {
      setRefreshMessage({
        type: 'warn',
        text: `${lastWarning} Puedes fijar precios de referencia manuales en cualquier momento.`,
      });
    }

    router.refresh();
  }

  function openManualQuoteModal(pos: AssetPositionValuation) {
    setManualModalAsset(pos);
    setManualPrice(pos.quotePrice ? Number(pos.quotePrice).toString() : '');
    setManualError(null);
  }

  function handleSaveManualQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!manualModalAsset) return;
    setManualError(null);

    startTransition(async () => {
      const res = await upsertManualQuoteAction({
        assetId: manualModalAsset.assetId,
        price: manualPrice,
      });

      if (!res.success) {
        setManualError(res.message);
        return;
      }

      setManualModalAsset(null);
      setRefreshMessage({ type: 'ok', text: res.message });
      router.refresh();
    });
  }

  const unrealizedIsPositive =
    overview.totalUnrealizedGainLoss !== null &&
    Number(overview.totalUnrealizedGainLoss) >= 0;
  const realizedIsPositive = Number(overview.totalRealizedGainLoss) >= 0;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Portafolio de Inversiones
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Valoración en USD · Método de Costo Promedio Ponderado Móvil · Acciones, ETF y Criptos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshAllQuotes()}
            disabled={isRefreshingQuotes || overview.positions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-indigo-400 ${
                isRefreshingQuotes ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isRefreshingQuotes ? 'Actualizando...' : 'Actualizar cotizaciones'}
            </span>
          </button>

          <Link
            href="/assets"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
            <span>Activos ({overview.totalAssetsRegistered})</span>
          </Link>

          <Link
            href="/investments"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Registrar compra / venta</span>
          </Link>
        </div>
      </div>

      {refreshMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
            refreshMessage.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          <span>{refreshMessage.text}</span>
          <button
            type="button"
            onClick={() => setRefreshMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Alerta explícita cuando existan posiciones sin cotización (Sección 5.3.E) */}
      {overview.isValuationIncomplete && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">
              Valoración de mercado incompleta ({overview.unquotedPositionsCount} posición(es) pendiente(s) de cotización)
            </p>
            <p className="mt-1 leading-relaxed text-amber-200/90">
              Los siguientes activos en cartera aún no tienen una cotización válida registrada:{' '}
              <strong>{overview.unquotedSymbols.join(', ')}</strong>. Para evitar distorsiones, no se asume que su precio sea $0.00. Puedes pulsar «Actualizar cotizaciones» o asignarles un precio manual en la tabla inferior.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas de indicadores del portafolio */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <span className="text-xs font-medium text-slate-400">
            Valor de Mercado Total
          </span>
          <p className="mt-2 text-2xl font-bold text-white">
            {overview.valuedPositionsCount > 0
              ? formatCurrencyUSD(overview.totalMarketValue)
              : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {overview.isValuationIncomplete
              ? `Parcial (${overview.valuedPositionsCount}/${overview.activePositionsCount} valoradas)`
              : `${overview.activePositionsCount} posición(es) activa(s)`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <span className="text-xs font-medium text-slate-400">
            Costo Base Restante
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-100">
            {formatCurrencyUSD(overview.totalCostBasis)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Incluye comisiones de compra
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <span className="text-xs font-medium text-slate-400">
            G/P No Realizada
          </span>
          <p
            className={`mt-2 text-2xl font-bold ${
              overview.totalUnrealizedGainLoss === null
                ? 'text-slate-400'
                : unrealizedIsPositive
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
            <strong
              className={
                overview.totalUnrealizedReturnPct === null
                  ? 'text-slate-400'
                  : unrealizedIsPositive
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }
            >
              {formatPercentage(overview.totalUnrealizedReturnPct, { showSign: true })}
            </strong>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <span className="text-xs font-medium text-slate-400">
            Resultado Realizado (Ventas)
          </span>
          <p
            className={`mt-2 text-2xl font-bold ${
              realizedIsPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrencyUSD(overview.totalRealizedGainLoss, { showSign: true })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Neto tras comisiones de venta
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <span className="text-xs font-medium text-slate-400">
            Última valoración
          </span>
          <p className="mt-2 text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>{formatTimestampToDisplay(overview.lastQuoteUpdateAt)}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Activos en cartera: <strong className="text-white">{overview.activePositionsCount}</strong>
          </p>
        </div>
      </div>

      {/* Distribución por activo y Distribución Acciones vs ETF */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortfolioAllocationChart
            positions={overview.positions}
            unquotedSymbols={overview.unquotedSymbols}
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Distribución por Tipo de Instrumento
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Desglose entre Acciones (Stocks), ETF y Criptos valorados
            </p>

            {overview.assetTypeDistribution.length === 0 ? (
              <div className="my-10 text-center text-xs text-slate-500">
                Sin posiciones valoradas para desglosar por tipo de activo.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {overview.assetTypeDistribution.map((item) => (
                  <div
                    key={item.assetType}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        {item.label} ({item.assetCount})
                      </span>
                      <span className="font-bold text-indigo-400">
                        {formatPercentage(item.percentage)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-200">
                      {formatCurrencyUSD(item.marketValue)}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.min(100, Math.max(4, Number(item.percentage)))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-[11px] text-slate-400">
            <p className="font-medium text-slate-300">Método contable:</p>
            <p className="mt-0.5">
              Costo promedio ponderado móvil con precisión decimal exacta. Las comisiones aumentan el costo base en compras y reducen el ingreso neto en ventas.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Posiciones en Cartera */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Posiciones Abiertas en Cartera ({overview.positions.length})
            </h2>
            <p className="text-xs text-slate-400">
              Detalle de títulos, costo promedio, cotización de referencia, rentabilidad y peso porcentual
            </p>
          </div>
        </div>

        {overview.positions.length === 0 ? (
          <div className="my-10 flex flex-col items-center justify-center text-center">
            <TrendingUp className="h-9 w-9 text-slate-600" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              Aún no tienes posiciones abiertas en tu portafolio
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Primero registra una acción o ETF en «Activos» y después añade tu primera operación de compra (admite títulos fraccionados o compra por importe en USD).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/assets"
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                1. Gestionar Activos
              </Link>
              <Link
                href="/investments"
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                2. Registrar Compra
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Activo</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Costo Promedio</th>
                  <th className="py-2.5 px-3 text-right">Costo Base</th>
                  <th className="py-2.5 px-3 text-right">Último Precio</th>
                  <th className="py-2.5 px-3 text-center">Estado Cotización</th>
                  <th className="py-2.5 px-3 text-right">Valor Mercado</th>
                  <th className="py-2.5 px-3 text-right">G/P No Realizada</th>
                  <th className="py-2.5 px-3 text-right">Peso %</th>
                  <th className="py-2.5 pl-3 text-right">Precio Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {overview.positions.map((pos) => {
                  const posGain =
                    pos.unrealizedGainLoss !== null && Number(pos.unrealizedGainLoss) >= 0;
                  const badgeStatus = !pos.hasValidQuote
                    ? 'missing'
                    : pos.isManualQuote
                    ? 'manual'
                    : pos.isQuoteStale
                    ? 'stale'
                    : 'live';

                  return (
                    <tr key={pos.assetId} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{pos.symbol}</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                            {pos.assetType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {pos.name}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                        {formatShareQuantity(pos.quantity)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap">
                        {formatSharePriceUSD(pos.averageCostPerShare)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-200 whitespace-nowrap">
                        {formatCurrencyUSD(pos.costBasis)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {pos.hasValidQuote ? (
                          <div>
                            <span className="font-semibold text-white">
                              {formatSharePriceUSD(pos.quotePrice)}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {formatTimestampToDisplay(pos.quoteFetchedAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-amber-400">Pendiente</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <StatusBadge
                          status={badgeStatus}
                          label={
                            !pos.hasValidQuote
                              ? 'Sin cotización'
                              : pos.isManualQuote
                              ? 'Manual'
                              : pos.isQuoteStale
                              ? 'Desactualizada'
                              : pos.quoteProvider ?? 'Mercado'
                          }
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-white whitespace-nowrap">
                        {pos.marketValue !== null ? formatCurrencyUSD(pos.marketValue) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {pos.unrealizedGainLoss !== null ? (
                          <div>
                            <span
                              className={`font-semibold ${
                                posGain ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatCurrencyUSD(pos.unrealizedGainLoss, { showSign: true })}
                            </span>
                            <p
                              className={`text-[11px] ${
                                posGain ? 'text-emerald-300/90' : 'text-rose-300/90'
                              }`}
                            >
                              {formatPercentage(pos.unrealizedReturnPct, { showSign: true })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-indigo-300 whitespace-nowrap">
                        {pos.portfolioWeightPct !== null
                          ? formatPercentage(pos.portfolioWeightPct)
                          : '—'}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openManualQuoteModal(pos)}
                          aria-label={`Asignar precio manual a ${pos.symbol}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                        >
                          <Edit3 className="h-3 w-3 text-indigo-400" />
                          <span>Manual</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gráfico Histórico por Activo con lightweight-charts */}
      <AssetPriceChart
        assets={assets.map((a) => ({
          id: a.id,
          symbol: a.symbol,
          name: a.name,
        }))}
      />

      {/* Aviso discreto sobre tratamiento de datos bursátiles y limitaciones v1 (Sección 5.3.D y 5.3.I) */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 text-[11px] text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="space-y-1 leading-relaxed">
          <p>
            <strong className="text-slate-300">Aviso sobre datos bursátiles:</strong> Esta aplicación es una herramienta personal de registro y seguimiento, no un sistema de ejecución de órdenes conectado a un bróker. Las cotizaciones gratuitas pueden presentar retraso respecto al mercado en tiempo real y las métricas dependen de los datos disponibles. Esta herramienta no sustituye el análisis financiero personal.
          </p>
          <p>
            <strong className="text-slate-300">Alcance de la versión 1.0:</strong> El cálculo de posiciones utiliza el método de costo promedio ponderado móvil en USD. Las operaciones corporativas complejas (splits automáticos, fusiones o reinversión automática de dividendos) deben registrarse mediante ajustes explícitos de transacciones.
          </p>
        </div>
      </div>

      {/* Modal de Cotización Manual */}
      {manualModalAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Precio de referencia manual ({manualModalAsset.symbol})
              </h3>
              <button
                type="button"
                onClick={() => setManualModalAsset(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Introduce el precio unitario en USD para valorar tu posición en{' '}
              <strong className="text-slate-200">{manualModalAsset.name}</strong>. Quedará identificado explícitamente con origen <strong>Manual</strong>.
            </p>

            <form onSubmit={handleSaveManualQuote} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="manual-quote-price"
                  className="block text-xs font-medium text-slate-300"
                >
                  Precio por título (USD) *
                </label>
                <input
                  id="manual-quote-price"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Ej. 225.50"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {manualError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {manualError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualModalAsset(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar cotización manual</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
