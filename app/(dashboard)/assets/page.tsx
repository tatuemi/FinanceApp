import React from 'react';
import { getPortfolioSnapshotData } from '@/lib/investments/queries';
import { AssetsManagerView } from '@/components/portfolio/AssetsManagerView';

export default async function AssetsPage() {
  const snapshot = await getPortfolioSnapshotData();

  return (
    <AssetsManagerView
      assets={snapshot.assets}
      quotes={snapshot.quotes}
    />
  );
}
