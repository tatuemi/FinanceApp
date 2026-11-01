import React from 'react';
import { requireAuthenticatedUser, ensureUserProfileForUser } from '@/lib/auth/session';
import { resolveMarketDataProvider } from '@/lib/market-data/providers';
import { SettingsView } from '@/components/dashboard/SettingsView';

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser();
  const profile = await ensureUserProfileForUser(user);
  const provider = resolveMarketDataProvider();

  return (
    <SettingsView
      userEmail={user.email ?? 'usuario@google.com'}
      fullName={profile.full_name ?? user.email?.split('@')[0] ?? 'Usuario'}
      avatarUrl={profile.avatar_url}
      baseCurrency={profile.base_currency}
      marketDataProviderName={provider.name}
      isMarketApiConfigured={provider.isConfigured}
    />
  );
}
