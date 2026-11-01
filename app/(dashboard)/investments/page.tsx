import React from 'react';
import {
  getFilteredInvestmentTransactions,
  getPortfolioSnapshotData,
} from '@/lib/investments/queries';
import { InvestmentTransactionsView } from '@/components/portfolio/InvestmentTransactionsView';

interface InvestmentsPageProps {
  searchParams: Promise<{
    assetId?: string;
    transactionType?: 'all' | 'buy' | 'sell';
    startDate?: string;
    endDate?: string;
    sortOrder?: 'desc' | 'asc';
  }>;
}

export default async function InvestmentsPage({ searchParams }: InvestmentsPageProps) {
  const params = await searchParams;

  const initialFilters = {
    assetId: params.assetId ?? 'all',
    transactionType:
      params.transactionType === 'buy' || params.transactionType === 'sell'
        ? params.transactionType
        : ('all' as const),
    startDate: params.startDate ?? '',
    endDate: params.endDate ?? '',
    sortOrder: params.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const),
  };

  const [filteredData, snapshot] = await Promise.all([
    getFilteredInvestmentTransactions(initialFilters),
    getPortfolioSnapshotData(),
  ]);

  return (
    <InvestmentTransactionsView
      transactions={filteredData.transactions}
      assets={filteredData.assets}
      quotes={snapshot.quotes}
      ledgerStepsByAsset={filteredData.ledgerStepsByAsset}
      initialFilters={initialFilters}
    />
  );
}
