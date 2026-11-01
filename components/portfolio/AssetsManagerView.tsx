'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  InvestmentAssetRow,
  InvestmentAssetType,
  InvestmentQuoteCacheRow,
} from '@/types/database';
import {
  createInvestmentAssetAction,
  updateInvestmentAssetAction,
  deleteInvestmentAssetAction,
  upsertManualQuoteAction,
} from '@/lib/investments/actions';
import {
  formatDateISOToDisplay,
  formatSharePriceUSD,
  formatTimestampToDisplay,
} from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Plus,
  Briefcase,
  Pencil,
  Trash2,
  RefreshCw,
  Edit3,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AssetsManagerViewProps {
  assets: InvestmentAssetRow[];
  quotes: InvestmentQuoteCacheRow[];
}

export function AssetsManagerView({ assets, quotes }: AssetsManagerViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InvestmentAssetRow | null>(null);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<InvestmentAssetType>('stock');
  const [exchange, setExchange] = useState('');
  const [providerSymbol, setProviderSymbol] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingAsset, setDeletingAsset] = useState<InvestmentAssetRow | null>(null);
  const [manualQuoteAsset, setManualQuoteAsset] = useState<InvestmentAssetRow | null>(null);
  const [manualPrice, setManualPrice] = useState('');
  const [refreshingAssetId, setRefreshingAssetId] = useState<string | null>(null);

  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const quoteMap = new Map<string, InvestmentQuoteCacheRow>();
  for (const q of quotes) {
    quoteMap.set(q.asset_id, q);
  }

  function openNewAssetModal() {
    setEditingAsset(null);
    setSymbol('');
    setName('');
    setAssetType('stock');
    setExchange('NASDAQ');
    setProviderSymbol('');
    setFormError(null);
    setModalOpen(true);
  }

  function openEditAssetModal(asset: InvestmentAssetRow) {
    setEditingAsset(asset);
    setSymbol(asset.symbol);
    setName(asset.name);
    setAssetType(asset.asset_type);
    setExchange(asset.exchange ?? '');
    setProviderSymbol(asset.provider_symbol ?? asset.symbol);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSaveAsset(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const payload = {
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        assetType,
        exchange: exchange.trim() || null,
        providerSymbol: (providerSymbol.trim() || symbol.trim()).toUpperCase(),
        currency: 'USD' as const,
      };

      const res = editingAsset
        ? await updateInvestmentAssetAction(editingAsset.id, payload)
        : await createInvestmentAssetAction(payload);

      if (!res.success) {
        setFormError(res.message);
        return;
      }

      setModalOpen(false);
      setBanner({ type: 'ok', text: res.message });
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!deletingAsset) return;
    startTransition(async () => {
      const res = await deleteInvestmentAssetAction(deletingAsset.id);
      setDeletingAsset(null);
      setBanner({ type: res.success ? 'ok' : 'err', text: res.message });
      router.refresh();
    });
  }

  async function handleRefreshSingleQuote(asset: InvestmentAssetRow) {
    setRefreshingAssetId(asset.id);
    setBanner(null);

    try {
      const res = await fetch(
        `/api/market/quote?assetId=${encodeURIComponent(asset.id)}&force=true`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );
      const data = (await res.json()) as {
        quote?: { price: string };
        warningMessage?: string;
        message?: string;
      };

      if (res.ok && data.quote) {
        setBanner({
          type: 'ok',
          text: `${asset.symbol}: cotización actualizada (${formatSharePriceUSD(data.quote.price)}).`,
        });
      } else {
        setBanner({
          type: 'err',
          text:
            data.warningMessage ??
            data.message ??
            `No se pudo actualizar ${asset.symbol} desde la API. Puedes usar cotización manual.`,
        });
      }
      router.refresh();
    } catch {
      setBanner({
        type: 'err',
        text: 'Error de red al consultar la cotización.',
      });
    } finally {
      setRefreshingAssetId(null);
    }
  }

  function handleSaveManualQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!manualQuoteAsset) return;

    startTransition(async () => {
      const res = await upsertManualQuoteAction({
        assetId: manualQuoteAsset.id,
        price: manualPrice,
      });

      if (!res.success) {
        setBanner({ type: 'err', text: res.message });
        return;
      }

      setManualQuoteAsset(null);
      setBanner({ type: 'ok', text: res.message });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Catálogo de Activos (Acciones, ETF y Criptos)
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Administra las acciones, fondos cotizados (ETF) y criptomonedas de tu portafolio en USD
          </p>
        </div>

        <button
          type="button"
          onClick={openNewAssetModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar activo</span>
        </button>
      </div>

      {banner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
            banner.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        {assets.length === 0 ? (
          <div className="my-12 flex flex-col items-center justify-center text-center">
            <Briefcase className="h-9 w-9 text-slate-600" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              No tienes acciones, ETF ni criptos registrados todavía
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Registra tus instrumentos (ej. AAPL, MSFT, SPY, QQQ, BTC, ETH, SOL) para empezar a llevar el registro de compras y ventas y actualizar su precio automáticamente.
            </p>
            <button
              type="button"
              onClick={openNewAssetModal}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              + Añadir primer activo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Símbolo</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Bolsa / Símbolo API</th>
                  <th className="py-2.5 px-3">Incorporación</th>
                  <th className="py-2.5 px-3 text-right">Última Cotización</th>
                  <th className="py-2.5 px-3 text-center">Origen</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {assets.map((asset) => {
                  const quote = quoteMap.get(asset.id);
                  const isRefreshing = refreshingAssetId === asset.id;

                  return (
                    <tr key={asset.id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-3 font-bold text-white whitespace-nowrap">
                        {asset.symbol}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-200">
                        {asset.name}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] uppercase text-slate-300">
                          {asset.asset_type === 'etf'
                            ? 'ETF'
                            : asset.asset_type === 'crypto'
                            ? 'Cripto'
                            : 'Acción'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {asset.exchange ?? 'EE. UU.'} · API:{' '}
                        <code className="text-slate-200">
                          {asset.provider_symbol ?? asset.symbol}
                        </code>
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {formatDateISOToDisplay(asset.created_at.slice(0, 10))}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {quote ? (
                          <div>
                            <span className="font-semibold text-white">
                              {formatSharePriceUSD(quote.price)}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {formatTimestampToDisplay(quote.fetched_at)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-500">Sin cotización</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <StatusBadge
                          status={
                            !quote
                              ? 'missing'
                              : quote.provider === 'manual'
                              ? 'manual'
                              : 'live'
                          }
                          label={!quote ? 'Pendiente' : quote.provider}
                        />
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleRefreshSingleQuote(asset)}
                            disabled={isRefreshing}
                            title="Consultar cotización API"
                            aria-label={`Consultar cotización API de ${asset.symbol}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setManualQuoteAsset(asset);
                              setManualPrice(quote ? Number(quote.price).toString() : '');
                            }}
                            title="Fijar precio manual"
                            aria-label={`Precio manual para ${asset.symbol}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-emerald-300"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAssetModal(asset)}
                            aria-label={`Editar activo ${asset.symbol}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAsset(asset)}
                            aria-label={`Eliminar activo ${asset.symbol}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Creación / Edición de Activo */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editingAsset ? `Editar activo (${editingAsset.symbol})` : 'Registrar nuevo activo'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="asset-symbol" className="block text-xs font-medium text-slate-300">
                    Símbolo bursátil *
                  </label>
                  <input
                    id="asset-symbol"
                    type="text"
                    required
                    maxLength={20}
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder={
                      assetType === 'crypto'
                        ? 'Ej. BTC, ETH o SOL'
                        : 'Ej. AAPL o QQQ'
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono uppercase text-white"
                  />
                </div>

                <div>
                  <label htmlFor="asset-type" className="block text-xs font-medium text-slate-300">
                    Tipo de instrumento *
                  </label>
                  <select
                    id="asset-type"
                    value={assetType}
                    onChange={(e) => {
                      const nextType = e.target.value as InvestmentAssetType;
                      setAssetType(nextType);
                      if (nextType === 'crypto' && (!exchange || exchange === 'NASDAQ')) {
                        setExchange('CRYPTO');
                      } else if (nextType !== 'crypto' && exchange === 'CRYPTO') {
                        setExchange('NASDAQ');
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="stock">Acción (Stock)</option>
                    <option value="etf">Fondo Cotizado (ETF)</option>
                    <option value="crypto">Criptomoneda (Crypto)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="asset-name" className="block text-xs font-medium text-slate-300">
                  Nombre completo del activo *
                </label>
                <input
                  id="asset-name"
                  type="text"
                  required
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    assetType === 'crypto'
                      ? 'Ej. Bitcoin o Ethereum'
                      : 'Ej. Apple Inc. o Invesco QQQ Trust'
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="asset-exchange" className="block text-xs font-medium text-slate-300">
                    Mercado / Bolsa
                  </label>
                  <input
                    id="asset-exchange"
                    type="text"
                    maxLength={50}
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value.toUpperCase())}
                    placeholder={assetType === 'crypto' ? 'CRYPTO, BINANCE...' : 'NASDAQ, NYSE...'}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label htmlFor="asset-provider-symbol" className="block text-xs font-medium text-slate-300">
                    Símbolo reconocido API
                  </label>
                  <input
                    id="asset-provider-symbol"
                    type="text"
                    maxLength={30}
                    value={providerSymbol}
                    onChange={(e) => setProviderSymbol(e.target.value.toUpperCase())}
                    placeholder={
                      assetType === 'crypto'
                        ? `${symbol || 'BTC'}/USD`
                        : symbol || 'AAPL'
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono uppercase text-white"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Moneda de negociación: <strong className="text-slate-200">USD</strong> (moneda base de valoración).
              </p>

              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingAsset ? 'Guardar cambios' : 'Registrar activo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cotización Manual Rápida */}
      {manualQuoteAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Cotización manual para {manualQuoteAsset.symbol}
              </h3>
              <button
                type="button"
                onClick={() => setManualQuoteAsset(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualQuote} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Precio unitario en USD *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Ej. 220.50"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualQuoteAsset(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Guardar precio manual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingAsset)}
        title="Eliminar activo del portafolio"
        description={
          deletingAsset
            ? `¿Confirmas eliminar ${deletingAsset.symbol} (${deletingAsset.name})? Solo se permite eliminar activos que no tengan operaciones de compra o venta asociadas.`
            : ''
        }
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAsset(null)}
      />
    </div>
  );
}
