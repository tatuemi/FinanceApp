import React from 'react';
import { getPaginatedFinanceTransactions } from '@/lib/finance/queries';
import { FinanceHistoryView } from '@/components/finances/FinanceHistoryView';

interface TransactionsHistoryPageProps {
  searchParams: Promise<{
    search?: string;
    transactionType?: 'all' | 'income' | 'expense';
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    sortOrder?: 'desc' | 'asc';
    page?: string;
  }>;
}

export default async function TransactionsHistoryPage({
  searchParams,
}: TransactionsHistoryPageProps) {
  const params = await searchParams;

  const initialFilters = {
    search: params.search ?? '',
    transactionType:
      params.transactionType === 'income' || params.transactionType === 'expense'
        ? params.transactionType
        : ('all' as const),
    categoryId: params.categoryId ?? 'all',
    startDate: params.startDate ?? '',
    endDate: params.endDate ?? '',
    sortOrder: params.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const),
  };

  const paginated = await getPaginatedFinanceTransactions({
    ...initialFilters,
    page: params.page ? Number(params.page) : 1,
    pageSize: 15,
  });

  return (
    <FinanceHistoryView
      items={paginated.items}
      totalCount={paginated.totalCount}
      page={paginated.page}
      pageSize={paginated.pageSize}
      totalPages={paginated.totalPages}
      categories={paginated.categories}
      initialFilters={initialFilters}
    />
  );
}
