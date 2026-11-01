import React from 'react';
import { getFinanceDashboardData } from '@/lib/finance/queries';
import { FinanceWorkspace } from '@/components/finances/FinanceWorkspace';

interface FinancesPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
  }>;
}

export default async function FinancesPage({ searchParams }: FinancesPageProps) {
  const params = await searchParams;
  const parsedYear = params.year ? Number(params.year) : undefined;
  const parsedMonth = params.month ? Number(params.month) : undefined;

  const data = await getFinanceDashboardData(parsedYear, parsedMonth);

  return (
    <FinanceWorkspace
      year={data.year}
      month={data.month}
      categories={data.categories}
      metrics={data.metrics}
      recentTransactions={data.recentTransactions}
    />
  );
}
