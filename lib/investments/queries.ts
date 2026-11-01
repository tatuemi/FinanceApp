import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser, ensureUserProfileForUser } from '@/lib/auth/session';
import type {
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionRow,
  InvestmentTransactionWithAsset,
} from '@/types/database';
import {
  calculatePortfolioOverview,
  processAssetTransactionsChronologically,
  type PortfolioOverviewMetrics,
  type ProcessedInvestmentStep,
} from './calculations';
import {
  investmentHistoryFilterSchema,
  type InvestmentHistoryFilterInput,
} from '@/lib/validations/investments';

export interface PortfolioSnapshotData {
  assets: InvestmentAssetRow[];
  transactions: InvestmentTransactionWithAsset[];
  quotes: InvestmentQuoteCacheRow[];
  overview: PortfolioOverviewMetrics;
  ledgerStepsByAsset: Record<string, ProcessedInvestmentStep[]>;
}

function normalizeAssetRow(row: InvestmentAssetRow): InvestmentAssetRow {
  return {
    ...row,
    id: String(row.id),
  };
}

function normalizeQuoteRow(row: InvestmentQuoteCacheRow): InvestmentQuoteCacheRow {
  return {
    ...row,
    id: String(row.id),
    asset_id: String(row.asset_id),
    price: String(row.price),
  };
}

function normalizeInvestmentTxRow(
  row: InvestmentTransactionRow,
  assetMap?: Map<string, InvestmentAssetRow>
): InvestmentTransactionWithAsset {
  const assetId = String(row.asset_id);
  const asset = assetMap?.get(assetId) ?? null;
  return {
    ...row,
    id: String(row.id),
    asset_id: assetId,
    quantity: String(row.quantity),
    price_per_share: String(row.price_per_share),
    fees: String(row.fees),
    asset: asset
      ? {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          asset_type: asset.asset_type,
          currency: asset.currency,
        }
      : null,
  };
}

export async function getPortfolioSnapshotData(): Promise<PortfolioSnapshotData> {
  const user = await requireAuthenticatedUser();
  await ensureUserProfileForUser(user);
  const supabase = await createServerSupabaseClient();

  const [assetsRes, txsRes, quotesRes] = await Promise.all([
    supabase
      .from('investment_assets')
      .select('*')
      .eq('user_id', user.id)
      .order('symbol', { ascending: true }),
    supabase
      .from('investment_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('trade_date', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('investment_quote_cache')
      .select('*')
      .eq('user_id', user.id),
  ]);

  const assets = ((assetsRes.data ?? []) as InvestmentAssetRow[]).map(normalizeAssetRow);
  const assetMap = new Map<string, InvestmentAssetRow>(assets.map((a) => [a.id, a]));

  const transactions = ((txsRes.data ?? []) as InvestmentTransactionRow[]).map((tx) =>
    normalizeInvestmentTxRow(tx, assetMap)
  );
  const quotes = ((quotesRes.data ?? []) as InvestmentQuoteCacheRow[]).map(normalizeQuoteRow);

  const overview = calculatePortfolioOverview(assets, transactions, quotes);

  const ledgerStepsByAsset: Record<string, ProcessedInvestmentStep[]> = {};
  for (const asset of assets) {
    const assetTxs = transactions.filter((t) => t.asset_id === asset.id);
    const ledger = processAssetTransactionsChronologically(assetTxs);
    ledgerStepsByAsset[asset.id] = ledger.steps;
  }

  return {
    assets,
    transactions,
    quotes,
    overview,
    ledgerStepsByAsset,
  };
}

export async function getFilteredInvestmentTransactions(
  rawFilters: Partial<InvestmentHistoryFilterInput>
): Promise<{
  transactions: InvestmentTransactionWithAsset[];
  assets: InvestmentAssetRow[];
  ledgerStepsByAsset: Record<string, ProcessedInvestmentStep[]>;
}> {
  const snapshot = await getPortfolioSnapshotData();
  const parsed = investmentHistoryFilterSchema.safeParse(rawFilters);
  const filters: InvestmentHistoryFilterInput = parsed.success
    ? parsed.data
    : {
        assetId: 'all',
        transactionType: 'all',
        startDate: '',
        endDate: '',
        sortOrder: 'desc',
      };

  let filtered = [...snapshot.transactions];

  if (filters.assetId !== 'all') {
    filtered = filtered.filter((t) => t.asset_id === filters.assetId);
  }
  if (filters.transactionType !== 'all') {
    filtered = filtered.filter((t) => t.transaction_type === filters.transactionType);
  }
  if (filters.startDate) {
    filtered = filtered.filter((t) => t.trade_date >= filters.startDate);
  }
  if (filters.endDate) {
    filtered = filtered.filter((t) => t.trade_date <= filters.endDate);
  }

  filtered.sort((a, b) => {
    if (a.trade_date !== b.trade_date) {
      return filters.sortOrder === 'asc'
        ? a.trade_date.localeCompare(b.trade_date)
        : b.trade_date.localeCompare(a.trade_date);
    }
    const idA = BigInt(a.id);
    const idB = BigInt(b.id);
    const cmp = idA < idB ? -1 : idA > idB ? 1 : 0;
    return filters.sortOrder === 'asc' ? cmp : -cmp;
  });

  return {
    transactions: filtered,
    assets: snapshot.assets,
    ledgerStepsByAsset: snapshot.ledgerStepsByAsset,
  };
}
