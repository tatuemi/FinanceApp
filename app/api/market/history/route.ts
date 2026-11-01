import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { mapRangeToConfig, resolveMarketDataProvider, sanitizeCandle } from '@/lib/market-data/providers';
import { MarketDataError, type HistoryRange, type PriceCandle } from '@/lib/market-data/types';
import { normalizeEntityId } from '@/lib/utils/format';
import type { InvestmentAssetRow, InvestmentPriceHistoryRow } from '@/types/database';

const VALID_RANGES = new Set<HistoryRange>(['1M', '3M', '6M', '1Y', '5Y']);
const HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas para velas diarias/semanales

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Debes iniciar sesión.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawAssetId = searchParams.get('assetId') ?? '';
  const rawRange = (searchParams.get('range') ?? '3M').toUpperCase() as HistoryRange;
  const forceRefresh = searchParams.get('force') === 'true';

  let assetId: string;
  try {
    assetId = normalizeEntityId(rawAssetId);
  } catch {
    return NextResponse.json(
      { error: 'INVALID_ASSET_ID', message: 'Identificador de activo inválido.' },
      { status: 400 }
    );
  }

  const range: HistoryRange = VALID_RANGES.has(rawRange) ? rawRange : '3M';
  const cfg = mapRangeToConfig(range);

  const supabase = await createServerSupabaseClient();

  const { data: assetData } = await supabase
    .from('investment_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', user.id)
    .maybeSingle();

  const asset = assetData as InvestmentAssetRow | null;
  if (!asset) {
    return NextResponse.json(
      { error: 'ASSET_NOT_FOUND', message: 'Activo no encontrado en tu portafolio.' },
      { status: 404 }
    );
  }

  const cutoffDateIso = new Date(Date.now() - cfg.lookbackDays * 86400 * 1000).toISOString();

  // Consultar velas almacenadas en PostgreSQL para este activo e intervalo
  const { data: storedRowsData } = await supabase
    .from('investment_price_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('asset_id', assetId)
    .eq('interval', cfg.dbInterval)
    .gte('candle_at', cutoffDateIso)
    .order('candle_at', { ascending: true })
    .limit(1000);

  const storedRows = (storedRowsData ?? []) as InvestmentPriceHistoryRow[];
  const latestFetchedAt =
    storedRows.length > 0
      ? storedRows.reduce(
          (max, r) => (r.fetched_at > max ? r.fetched_at : max),
          storedRows[0]!.fetched_at
        )
      : null;

  const isCacheFresh =
    latestFetchedAt !== null &&
    Date.now() - new Date(latestFetchedAt).getTime() < HISTORY_CACHE_TTL_MS;

  const mapRowsToCandles = (rows: InvestmentPriceHistoryRow[]): PriceCandle[] => {
    const out: PriceCandle[] = [];
    for (const r of rows) {
      const c = sanitizeCandle({
        time: Math.floor(new Date(r.candle_at).getTime() / 1000),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      });
      if (c) out.push(c);
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  };

  if (storedRows.length >= 5 && isCacheFresh && !forceRefresh) {
    return NextResponse.json({
      symbol: asset.symbol,
      range,
      interval: cfg.dbInterval,
      provider: storedRows[0]?.provider ?? 'cache',
      fetchedAt: latestFetchedAt,
      fromCache: true,
      stale: false,
      quotaExhausted: false,
      candles: mapRowsToCandles(storedRows),
    });
  }

  const provider = resolveMarketDataProvider();
  const querySymbol = (asset.provider_symbol ?? asset.symbol).trim().toUpperCase();

  try {
    const freshCandles = await provider.getHistory(querySymbol, range);
    const fetchedAtNow = new Date().toISOString();

    if (freshCandles.length > 0) {
      const rowsToUpsert = freshCandles.map((c) => ({
        user_id: user.id,
        asset_id: assetId,
        interval: cfg.dbInterval,
        candle_at: new Date(c.time * 1000).toISOString(),
        open: c.open.toFixed(8),
        high: c.high.toFixed(8),
        low: c.low.toFixed(8),
        close: c.close.toFixed(8),
        volume: c.volume !== undefined ? c.volume.toFixed(10) : null,
        provider: provider.name,
        fetched_at: fetchedAtNow,
      }));

      await supabase.from('investment_price_history').upsert(rowsToUpsert as never, {
        onConflict: 'user_id,asset_id,interval,candle_at',
      });
    }

    const filteredFresh = freshCandles.filter(
      (c) => c.time * 1000 >= new Date(cutoffDateIso).getTime()
    );

    return NextResponse.json({
      symbol: asset.symbol,
      range,
      interval: cfg.dbInterval,
      provider: provider.name,
      fetchedAt: fetchedAtNow,
      fromCache: false,
      stale: false,
      quotaExhausted: false,
      candles: filteredFresh,
    });
  } catch (err) {
    const isMarketErr = err instanceof MarketDataError;
    const errorCode = isMarketErr ? err.code : 'UPSTREAM_ERROR';
    const errorMsg = isMarketErr
      ? err.message
      : 'No se pudo obtener el historial del proveedor bursátil.';

    // Degradación controlada: si hay puntos históricos en PostgreSQL, devolverlos con aviso
    if (storedRows.length > 0) {
      return NextResponse.json({
        symbol: asset.symbol,
        range,
        interval: cfg.dbInterval,
        provider: storedRows[0]?.provider ?? 'cache',
        fetchedAt: latestFetchedAt,
        fromCache: true,
        stale: true,
        quotaExhausted: errorCode === 'RATE_LIMIT_EXCEEDED',
        warningCode: errorCode,
        warningMessage: errorMsg,
        candles: mapRowsToCandles(storedRows),
      });
    }

    return NextResponse.json({
      symbol: asset.symbol,
      range,
      interval: cfg.dbInterval,
      provider: provider.name,
      fetchedAt: null,
      fromCache: false,
      stale: false,
      quotaExhausted: errorCode === 'RATE_LIMIT_EXCEEDED',
      warningCode: errorCode,
      warningMessage: errorMsg,
      candles: [],
    });
  }
}
