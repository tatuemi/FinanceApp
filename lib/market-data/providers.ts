import Decimal from 'decimal.js';
import {
  MarketDataError,
  type HistoryRange,
  type MarketDataProvider,
  type MarketQuote,
  type PriceCandle,
} from './types';
import type { PriceCandleInterval } from '@/types/database';

const SYMBOL_REGEX = /^[A-Z0-9.:/-]{1,30}$/;

export function normalizeMarketSymbol(rawSymbol: string): string {
  const cleaned = rawSymbol.trim().toUpperCase();
  if (!SYMBOL_REGEX.test(cleaned)) {
    throw new MarketDataError(
      `El símbolo bursátil "${rawSymbol}" tiene un formato inválido.`,
      'INVALID_SYMBOL',
      400,
      'validation'
    );
  }
  return cleaned;
}

export function mapRangeToConfig(range: HistoryRange): {
  dbInterval: PriceCandleInterval;
  twelveDataInterval: string;
  finnhubResolution: string;
  lookbackDays: number;
  outputSize: number;
} {
  switch (range) {
    case '1M':
      return {
        dbInterval: '1day',
        twelveDataInterval: '1day',
        finnhubResolution: 'D',
        lookbackDays: 32,
        outputSize: 30,
      };
    case '3M':
      return {
        dbInterval: '1day',
        twelveDataInterval: '1day',
        finnhubResolution: 'D',
        lookbackDays: 95,
        outputSize: 70,
      };
    case '6M':
      return {
        dbInterval: '1day',
        twelveDataInterval: '1day',
        finnhubResolution: 'D',
        lookbackDays: 185,
        outputSize: 135,
      };
    case '1Y':
      return {
        dbInterval: '1day',
        twelveDataInterval: '1day',
        finnhubResolution: 'D',
        lookbackDays: 370,
        outputSize: 260,
      };
    case '5Y':
      return {
        dbInterval: '1week',
        twelveDataInterval: '1week',
        finnhubResolution: 'W',
        lookbackDays: 365 * 5,
        outputSize: 265,
      };
  }
}

/**
 * Normaliza y valida una vela OHLC asegurando las invariantes de PostgreSQL:
 * open > 0, high > 0, low > 0, close > 0, high >= max(open, close, low), low <= min(open, close, high).
 */
export function sanitizeCandle(raw: {
  time: number;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string | null;
}): PriceCandle | null {
  if (!Number.isFinite(raw.time) || raw.time <= 0) return null;

  const open = Number(raw.open);
  const close = Number(raw.close);
  let high = Number(raw.high);
  let low = Number(raw.low);

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0
  ) {
    return null;
  }

  high = Math.max(high, open, close, low);
  low = Math.min(low, open, close, high);

  const vol =
    raw.volume !== undefined && raw.volume !== null && Number.isFinite(Number(raw.volume)) && Number(raw.volume) >= 0
      ? Number(raw.volume)
      : undefined;

  return {
    time: Math.trunc(raw.time),
    open,
    high,
    low,
    close,
    ...(vol !== undefined ? { volume: vol } : {}),
  };
}

/**
 * Adaptador para Twelve Data (Basic Free Tier: 800 llamadas/día, 8 llamadas/minuto).
 * Ejecutado exclusivamente en el servidor.
 */
