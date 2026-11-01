import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveMarketDataProvider } from '@/lib/market-data/providers';
import { MarketDataError } from '@/lib/market-data/types';
import { normalizeEntityId } from '@/lib/utils/format';
import type { InvestmentAssetRow, InvestmentQuoteCacheRow } from '@/types/database';

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MIN_REFRESH_COOLDOWN_MS = 60 * 1000; // 60 segundos entre refrescos forzados

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

  const supabase = await createServerSupabaseClient();

  // Verificar que el activo pertenezca al usuario autenticado
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

  // Consultar caché existente
  const { data: cachedData } = await supabase
    .from('investment_quote_cache')
    .select('*')
    .eq('asset_id', assetId)
    .eq('user_id', user.id)
    .maybeSingle();

  const cachedQuote = cachedData as InvestmentQuoteCacheRow | null;
  const nowMs = Date.now();

  if (cachedQuote) {
    const ageMs = nowMs - new Date(cachedQuote.fetched_at).getTime();
    const isWithinStandardTtl = ageMs < QUOTE_CACHE_TTL_MS;
    const isWithinCooldown = ageMs < MIN_REFRESH_COOLDOWN_MS;

    if ((!forceRefresh && isWithinStandardTtl) || (forceRefresh && isWithinCooldown)) {
      return NextResponse.json({
        quote: {
          symbol: asset.symbol,
          price: String(cachedQuote.price),
          currency: 'USD',
          marketTime: cachedQuote.market_time,
          fetchedAt: cachedQuote.fetched_at,
          provider: cachedQuote.provider,
        },
        fromCache: true,
        stale: false,
        quotaExhausted: false,
      });
    }
  }

  const provider = resolveMarketDataProvider();
  const querySymbol = (asset.provider_symbol ?? asset.symbol).trim().toUpperCase();

  try {
    const freshQuote = await provider.getQuote(querySymbol);

    await supabase.from('investment_quote_cache').upsert(
      {
        user_id: user.id,
        asset_id: assetId,
        price: freshQuote.price,
        currency: 'USD',
        provider: freshQuote.provider,
        market_time: freshQuote.marketTime,
        fetched_at: freshQuote.fetchedAt,
      } as never,
      { onConflict: 'asset_id,user_id' }
    );

    return NextResponse.json({
      quote: {
        ...freshQuote,
        symbol: asset.symbol,
      },
      fromCache: false,
      stale: false,
      quotaExhausted: false,
    });
  } catch (err) {
    const isMarketErr = err instanceof MarketDataError;
    const errorCode = isMarketErr ? err.code : 'UPSTREAM_ERROR';
    const errorMsg = isMarketErr
      ? err.message
      : 'No se pudo obtener una cotización actualizada del proveedor.';
    const statusCode = isMarketErr ? err.statusCode : 502;

    // Degradación controlada: si existe caché previa en PostgreSQL, devolverla marcada como desactualizada
    if (cachedQuote) {
      return NextResponse.json(
        {
          quote: {
            symbol: asset.symbol,
            price: String(cachedQuote.price),
            currency: 'USD',
            marketTime: cachedQuote.market_time,
            fetchedAt: cachedQuote.fetched_at,
            provider: cachedQuote.provider,
          },
          fromCache: true,
          stale: true,
          quotaExhausted: errorCode === 'RATE_LIMIT_EXCEEDED',
          warningCode: errorCode,
          warningMessage: errorMsg,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: errorCode,
        message: errorMsg,
        quotaExhausted: errorCode === 'RATE_LIMIT_EXCEEDED',
      },
      { status: statusCode }
    );
  }
}
