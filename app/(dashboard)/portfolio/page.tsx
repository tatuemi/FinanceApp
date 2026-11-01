import React from 'react';
import { getPortfolioSnapshotData } from '@/lib/investments/queries';
import { PortfolioDashboardView } from '@/components/portfolio/PortfolioDashboardView';

export default async function PortfolioPage() {
  const snapshot = await getPortfolioSnapshotData();

  return (
    <PortfolioDashboardView
      assets={snapshot.assets}
      overview={snapshot.overview}
    />
  );
}
