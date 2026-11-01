import { describe, it, expect } from 'vitest';
import {
  investmentAssetSchema,
  investmentTransactionSchema,
} from '@/lib/validations/investments';
import {
  processAssetTransactionsChronologically,
  calculatePortfolioOverview,
} from '@/lib/investments/calculations';
import type {
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionRow,
} from '@/types/database';

describe('Fase 6: Portafolio de Inversiones, Fracciones, Costo Promedio Móvil y Validaciones', () => {
  it('normaliza símbolos a mayúsculas y valida activos (acciones y ETF)', () => {
    const valid = investmentAssetSchema.safeParse({
      symbol: '  aapl ',
      name: 'Apple Inc.',
      assetType: 'stock',
      exchange: 'nasdaq',
      providerSymbol: 'aapl',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.symbol).toBe('AAPL');
      expect(valid.data.exchange).toBe('NASDAQ');
      expect(valid.data.providerSymbol).toBe('AAPL');
    }

    const invalidSymbol = investmentAssetSchema.safeParse({
      symbol: '   ',
      name: 'Activo inválido',
      assetType: 'etf',
    });
    expect(invalidSymbol.success).toBe(false);
  });

  it('admite títulos fraccionados y registro por importe en USD (Cantidad = Importe / Precio)', () => {
    // 1. Entrada directa con fracción de título (0.25 acciones a $200 = $50 bruto)
    const byQty = investmentTransactionSchema.safeParse({
      assetId: '10',
      transactionType: 'buy',
      tradeDate: '2026-10-10',
      inputMode: 'quantity',
      quantity: '0.25',
      pricePerShare: '200.00',
      fees: '0.50',
    });
    expect(byQty.success).toBe(true);
    if (byQty.success) {
      expect(byQty.data.quantity).toBe('0.2500000000');
      expect(byQty.data.grossAmount).toBe('50.0000');
      expect(byQty.data.fees).toBe('0.5000');
    }

    // 2. Entrada por importe ($100 USD a $160/acción = 0.625 acciones exactas)
    const byAmount = investmentTransactionSchema.safeParse({
      assetId: '10',
      transactionType: 'buy',
      tradeDate: '2026-10-12',
      inputMode: 'amount',
      totalAmount: '100.00',
      pricePerShare: '160.00',
      fees: '0',
    });
    expect(byAmount.success).toBe(true);
    if (byAmount.success) {
      expect(byAmount.data.quantity).toBe('0.6250000000');
      expect(byAmount.data.grossAmount).toBe('100.0000');
    }

    // 3. Entrada por importe con división periódica ($100 USD a $300/acción = 0.3333333333 títulos)
    const byRepeatingAmount = investmentTransactionSchema.safeParse({
      assetId: '10',
      transactionType: 'buy',
      tradeDate: '2026-10-13',
      inputMode: 'amount',
      totalAmount: '100.00',
      pricePerShare: '300.00',
      fees: '1.00',
    });
    expect(byRepeatingAmount.success).toBe(true);
    if (byRepeatingAmount.success) {
      expect(byRepeatingAmount.data.quantity).toBe('0.3333333333');
    }
  });

  it('calcula el costo promedio ponderado móvil, comisiones y ganancias realizadas con precisión exacta', () => {
    const ledger = processAssetTransactionsChronologically([
      // Compra 1: 1.0 acción a $100 + $2 comisión -> Costo base = $102.00, Cantidad = 1.0, Promedio = $102.00
      {
        id: '1',
        trade_date: '2026-10-01',
        transaction_type: 'buy',
        quantity: '1.0000000000',
        price_per_share: '100.00000000',
        fees: '2.0000',
      },
      // Compra 2: 1.0 acción a $150 + $2 comisión -> Costo compra = $152.00
      // Cantidad acumulada = 2.0, Costo base = $254.00, Costo promedio = $127.00
      {
        id: '2',
        trade_date: '2026-10-05',
        transaction_type: 'buy',
        quantity: '1.0000000000',
        price_per_share: '150.00000000',
        fees: '2.0000',
      },
      // Venta 1: 0.5 acciones a $160 - $1 comisión -> Ingreso neto = $80 - $1 = $79.00
      // Costo base vendido = 0.5 * $127.00 = $63.50
      // Ganancia realizada = $79.00 - $63.50 = +$15.50
      // Cantidad restante = 1.5, Costo base restante = $254.00 - $63.50 = $190.50 (Promedio sigue en $127.00)
      {
        id: '3',
        trade_date: '2026-10-10',
        transaction_type: 'sell',
        quantity: '0.5000000000',
        price_per_share: '160.00000000',
        fees: '1.0000',
      },
    ]);

    expect(ledger.valid).toBe(true);
    expect(ledger.finalQuantity).toBe('1.5000000000');
    expect(ledger.finalCostBasis).toBe('190.5000');
    expect(ledger.averageCostPerShare).toBe('127.00000000');
    expect(ledger.totalRealizedGainLoss).toBe('15.5000');
    expect(ledger.totalFeesPaid).toBe('5.0000');
  });

  it('liquida a cero el costo base al vender el 100% de títulos fraccionados y rechaza ventas en descubierto o retroactivas', () => {
    // Liquidación total sin residuos de redondeo
    const fullSaleLedger = processAssetTransactionsChronologically([
      {
        id: '1',
        trade_date: '2026-10-01',
        transaction_type: 'buy',
        quantity: '0.3333333333',
        price_per_share: '300.00000000',
        fees: '0.0000',
      },
      {
        id: '2',
        trade_date: '2026-10-05',
        transaction_type: 'sell',
        quantity: '0.3333333333',
        price_per_share: '330.00000000',
        fees: '0.0000',
      },
    ]);
    expect(fullSaleLedger.valid).toBe(true);
    expect(fullSaleLedger.finalQuantity).toBe('0.0000000000');
    expect(fullSaleLedger.finalCostBasis).toBe('0.0000');
    expect(fullSaleLedger.averageCostPerShare).toBe('0.00000000');

    // Intento de venta con cantidad mayor a la disponible
    const insufficientLedger = processAssetTransactionsChronologically([
      {
        id: '1',
        trade_date: '2026-10-01',
        transaction_type: 'buy',
        quantity: '0.5000000000',
        price_per_share: '100.00000000',
        fees: '0',
      },
      {
        id: '2',
        trade_date: '2026-10-02',
        transaction_type: 'sell',
        quantity: '0.7500000000',
        price_per_share: '110.00000000',
        fees: '0',
      },
    ]);
    expect(insufficientLedger.valid).toBe(false);
    expect(insufficientLedger.violatingTransactionId).toBe('2');

    // Intento de venta en fecha anterior a la compra (aunque el saldo final parezca positivo)
    const retroactiveInvalidLedger = processAssetTransactionsChronologically([
      {
        id: '10',
        trade_date: '2026-10-10',
        transaction_type: 'buy',
        quantity: '2.0000000000',
        price_per_share: '100.00000000',
        fees: '0',
      },
      {
        id: '11',
        trade_date: '2026-10-02', // Fecha anterior a la compra del 10 de octubre
        transaction_type: 'sell',
        quantity: '1.0000000000',
        price_per_share: '110.00000000',
        fees: '0',
      },
    ]);
    expect(retroactiveInvalidLedger.valid).toBe(false);
    expect(retroactiveInvalidLedger.violatingDate).toBe('2026-10-02');
  });

  it('calcula valoración de mercado, pesos porcentuales y maneja activos sin cotización sin asumir precio cero', () => {
    const assets: InvestmentAssetRow[] = [
      {
        id: '1',
        user_id: 'u1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        asset_type: 'stock',
        exchange: 'NASDAQ',
        provider_symbol: 'AAPL',
        currency: 'USD',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: '2',
        user_id: 'u1',
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        asset_type: 'etf',
        exchange: 'NASDAQ',
        provider_symbol: 'QQQ',
        currency: 'USD',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: '3',
        user_id: 'u1',
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        asset_type: 'stock',
        exchange: 'NASDAQ',
        provider_symbol: 'MSFT',
        currency: 'USD',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ];

    const transactions: InvestmentTransactionRow[] = [
      // AAPL: 2 acciones a $150 = $300 costo base
      {
        id: '101',
        user_id: 'u1',
        asset_id: '1',
        transaction_type: 'buy',
        trade_date: '2026-10-01',
        quantity: '2.0000000000',
        price_per_share: '150.00000000',
        fees: '0.0000',
        currency: 'USD',
        notes: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      // QQQ: 1 ETF a $400 = $400 costo base
      {
        id: '102',
        user_id: 'u1',
        asset_id: '2',
        transaction_type: 'buy',
        trade_date: '2026-10-02',
        quantity: '1.0000000000',
        price_per_share: '400.00000000',
        fees: '0.0000',
        currency: 'USD',
        notes: null,
        created_at: '2026-10-02T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
      },
      // MSFT: 1 acción a $420 = $420 costo base (SIN COTIZACIÓN DISPONIBLE)
      {
        id: '103',
        user_id: 'u1',
        asset_id: '3',
        transaction_type: 'buy',
        trade_date: '2026-10-03',
        quantity: '1.0000000000',
        price_per_share: '420.00000000',
        fees: '0.0000',
        currency: 'USD',
        notes: null,
        created_at: '2026-10-03T00:00:00Z',
        updated_at: '2026-10-03T00:00:00Z',
      },
    ];

    const quotes: InvestmentQuoteCacheRow[] = [
      // AAPL cotiza a $200 -> Valor mercado = $400 (+$100 no realizado)
      {
        id: '1',
        user_id: 'u1',
        asset_id: '1',
        price: '200.00000000',
        currency: 'USD',
        provider: 'twelvedata',
        market_time: '2026-10-28T20:00:00Z',
        fetched_at: '2026-10-28T20:05:00Z',
      },
      // QQQ cotiza a $600 (manual) -> Valor mercado = $600 (+$200 no realizado)
      {
        id: '2',
        user_id: 'u1',
        asset_id: '2',
        price: '600.00000000',
        currency: 'USD',
        provider: 'manual',
        market_time: '2026-10-20T20:00:00Z',
        fetched_at: '2026-10-20T20:00:00Z', // hace 8 días -> stale = true
      },
    ];

    const overview = calculatePortfolioOverview(
      assets,
      transactions,
      quotes,
      new Date('2026-10-28T21:00:00Z')
    );

    // Valor de mercado total valorado = $400 (AAPL) + $600 (QQQ) = $1000.0000
    expect(overview.totalMarketValue).toBe('1000.0000');
    // Costo base total de las 3 posiciones = $300 + $400 + $420 = $1120.0000
    expect(overview.totalCostBasis).toBe('1120.0000');
    // Costo base de las posiciones valoradas = $300 + $400 = $700.0000
    expect(overview.valuedCostBasis).toBe('700.0000');
    // Ganancia no realizada de posiciones valoradas = $1000 - $700 = +$300.0000 (+42.86%)
    expect(overview.totalUnrealizedGainLoss).toBe('300.0000');
    expect(overview.totalUnrealizedReturnPct).toBe('42.86');

    // Alerta de valoración incompleta por MSFT sin cotización
    expect(overview.isValuationIncomplete).toBe(true);
    expect(overview.unquotedPositionsCount).toBe(1);
    expect(overview.unquotedSymbols).toEqual(['MSFT']);

    const qqqPos = overview.positions.find((p) => p.symbol === 'QQQ')!;
    const aaplPos = overview.positions.find((p) => p.symbol === 'AAPL')!;
    const msftPos = overview.positions.find((p) => p.symbol === 'MSFT')!;

    // Pesos porcentuales sobre el total valorado ($1000): QQQ = 60%, AAPL = 40%
    expect(qqqPos.portfolioWeightPct).toBe('60.00');
    expect(qqqPos.isManualQuote).toBe(true);
    expect(qqqPos.isQuoteStale).toBe(true);

    expect(aaplPos.portfolioWeightPct).toBe('40.00');
    expect(aaplPos.isManualQuote).toBe(false);
    expect(aaplPos.isQuoteStale).toBe(false);

    // MSFT sin cotización: NO debe tener marketValue = 0 ni pérdida del -100%
    expect(msftPos.hasValidQuote).toBe(false);
    expect(msftPos.marketValue).toBeNull();
    expect(msftPos.unrealizedGainLoss).toBeNull();
    expect(msftPos.portfolioWeightPct).toBeNull();
  });
});
