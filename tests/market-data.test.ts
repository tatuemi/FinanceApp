import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeMarketSymbol,
  sanitizeCandle,
  TwelveDataProvider,
  FinnhubProvider,
  resolveMarketDataProvider,
} from '@/lib/market-data/providers';
import { MarketDataError } from '@/lib/market-data/types';

describe('Fase 7: Proveedores de Datos Bursátiles, Límites 429 y Sanitización OHLC', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normaliza símbolos bursátiles y rechaza entradas maliciosas o vacías', () => {
    expect(normalizeMarketSymbol(' aapl ')).toBe('AAPL');
    expect(normalizeMarketSymbol('brk.b')).toBe('BRK.B');
    expect(() => normalizeMarketSymbol('')).toThrow(MarketDataError);
    expect(() => normalizeMarketSymbol('AAPL; DROP TABLE')).toThrow(MarketDataError);
  });

  it('garantiza invariantes OHLC en sanitizeCandle() y rechaza precios no positivos', () => {
    const valid = sanitizeCandle({
      time: 1730073600,
      open: '180.50',
      high: '185.00',
      low: '179.20',
      close: '183.10',
      volume: '1500000',
    });
    expect(valid).not.toBeNull();
    expect(valid?.open).toBe(180.5);
    expect(valid?.high).toBe(185);
    expect(valid?.low).toBe(179.2);
    expect(valid?.close).toBe(183.1);

    // Si un proveedor envía high ligeramente menor que close por redondeo, se corrige al máximo real
    const corrected = sanitizeCandle({
      time: 1730073600,
      open: 100,
      high: 101,
      low: 99,
      close: 102,
    });
    expect(corrected?.high).toBe(102);

    // Precio cero o negativo debe rechazarse
    expect(
      sanitizeCandle({
        time: 1730073600,
        open: 0,
        high: 100,
        low: 90,
        close: 95,
      })
    ).toBeNull();
  });

  it('maneja falta de credenciales, código 429 (límite gratuito agotado) y respuestas válidas en TwelveDataProvider', async () => {
    const unconfigured = new TwelveDataProvider('');
    expect(unconfigured.isConfigured).toBe(false);
    await expect(unconfigured.getQuote('AAPL')).rejects.toMatchObject({
      code: 'PROVIDER_UNCONFIGURED',
      statusCode: 503,
    });

    // Simular error 429 JSON de Twelve Data (8 req/min agotados)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 429,
          message: 'You have run out of API credits for the current minute.',
          status: 'error',
        }),
        { status: 200 }
      )
    );

    const provider = new TwelveDataProvider('test-key-server-only');
    await expect(provider.getQuote('AAPL')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });

    // Simular cotización exitosa
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          symbol: 'AAPL',
          close: '228.45000',
          timestamp: 1730145600,
        }),
        { status: 200 }
      )
    );

    const quote = await provider.getQuote('aapl');
    expect(quote.symbol).toBe('AAPL');
    expect(quote.price).toBe('228.45000000');
    expect(quote.currency).toBe('USD');
    expect(quote.provider).toBe('twelvedata');
  });

  it('maneja errores HTTP 429 y 403 en FinnhubProvider y selecciona modo manual cuando se configura', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'API limit reached' }), { status: 429 })
    );

    const finnhub = new FinnhubProvider('finnhub-secret');
    await expect(finnhub.getQuote('QQQ')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "You don't have access to this resource." }), {
        status: 403,
      })
    );

    await expect(finnhub.getHistory('QQQ', '3M')).rejects.toMatchObject({
      code: 'PROVIDER_FORBIDDEN',
      statusCode: 403,
    });

    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    process.env.MARKET_DATA_PROVIDER = 'manual';
    const manualResolved = resolveMarketDataProvider();
    expect(manualResolved.name).toBe('manual');
    process.env.MARKET_DATA_PROVIDER = prevProvider;
  });
});
