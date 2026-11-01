import Decimal from 'decimal.js';
import type {
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionRow,
  InvestmentAssetType,
} from '@/types/database';

export interface ProcessedInvestmentStep {
  transactionId: string;
  tradeDate: string;
  transactionType: 'buy' | 'sell';
  quantity: string; // NUMERIC(28,10)
  pricePerShare: string; // NUMERIC(20,8)
  fees: string; // NUMERIC(19,4)
  grossAmount: string; // quantity * pricePerShare
  netCashFlow: string; // buy: gross + fees; sell: gross - fees
  averageCostBeforeStep: string;
  costBasisDelta: string;
  realizedGainLoss: string | null; // solo en ventas
  runningQuantityAfter: string;
  runningCostBasisAfter: string;
  averageCostAfter: string;
}

export interface LedgerValidationResult {
  valid: boolean;
  errorMessage: string | null;
  violatingTransactionId: string | null;
  violatingDate: string | null;
  steps: ProcessedInvestmentStep[];
  finalQuantity: string;
  finalCostBasis: string;
  averageCostPerShare: string;
  totalRealizedGainLoss: string;
  totalFeesPaid: string;
}

export interface AssetPositionValuation {
  assetId: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  exchange: string | null;
  providerSymbol: string | null;
  currency: 'USD';
  quantity: string; // NUMERIC(28,10)
  costBasis: string; // NUMERIC(19,4)
  averageCostPerShare: string; // NUMERIC(20,8)
  realizedGainLoss: string; // NUMERIC(19,4)
  hasValidQuote: boolean;
  quotePrice: string | null; // NUMERIC(20,8)
  quoteProvider: string | null;
  isManualQuote: boolean;
  quoteMarketTime: string | null;
  quoteFetchedAt: string | null;
  isQuoteStale: boolean;
  marketValue: string | null; // NUMERIC(19,4) o null si no hay cotización
  unrealizedGainLoss: string | null; // NUMERIC(19,4) o null
  unrealizedReturnPct: string | null; // % o null cuando costBasis == 0 o sin cotización
  portfolioWeightPct: string | null; // % sobre el valor de mercado total valorado
  transactionCount: number;
}

export interface AssetTypeDistributionItem {
  assetType: InvestmentAssetType;
  label: string;
  marketValue: string;
  percentage: string;
  assetCount: number;
}

export interface PortfolioOverviewMetrics {
  totalMarketValue: string; // Suma de posiciones abiertas con cotización válida
  totalCostBasis: string; // Costo base total de todas las posiciones abiertas
  valuedCostBasis: string; // Costo base de las posiciones que cuentan con cotización válida
  totalUnrealizedGainLoss: string | null; // Valorado: totalMarketValue - valuedCostBasis
  totalUnrealizedReturnPct: string | null; // null cuando valuedCostBasis == 0 o no hay posiciones valoradas
  totalRealizedGainLoss: string; // Suma de ganancias/pérdidas realizadas en todas las ventas históricas
  activePositionsCount: number;
  totalAssetsRegistered: number;
  valuedPositionsCount: number;
  unquotedPositionsCount: number;
  isValuationIncomplete: boolean;
  unquotedSymbols: string[];
  lastQuoteUpdateAt: string | null;
  positions: AssetPositionValuation[]; // Posiciones abiertas (quantity > 0)
  closedPositions: AssetPositionValuation[]; // Activos con quantity == 0
  assetTypeDistribution: AssetTypeDistributionItem[];
}

const QUOTE_STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 24 horas

/**
 * Ordena las operaciones de un activo cronológicamente por `(trade_date ASC, id ASC)`.
 */
export function sortTransactionsChronologically<
  T extends Pick<InvestmentTransactionRow, 'id' | 'trade_date'>
>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    if (a.trade_date !== b.trade_date) {
      return a.trade_date < b.trade_date ? -1 : 1;
    }
    try {
      const idA = BigInt(a.id);
      const idB = BigInt(b.id);
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    } catch {
      return String(a.id).localeCompare(String(b.id));
    }
  });
}

/**
 * Procesa cronológicamente el libro mayor de un activo mediante el método de
 * COSTO PROMEDIO PONDERADO MÓVIL (Sección 5.3.D).
 *
 * Reglas:
 * - Compra (`buy`):
 *   - Aumenta `runningQuantity` en `quantity`.
 *   - Aumenta `runningCostBasis` en `(quantity * price_per_share) + fees`.
 * - Venta (`sell`):
 *   - Verifica que `runningQuantity >= quantity`. Si no, devuelve `valid: false` sin permitir negativos.
 *   - `avgCostBefore = runningCostBasis / runningQuantity`.
 *   - `costBasisSold = avgCostBefore * quantity` (o `runningCostBasis` exacto si liquida el 100%).
 *   - `netProceeds = (quantity * price_per_share) - fees`.
 *   - `realizedGainLoss = netProceeds - costBasisSold`.
 *   - Reduce `runningQuantity` y `runningCostBasis`.
 */