export class TwelveDataProvider implements MarketDataProvider {
  public readonly name = 'twelvedata';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey ?? process.env.TWELVE_DATA_API_KEY ?? '').trim();
  }

  public get isConfigured(): boolean {
    return this.apiKey.length > 0 && this.apiKey !== 'tu-api-key';
  }

  public async getQuote(rawSymbol: string): Promise<MarketQuote> {
    const symbol = normalizeMarketSymbol(rawSymbol);
    if (!this.isConfigured) {
      throw new MarketDataError(
        'TWELVE_DATA_API_KEY no está configurada en el servidor. Puedes usar cotizaciones manuales.',
        'PROVIDER_UNCONFIGURED',
        503,
        this.name
      );
    }

    const url = new URL('https://api.twelvedata.com/quote');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw new MarketDataError(
        'No se pudo conectar con Twelve Data API.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    if (response.status === 429) {
      throw new MarketDataError(
        'Límite gratuito de peticiones de Twelve Data alcanzado (429). Se mantiene la última cotización disponible.',
        'RATE_LIMIT_EXCEEDED',
        429,
        this.name
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;

    if (payload.status === 'error' || payload.code) {
      const codeNum = Number(payload.code ?? response.status);
      if (codeNum === 429) {
        throw new MarketDataError(
          'Cuota gratuita de Twelve Data alcanzada (8 req/min u 800 req/día). Intenta en unos minutos o usa cotización manual.',
          'RATE_LIMIT_EXCEEDED',
          429,
          this.name
        );
      }
      if (codeNum === 400 || codeNum === 404) {
        throw new MarketDataError(
          `El proveedor no encontró cotización para el símbolo "${symbol}".`,
          'INVALID_SYMBOL',
          404,
          this.name
        );
      }
      throw new MarketDataError(
        'El proveedor de datos bursátiles devolvió un error temporal.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    const rawPrice = String(payload.close ?? payload.price ?? '').trim();
    if (!rawPrice) {
      throw new MarketDataError(
        `Respuesta de cotización sin precio válido para "${symbol}".`,
        'INVALID_RESPONSE',
        502,
        this.name
      );
    }

    let priceDec: Decimal;
    try {
      priceDec = new Decimal(rawPrice);
    } catch {
      throw new MarketDataError(
        'Formato numérico de cotización inválido.',
        'INVALID_RESPONSE',
        502,
        this.name
      );
    }

    if (!priceDec.isFinite() || priceDec.lessThanOrEqualTo(0)) {
      throw new MarketDataError(
        'El precio devuelto por el proveedor no es positivo.',
        'INVALID_RESPONSE',
        502,
        this.name
      );
    }

    const timestampRaw = payload.timestamp ? Number(payload.timestamp) : null;
    const datetimeRaw = typeof payload.datetime === 'string' ? payload.datetime : null;
    let marketTimeIso: string | null = null;

    if (timestampRaw && Number.isFinite(timestampRaw) && timestampRaw > 0) {
      marketTimeIso = new Date(timestampRaw * 1000).toISOString();
    } else if (datetimeRaw) {
      const parsedDate = new Date(datetimeRaw);
      if (!Number.isNaN(parsedDate.getTime())) {
        marketTimeIso = parsedDate.toISOString();
      }
    }

    return {
      symbol,
      price: priceDec.toFixed(8),
      currency: 'USD',
      marketTime: marketTimeIso,
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  public async getHistory(rawSymbol: string, range: HistoryRange): Promise<PriceCandle[]> {
    const symbol = normalizeMarketSymbol(rawSymbol);
    if (!this.isConfigured) {
      throw new MarketDataError(
        'TWELVE_DATA_API_KEY no está configurada en el servidor.',
        'PROVIDER_UNCONFIGURED',
        503,
        this.name
      );
    }

    const cfg = mapRangeToConfig(range);
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', cfg.twelveDataInterval);
    url.searchParams.set('outputsize', String(cfg.outputSize));
    url.searchParams.set('apikey', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw new MarketDataError(
        'No se pudo conectar con Twelve Data para obtener el historial.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    if (response.status === 429) {
      throw new MarketDataError(
        'Límite gratuito de peticiones alcanzado en Twelve Data (429).',
        'RATE_LIMIT_EXCEEDED',
        429,
        this.name
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.status === 'error' || payload.code) {
      const codeNum = Number(payload.code ?? response.status);
      if (codeNum === 429) {
        throw new MarketDataError(
          'Cuota gratuita de Twelve Data alcanzada (429).',
          'RATE_LIMIT_EXCEEDED',
          429,
          this.name
        );
      }
      if (codeNum === 400 || codeNum === 404) {
        throw new MarketDataError(
          `No existe historial disponible para el símbolo "${symbol}".`,
          'INVALID_SYMBOL',
          404,
          this.name
        );
      }
      throw new MarketDataError(
        'Error al consultar el historial bursátil.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    const values = Array.isArray(payload.values) ? payload.values : [];
    const candles: PriceCandle[] = [];

    for (const item of values) {
      const rec = item as Record<string, unknown>;
      const dtStr = String(rec.datetime ?? '').trim();
      if (!dtStr) continue;
      const isoStr = dtStr.includes('T') ? dtStr : `${dtStr}T00:00:00Z`;
      const unixSec = Math.floor(new Date(isoStr).getTime() / 1000);

      const candle = sanitizeCandle({
        time: unixSec,
        open: String(rec.open ?? ''),
        high: String(rec.high ?? ''),
        low: String(rec.low ?? ''),
        close: String(rec.close ?? ''),
        volume: rec.volume !== undefined ? String(rec.volume) : undefined,
      });

      if (candle) {
        candles.push(candle);
      }
    }

    candles.sort((a, b) => a.time - b.time);
    return candles;
  }
}

/**
 * Adaptador para Finnhub (Free Plan: 60 llamadas/minuto para mercado de EE. UU.).
 * Ejecutado exclusivamente en el servidor.
 */
export class FinnhubProvider implements MarketDataProvider {
  public readonly name = 'finnhub';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey ?? process.env.FINNHUB_API_KEY ?? '').trim();
  }

  public get isConfigured(): boolean {
    return this.apiKey.length > 0 && this.apiKey !== 'tu-api-key';
  }

  public async getQuote(rawSymbol: string): Promise<MarketQuote> {
    const symbol = normalizeMarketSymbol(rawSymbol);
    if (!this.isConfigured) {
      throw new MarketDataError(
        'FINNHUB_API_KEY no está configurada en el servidor.',
        'PROVIDER_UNCONFIGURED',
        503,
        this.name
      );
    }

    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('token', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw new MarketDataError(
        'No se pudo conectar con Finnhub API.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    if (response.status === 429) {
      throw new MarketDataError(
        'Límite gratuito de Finnhub alcanzado (429).',
        'RATE_LIMIT_EXCEEDED',
        429,
        this.name
      );
    }

    if (response.status === 403) {
      throw new MarketDataError(
        'El plan gratuito de Finnhub no cubre este mercado o recurso (403).',
        'PROVIDER_FORBIDDEN',
        403,
        this.name
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const currentPrice = Number(payload.c ?? 0);

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new MarketDataError(
        `Finnhub no devolvió una cotización válida para "${symbol}".`,
        'INVALID_SYMBOL',
        404,
        this.name
      );
    }

    const unixTime = Number(payload.t ?? 0);
    const marketTime =
      Number.isFinite(unixTime) && unixTime > 0
        ? new Date(unixTime * 1000).toISOString()
        : null;

    return {
      symbol,
      price: new Decimal(currentPrice).toFixed(8),
      currency: 'USD',
      marketTime,
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  public async getHistory(rawSymbol: string, range: HistoryRange): Promise<PriceCandle[]> {
    const symbol = normalizeMarketSymbol(rawSymbol);
    if (!this.isConfigured) {
      throw new MarketDataError(
        'FINNHUB_API_KEY no está configurada en el servidor.',
        'PROVIDER_UNCONFIGURED',
        503,
        this.name
      );
    }

    const cfg = mapRangeToConfig(range);
    const toSec = Math.floor(Date.now() / 1000);
    const fromSec = toSec - cfg.lookbackDays * 86400;

    const url = new URL('https://finnhub.io/api/v1/stock/candle');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('resolution', cfg.finnhubResolution);
    url.searchParams.set('from', String(fromSec));
    url.searchParams.set('to', String(toSec));
    url.searchParams.set('token', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw new MarketDataError(
        'No se pudo conectar con Finnhub para obtener velas históricas.',
        'UPSTREAM_ERROR',
        502,
        this.name
      );
    }

    if (response.status === 429) {
      throw new MarketDataError(
        'Límite gratuito de Finnhub alcanzado (429).',
        'RATE_LIMIT_EXCEEDED',
        429,
        this.name
      );
    }

    if (response.status === 403) {
      throw new MarketDataError(
        'El endpoint de velas históricas está restringido en tu cuenta de Finnhub (403). Puedes usar Twelve Data en MARKET_DATA_PROVIDER=twelvedata.',
        'PROVIDER_FORBIDDEN',
        403,
        this.name
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.s === 'no_data') {
      return [];
    }

    const tArr = Array.isArray(payload.t) ? (payload.t as number[]) : [];
    const oArr = Array.isArray(payload.o) ? (payload.o as number[]) : [];
    const hArr = Array.isArray(payload.h) ? (payload.h as number[]) : [];
    const lArr = Array.isArray(payload.l) ? (payload.l as number[]) : [];
    const cArr = Array.isArray(payload.c) ? (payload.c as number[]) : [];
    const vArr = Array.isArray(payload.v) ? (payload.v as number[]) : [];

    const candles: PriceCandle[] = [];
    for (let i = 0; i < tArr.length; i++) {
      const candle = sanitizeCandle({
        time: tArr[i] ?? 0,
        open: oArr[i] ?? 0,
        high: hArr[i] ?? 0,
        low: lArr[i] ?? 0,
        close: cArr[i] ?? 0,
        volume: vArr[i],
      });
      if (candle) {
        candles.push(candle);
      }
    }

    candles.sort((a, b) => a.time - b.time);
    return candles;
  }
}

export class ManualMarketDataProvider implements MarketDataProvider {
  public readonly name = 'manual';
  public readonly isConfigured = false;

  public async getQuote(): Promise<MarketQuote> {
    throw new MarketDataError(
      'Modo de cotizaciones manuales activo. Registra o actualiza el precio de referencia manualmente.',
      'PROVIDER_UNCONFIGURED',
      503,
      this.name
    );
  }

  public async getHistory(): Promise<PriceCandle[]> {
    throw new MarketDataError(
      'Modo de cotizaciones manuales activo (sin proveedor automático de historial configurado).',
      'PROVIDER_UNCONFIGURED',
      503,
      this.name
    );
  }
}

/**
 * Resuelve el proveedor de datos bursátiles configurado en el servidor.
 * Si se seleccionó `twelvedata` pero solo existe `FINNHUB_API_KEY` (o viceversa),
 * selecciona automáticamente el proveedor gratuito que tenga credencial disponible.
 */
export function resolveMarketDataProvider(): MarketDataProvider {
  const preferred = (process.env.MARKET_DATA_PROVIDER ?? 'twelvedata').trim().toLowerCase();

  if (preferred === 'manual') {
    return new ManualMarketDataProvider();
  }

  const twelve = new TwelveDataProvider();
  const finnhub = new FinnhubProvider();

  if (preferred === 'finnhub') {
    if (finnhub.isConfigured) return finnhub;
    if (twelve.isConfigured) return twelve;
    return finnhub;
  }

  if (twelve.isConfigured) return twelve;
  if (finnhub.isConfigured) return finnhub;
  return twelve;
}
