'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { HistoryRange, PriceCandle } from '@/lib/market-data/types';
import { formatCurrencyUSD, formatTimestampToDisplay } from '@/lib/utils/format';
import {
  RefreshCw,
  AlertTriangle,
  BarChart2,
  TrendingUp,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface AssetPriceChartProps {
  assets: {
    id: string;
    symbol: string;
    name: string;
  }[];
  initialAssetId?: string;
}

const RANGES: HistoryRange[] = ['1M', '3M', '6M', '1Y', '5Y'];

export function AssetPriceChart({ assets, initialAssetId }: AssetPriceChartProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    initialAssetId ?? assets[0]?.id ?? ''
  );
  const [range, setRange] = useState<HistoryRange>('3M');
  const [chartType, setChartType] = useState<'area' | 'candles'>('area');
  const [candles, setCandles] = useState<PriceCandle[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{
    dateStr: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
  } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!selectedAssetId && assets[0]?.id) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const fetchHistory = useCallback(
    async (force = false) => {
      if (!selectedAssetId) return;
      setIsLoading(true);
      setWarningMessage(null);

      try {
        const res = await fetch(
          `/api/market/history?assetId=${encodeURIComponent(
            selectedAssetId
          )}&range=${encodeURIComponent(range)}${force ? '&force=true' : ''}`,
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }
        );

        const data = (await res.json()) as {
          candles?: PriceCandle[];
          provider?: string;
          fetchedAt?: string | null;
          stale?: boolean;
          quotaExhausted?: boolean;
          warningMessage?: string;
          message?: string;
        };

        setCandles(Array.isArray(data.candles) ? data.candles : []);
        setProvider(data.provider ?? '');
        setFetchedAt(data.fetchedAt ?? null);
        setIsStale(Boolean(data.stale));
        setQuotaExhausted(Boolean(data.quotaExhausted));
        setWarningMessage(data.warningMessage ?? data.message ?? null);
      } catch {
        setCandles([]);
        setWarningMessage('No se pudo cargar el historial bursátil. Comprueba tu conexión.');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAssetId, range]
  );

  useEffect(() => {
    void fetchHistory(false);
  }, [fetchHistory]);

  // Inicializar y actualizar instancia de lightweight-charts limpiándola al desmontar
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || candles.length === 0) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 310,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1120' },
        textColor: '#94a3b8',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
      },
    });

    chartInstanceRef.current = chart;

    const candleMap = new Map<number, PriceCandle>();
    for (const c of candles) {
      candleMap.set(c.time, c);
    }

    if (chartType === 'candles') {
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#f43f5e',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#f43f5e',
      });

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    } else {
      const firstPrice = candles[0]?.close ?? 0;
      const lastPrice = candles[candles.length - 1]?.close ?? 0;
      const isPositive = lastPrice >= firstPrice;

      const areaSeries = chart.addAreaSeries({
        lineColor: isPositive ? '#10b981' : '#f43f5e',
        topColor: isPositive ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)',
        bottomColor: isPositive ? 'rgba(16, 185, 129, 0.02)' : 'rgba(244, 63, 94, 0.02)',
        lineWidth: 2,
      });

      areaSeries.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
      );
    }

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || typeof param.time !== 'number') {
        setHoverInfo(null);
        return;
      }
      const matched = candleMap.get(param.time);
      if (matched) {
        setHoverInfo({
          dateStr: new Date(matched.time * 1000).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          close: matched.close,
          open: matched.open,
          high: matched.high,
          low: matched.low,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [candles, chartType]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        <BarChart2 className="mx-auto h-8 w-8 text-slate-500" />
        <h3 className="mt-2 text-sm font-semibold text-slate-200">
          Gráfico histórico por activo
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Registra tu primera acción o ETF para consultar su evolución histórica de precios.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="chart-asset-select" className="sr-only">
            Seleccionar activo
          </label>
          <select
            id="chart-asset-select"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol} — {asset.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                chartType === 'area'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Línea cierre
            </button>
            <button
              type="button"
              onClick={() => setChartType('candles')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                chartType === 'candles'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Velas OHLC
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-0.5"
            role="group"
            aria-label="Rango temporal del gráfico"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  range === r
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchHistory(true)}
            disabled={isLoading}
            aria-label="Actualizar historial del gráfico"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Información de precio al interactuar con el gráfico */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-xs font-medium text-slate-400">
            {selectedAsset?.symbol}{' '}
            {hoverInfo
              ? `(${hoverInfo.dateStr})`
              : latestCandle
              ? `(Último cierre registrado)`
              : ''}
          </span>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
            <span className="text-xl font-bold text-white">
              {hoverInfo
                ? formatCurrencyUSD(hoverInfo.close)
                : latestCandle
                ? formatCurrencyUSD(latestCandle.close)
                : '—'}
            </span>
            {hoverInfo && hoverInfo.open !== undefined && (
              <span className="text-[11px] text-slate-400">
                A: {formatCurrencyUSD(hoverInfo.open)} · Máx: {formatCurrencyUSD(hoverInfo.high)} · Mín:{' '}
                {formatCurrencyUSD(hoverInfo.low)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {provider && (
            <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5">
              Fuente: <strong className="text-slate-200 uppercase">{provider}</strong>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-500" />
            <span>Actualizado: {formatTimestampToDisplay(fetchedAt)}</span>
          </span>
        </div>
      </div>

      {(isStale || quotaExhausted || warningMessage) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            {quotaExhausted && (
              <p className="font-semibold">
                Cuota gratuita del proveedor alcanzada temporalmente (429).
              </p>
            )}
            <p className="text-amber-200/90">
              {warningMessage ??
                'Mostrando datos históricos almacenados en caché local. Los datos pueden presentar retraso respecto al mercado en vivo.'}
            </p>
          </div>
        </div>
      )}

      <div className="relative mt-4 min-h-[310px] w-full overflow-hidden rounded-xl border border-slate-800/80 bg-[#0b1120]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Cargando serie histórica verificada...</span>
            </div>
          </div>
        )}

        {candles.length === 0 && !isLoading ? (
          <div className="flex h-[310px] flex-col items-center justify-center px-6 text-center">
            <TrendingUp className="h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-300">
              Sin historial de precios disponible para {selectedAsset?.symbol} ({range})
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              No se inventan puntos históricos cuando el proveedor automático no está configurado o no devuelve velas para este símbolo. Puedes seguir operando con cotizaciones manuales.
            </p>
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[310px] w-full" />
        )}
      </div>

      {/* Atribución obligatoria Apache 2.0 de TradingView Lightweight Charts (Sección 5.3.G) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Aviso: Las cotizaciones históricas pueden presentar retrasos de mercado y no constituyen asesoría financiera.
        </span>
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-400 underline decoration-slate-700 underline-offset-2 hover:text-indigo-400"
        >
          <span>Charts powered by TradingView</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