export function processAssetTransactionsChronologically(
  transactions: Pick<
    InvestmentTransactionRow,
    'id' | 'trade_date' | 'transaction_type' | 'quantity' | 'price_per_share' | 'fees'
  >[]
): LedgerValidationResult {
  const sorted = sortTransactionsChronologically(transactions);

  let runningQty = new Decimal(0);
  let runningCostBasis = new Decimal(0);
  let totalRealized = new Decimal(0);
  let totalFees = new Decimal(0);
  const steps: ProcessedInvestmentStep[] = [];

  for (const tx of sorted) {
    const qty = new Decimal(tx.quantity);
    const price = new Decimal(tx.price_per_share);
    const fees = new Decimal(tx.fees ?? '0');
    const gross = qty.mul(price);

    const avgBefore = runningQty.greaterThan(0)
      ? runningCostBasis.div(runningQty)
      : new Decimal(0);

    if (tx.transaction_type === 'buy') {
      const totalBuyCost = gross.plus(fees);
      runningQty = runningQty.plus(qty);
      runningCostBasis = runningCostBasis.plus(totalBuyCost);
      totalFees = totalFees.plus(fees);

      const avgAfter = runningQty.greaterThan(0)
        ? runningCostBasis.div(runningQty)
        : new Decimal(0);

      steps.push({
        transactionId: String(tx.id),
        tradeDate: tx.trade_date,
        transactionType: 'buy',
        quantity: qty.toFixed(10),
        pricePerShare: price.toFixed(8),
        fees: fees.toFixed(4),
        grossAmount: gross.toFixed(4),
        netCashFlow: totalBuyCost.toFixed(4),
        averageCostBeforeStep: avgBefore.toFixed(8),
        costBasisDelta: totalBuyCost.toFixed(4),
        realizedGainLoss: null,
        runningQuantityAfter: runningQty.toFixed(10),
        runningCostBasisAfter: runningCostBasis.toFixed(4),
        averageCostAfter: avgAfter.toFixed(8),
      });
    } else {
      // Operación de venta ('sell'): verificar disponibilidad con tolerancia cero a negativos
      if (qty.greaterThan(runningQty)) {
        return {
          valid: false,
          errorMessage: `Títulos insuficientes en la fecha ${tx.trade_date}: intentaste vender ${qty
            .toDP(8)
            .toFixed()} títulos, pero solo había ${runningQty
            .toDP(8)
            .toFixed()} disponibles en ese momento cronológico.`,
          violatingTransactionId: String(tx.id),
          violatingDate: tx.trade_date,
          steps,
          finalQuantity: runningQty.toFixed(10),
          finalCostBasis: runningCostBasis.toFixed(4),
          averageCostPerShare: avgBefore.toFixed(8),
          totalRealizedGainLoss: totalRealized.toFixed(4),
          totalFeesPaid: totalFees.toFixed(4),
        };
      }

      const isFullLiquidation = qty.equals(runningQty);
      const costBasisSold = isFullLiquidation
        ? runningCostBasis
        : avgBefore.mul(qty);

      const netProceeds = gross.minus(fees);
      const realizedOnSale = netProceeds.minus(costBasisSold);

      runningQty = runningQty.minus(qty);
      runningCostBasis = isFullLiquidation
        ? new Decimal(0)
        : Decimal.max(0, runningCostBasis.minus(costBasisSold));

      totalRealized = totalRealized.plus(realizedOnSale);
      totalFees = totalFees.plus(fees);

      const avgAfter = runningQty.greaterThan(0)
        ? runningCostBasis.div(runningQty)
        : new Decimal(0);

      steps.push({
        transactionId: String(tx.id),
        tradeDate: tx.trade_date,
        transactionType: 'sell',
        quantity: qty.toFixed(10),
        pricePerShare: price.toFixed(8),
        fees: fees.toFixed(4),
        grossAmount: gross.toFixed(4),
        netCashFlow: netProceeds.toFixed(4),
        averageCostBeforeStep: avgBefore.toFixed(8),
        costBasisDelta: costBasisSold.negated().toFixed(4),
        realizedGainLoss: realizedOnSale.toFixed(4),
        runningQuantityAfter: runningQty.toFixed(10),
        runningCostBasisAfter: runningCostBasis.toFixed(4),
        averageCostAfter: avgAfter.toFixed(8),
      });
    }
  }

  const finalAvgCost = runningQty.greaterThan(0)
    ? runningCostBasis.div(runningQty)
    : new Decimal(0);

  return {
    valid: true,
    errorMessage: null,
    violatingTransactionId: null,
    violatingDate: null,
    steps,
    finalQuantity: runningQty.toFixed(10),
    finalCostBasis: runningCostBasis.toFixed(4),
    averageCostPerShare: finalAvgCost.toFixed(8),
    totalRealizedGainLoss: totalRealized.toFixed(4),
    totalFeesPaid: totalFees.toFixed(4),
  };
}

/**
 * Calcula las posiciones, valoración de mercado, distribución porcentual por activo
 * y distribución entre acciones y ETF (Sección 5.3.D y 5.3.E).
 */
export function calculatePortfolioOverview(
  assets: InvestmentAssetRow[],
  transactions: InvestmentTransactionRow[],
  quotes: InvestmentQuoteCacheRow[],
  nowReference: Date = new Date()
): PortfolioOverviewMetrics {
  const txsByAsset = new Map<string, InvestmentTransactionRow[]>();
  for (const tx of transactions) {
    const assetId = String(tx.asset_id);
    const list = txsByAsset.get(assetId);
    if (list) {
      list.push(tx);
    } else {
      txsByAsset.set(assetId, [tx]);
    }
  }

  const quoteByAsset = new Map<string, InvestmentQuoteCacheRow>();
  for (const q of quotes) {
    quoteByAsset.set(String(q.asset_id), q);
  }

  let totalMarketValue = new Decimal(0);
  let totalCostBasis = new Decimal(0);
  let valuedCostBasis = new Decimal(0);
  let totalRealizedGainLoss = new Decimal(0);
  let latestQuoteTimestamp: string | null = null;

  const openPositions: AssetPositionValuation[] = [];
  const closedPositions: AssetPositionValuation[] = [];
  const unquotedSymbols: string[] = [];

  for (const asset of assets) {
    const assetId = String(asset.id);
    const assetTxs = txsByAsset.get(assetId) ?? [];
    const ledger = processAssetTransactionsChronologically(assetTxs);

    const qty = new Decimal(ledger.finalQuantity);
    const costBasis = new Decimal(ledger.finalCostBasis);
    const avgCost = new Decimal(ledger.averageCostPerShare);
    const realized = new Decimal(ledger.totalRealizedGainLoss);

    totalRealizedGainLoss = totalRealizedGainLoss.plus(realized);

    const quote = quoteByAsset.get(assetId) ?? null;
    const quotePriceDec =
      quote && new Decimal(quote.price).greaterThan(0) ? new Decimal(quote.price) : null;
    const hasValidQuote = Boolean(quotePriceDec);

    if (quote?.fetched_at) {
      if (!latestQuoteTimestamp || quote.fetched_at > latestQuoteTimestamp) {
        latestQuoteTimestamp = quote.fetched_at;
      }
    }

    const isQuoteStale = quote?.fetched_at
      ? nowReference.getTime() - new Date(quote.fetched_at).getTime() > QUOTE_STALE_THRESHOLD_MS
      : false;

    const isActive = qty.greaterThan(0);

    let marketValueStr: string | null = null;
    let unrealizedGainLossStr: string | null = null;
    let unrealizedReturnPctStr: string | null = null;

    if (isActive) {
      totalCostBasis = totalCostBasis.plus(costBasis);

      if (quotePriceDec) {
        const marketValueDec = qty.mul(quotePriceDec);
        const unrealizedDec = marketValueDec.minus(costBasis);

        totalMarketValue = totalMarketValue.plus(marketValueDec);
        valuedCostBasis = valuedCostBasis.plus(costBasis);

        marketValueStr = marketValueDec.toFixed(4);
        unrealizedGainLossStr = unrealizedDec.toFixed(4);

        // REGLA (Sección 5.3.D): El porcentaje no debe mostrarse como un valor válido cuando el costo base sea cero
        if (costBasis.greaterThan(0)) {
          unrealizedReturnPctStr = unrealizedDec.div(costBasis).mul(100).toFixed(2);
        } else {
          unrealizedReturnPctStr = null;
        }
      } else {
        unquotedSymbols.push(asset.symbol);
      }
    } else if (quotePriceDec) {
      marketValueStr = '0.0000';
      unrealizedGainLossStr = '0.0000';
      unrealizedReturnPctStr = null;
    }

    const position: AssetPositionValuation = {
      assetId,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.asset_type,
      exchange: asset.exchange,
      providerSymbol: asset.provider_symbol,
      currency: 'USD',
      quantity: qty.toFixed(10),
      costBasis: costBasis.toFixed(4),
      averageCostPerShare: avgCost.toFixed(8),
      realizedGainLoss: realized.toFixed(4),
      hasValidQuote,
      quotePrice: quotePriceDec ? quotePriceDec.toFixed(8) : null,
      quoteProvider: quote?.provider ?? null,
      isManualQuote: quote?.provider === 'manual',
      quoteMarketTime: quote?.market_time ?? null,
      quoteFetchedAt: quote?.fetched_at ?? null,
      isQuoteStale,
      marketValue: marketValueStr,
      unrealizedGainLoss: unrealizedGainLossStr,
      unrealizedReturnPct: unrealizedReturnPctStr,
      portfolioWeightPct: null, // Se calcula en el segundo paso sobre totalMarketValue
      transactionCount: assetTxs.length,
    };

    if (isActive) {
      openPositions.push(position);
    } else {
      closedPositions.push(position);
    }
  }

  // Segundo paso: calcular Peso del activo (%) = Valor de mercado del activo / Valor de mercado total valorado × 100
  let stockMarketValue = new Decimal(0);
  let etfMarketValue = new Decimal(0);
  let stockCount = 0;
  let etfCount = 0;

  for (const pos of openPositions) {
    if (pos.marketValue !== null && totalMarketValue.greaterThan(0)) {
      const mv = new Decimal(pos.marketValue);
      pos.portfolioWeightPct = mv.div(totalMarketValue).mul(100).toFixed(2);

      if (pos.assetType === 'stock') {
        stockMarketValue = stockMarketValue.plus(mv);
        stockCount += 1;
      } else {
        etfMarketValue = etfMarketValue.plus(mv);
        etfCount += 1;
      }
    } else if (pos.marketValue !== null) {
      pos.portfolioWeightPct = '0.00';
    }
  }

  // Ordenar posiciones abiertas: primero las valoradas de mayor a menor valor de mercado, luego las sin cotización por costo base
  openPositions.sort((a, b) => {
    if (a.marketValue !== null && b.marketValue !== null) {
      return new Decimal(b.marketValue).cmp(new Decimal(a.marketValue));
    }
    if (a.marketValue !== null) return -1;
    if (b.marketValue !== null) return 1;
    return new Decimal(b.costBasis).cmp(new Decimal(a.costBasis));
  });

  const valuedPositionsCount = openPositions.filter((p) => p.hasValidQuote).length;
  const unquotedPositionsCount = openPositions.length - valuedPositionsCount;

  const totalUnrealizedDec =
    valuedPositionsCount > 0 ? totalMarketValue.minus(valuedCostBasis) : null;

  const totalUnrealizedReturnPct =
    totalUnrealizedDec !== null && valuedCostBasis.greaterThan(0)
      ? totalUnrealizedDec.div(valuedCostBasis).mul(100).toFixed(2)
      : null;

  const assetTypeDistribution: AssetTypeDistributionItem[] = [];
  if (totalMarketValue.greaterThan(0)) {
    if (stockCount > 0) {
      assetTypeDistribution.push({
        assetType: 'stock',
        label: 'Acciones (Stocks)',
        marketValue: stockMarketValue.toFixed(4),
        percentage: stockMarketValue.div(totalMarketValue).mul(100).toFixed(2),
        assetCount: stockCount,
      });
    }
    if (etfCount > 0) {
      assetTypeDistribution.push({
        assetType: 'etf',
        label: 'Fondos Cotizados (ETF)',
        marketValue: etfMarketValue.toFixed(4),
        percentage: etfMarketValue.div(totalMarketValue).mul(100).toFixed(2),
        assetCount: etfCount,
      });
    }
  }

  return {
    totalMarketValue: totalMarketValue.toFixed(4),
    totalCostBasis: totalCostBasis.toFixed(4),
    valuedCostBasis: valuedCostBasis.toFixed(4),
    totalUnrealizedGainLoss: totalUnrealizedDec ? totalUnrealizedDec.toFixed(4) : null,
    totalUnrealizedReturnPct,
    totalRealizedGainLoss: totalRealizedGainLoss.toFixed(4),
    activePositionsCount: openPositions.length,
    totalAssetsRegistered: assets.length,
    valuedPositionsCount,
    unquotedPositionsCount,
    isValuationIncomplete: unquotedPositionsCount > 0,
    unquotedSymbols,
    lastQuoteUpdateAt: latestQuoteTimestamp,
    positions: openPositions,
    closedPositions,
    assetTypeDistribution,
  };
}
