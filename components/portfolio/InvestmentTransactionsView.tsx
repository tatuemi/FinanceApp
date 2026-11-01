'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import type {
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionType,
  InvestmentTransactionWithAsset,
} from '@/types/database';
import type { ProcessedInvestmentStep } from '@/lib/investments/calculations';
import {
  createInvestmentTransactionAction,
  updateInvestmentTransactionAction,
  deleteInvestmentTransactionAction,
} from '@/lib/investments/actions';
import {
  formatCurrencyUSD,
  formatDateISOToDisplay,
  formatSharePriceUSD,
  formatShareQuantity,
  getTodayDateISO,
} from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Plus,
  Filter,
  Pencil,
  Trash2,
  ArrowLeftRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface InvestmentTransactionsViewProps {
  transactions: InvestmentTransactionWithAsset[];
  assets: InvestmentAssetRow[];
  quotes: InvestmentQuoteCacheRow[];
  ledgerStepsByAsset: Record<string, ProcessedInvestmentStep[]>;
  initialFilters: {
    assetId: string;
    transactionType: 'all' | 'buy' | 'sell';
    startDate: string;
    endDate: string;
    sortOrder: 'desc' | 'asc';
  };
}

export function InvestmentTransactionsView({
  transactions,
  assets,
  quotes,
  ledgerStepsByAsset,
  initialFilters,
}: InvestmentTransactionsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filtros
  const [filterAssetId, setFilterAssetId] = useState(initialFilters.assetId);
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>(
    initialFilters.transactionType
  );
  const [filterStartDate, setFilterStartDate] = useState(initialFilters.startDate);
  const [filterEndDate, setFilterEndDate] = useState(initialFilters.endDate);
  const [filterSort, setFilterSort] = useState<'desc' | 'asc'>(initialFilters.sortOrder);

  // Modal de registro/edición
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<InvestmentTransactionWithAsset | null>(null);
  const [assetId, setAssetId] = useState<string>(assets[0]?.id ?? '');
  const [txType, setTxType] = useState<InvestmentTransactionType>('buy');
  const [tradeDate, setTradeDate] = useState<string>(getTodayDateISO());
  const [inputMode, setInputMode] = useState<'quantity' | 'amount'>('quantity');
  const [quantity, setQuantity] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [pricePerShare, setPricePerShare] = useState<string>('');
  const [fees, setFees] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingTx, setDeletingTx] = useState<InvestmentTransactionWithAsset | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const quoteByAsset = useMemo(() => {
    const map = new Map<string, InvestmentQuoteCacheRow>();
    for (const q of quotes) {
      map.set(q.asset_id, q);
    }
    return map;
  }, [quotes]);

  // Mapa rápido del paso contable por transacción para mostrar costo promedio y ganancia realizada
  const stepByTxId = useMemo(() => {
    const map = new Map<string, ProcessedInvestmentStep>();
    for (const steps of Object.values(ledgerStepsByAsset)) {
      for (const s of steps) {
        map.set(s.transactionId, s);
      }
    }
    return map;
  }, [ledgerStepsByAsset]);

  // Cantidad actual disponible del activo seleccionado en el formulario
  const currentAvailableSharesForAsset = useMemo(() => {
    const steps = ledgerStepsByAsset[assetId] ?? [];
    if (steps.length === 0) return '0';
    return steps[steps.length - 1]?.runningQuantityAfter ?? '0';
  }, [ledgerStepsByAsset, assetId]);

  // Cálculo de vista previa en vivo en el formulario (Cantidad = Importe / Precio)
  const livePreview = useMemo(() => {
    try {
      const priceDec = new Decimal(pricePerShare || '0');
      if (priceDec.lessThanOrEqualTo(0)) return null;

      const qtyDec =
        inputMode === 'amount'
          ? new Decimal(totalAmount || '0').div(priceDec).toDP(10, Decimal.ROUND_HALF_UP)
          : new Decimal(quantity || '0').toDP(10, Decimal.ROUND_HALF_UP);

      if (qtyDec.lessThanOrEqualTo(0)) return null;

      const feesDec = new Decimal(fees || '0');
      const grossDec = qtyDec.mul(priceDec);
      const netDec =
        txType === 'buy' ? grossDec.plus(feesDec) : grossDec.minus(feesDec);

      return {
        computedQuantity: qtyDec.toFixed(10),
        grossAmount: grossDec.toFixed(4),
        netTotal: netDec.toFixed(4),
      };
    } catch {
      return null;
    }
  }, [inputMode, quantity, totalAmount, pricePerShare, fees, txType]);

  function openNewTxModal(defaultType: InvestmentTransactionType = 'buy') {
    setEditingTx(null);
    setAssetId(assets[0]?.id ?? '');
    setTxType(defaultType);
    setTradeDate(getTodayDateISO());
    setInputMode('quantity');
    setQuantity('');
    setTotalAmount('');
    setPricePerShare('');
    setFees('0');
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  }

  function openEditTxModal(tx: InvestmentTransactionWithAsset) {
    setEditingTx(tx);
    setAssetId(tx.asset_id);
    setTxType(tx.transaction_type);
    setTradeDate(tx.trade_date);
    setInputMode('quantity');
    setQuantity(formatShareQuantity(tx.quantity).replace(/,/g, ''));
    setTotalAmount('');
    setPricePerShare(Number(tx.price_per_share).toString());
    setFees(Number(tx.fees).toString());
    setNotes(tx.notes ?? '');
    setFormError(null);
    setModalOpen(true);
  }

  function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const payload = {
        assetId,
        transactionType: txType,
        tradeDate,
        inputMode,
        quantity,
        totalAmount,
        pricePerShare,
        fees,
        notes,
      };

      const res = editingTx
        ? await updateInvestmentTransactionAction(editingTx.id, payload)
        : await createInvestmentTransactionAction(payload);

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
    if (!deletingTx) return;
    startTransition(async () => {
      const res = await deleteInvestmentTransactionAction(deletingTx.id);
      setDeletingTx(null);
      setBanner({ type: res.success ? 'ok' : 'err', text: res.message });
      router.refresh();
    });
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (filterAssetId !== 'all') params.set('assetId', filterAssetId);
    if (filterType !== 'all') params.set('transactionType', filterType);
    if (filterStartDate) params.set('startDate', filterStartDate);
    if (filterEndDate) params.set('endDate', filterEndDate);
    if (filterSort !== 'desc') params.set('sortOrder', filterSort);
    router.push(`/investments?${params.toString()}`);
  }

  const selectedAssetQuote = quoteByAsset.get(assetId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Operaciones de Inversión (Compras y Ventas)
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Registro por cantidad de títulos (incluidas fracciones) o por importe en USD, con validación cronológica de saldo
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {assets.length === 0 ? (
            <Link
              href="/assets"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span>Primero registra un activo</span>
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openNewTxModal('buy')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar compra</span>
              </button>
              <button
                type="button"
                onClick={() => openNewTxModal('sell')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Registrar venta</span>
              </button>
            </>
          )}
        </div>
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

      {/* Filtros de operaciones bursátiles */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="inv-filter-asset" className="block text-[11px] text-slate-400">
              Activo
            </label>
            <select
              id="inv-filter-asset"
              value={filterAssetId}
              onChange={(e) => setFilterAssetId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">Todos los activos</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inv-filter-type" className="block text-[11px] text-slate-400">
              Tipo de operación
            </label>
            <select
              id="inv-filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'buy' | 'sell')}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">Compras y Ventas</option>
              <option value="buy">Solo Compras</option>
              <option value="sell">Solo Ventas</option>
            </select>
          </div>

          <div>
            <label htmlFor="inv-filter-start" className="block text-[11px] text-slate-400">
              Fecha inicial
            </label>
            <input
              id="inv-filter-start"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label htmlFor="inv-filter-end" className="block text-[11px] text-slate-400">
              Fecha final
            </label>
            <input
              id="inv-filter-end"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label htmlFor="inv-filter-sort" className="block text-[11px] text-slate-400">
              Orden cronológico
            </label>
            <select
              id="inv-filter-sort"
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value as 'desc' | 'asc')}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="desc">Más recientes primero</option>
              <option value="asc">Cronológico (antiguas primero)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800/80 pt-3">
          <button
            type="button"
            onClick={() => {
              setFilterAssetId('all');
              setFilterType('all');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterSort('desc');
              router.push('/investments');
            }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-300"
          >
            Limpiar
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filtrar historial</span>
          </button>
        </div>
      </form>

      {/* Tabla de Operaciones Bursátiles */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        {transactions.length === 0 ? (
          <div className="my-12 flex flex-col items-center justify-center text-center">
            <ArrowLeftRight className="h-9 w-9 text-slate-600" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              No hay operaciones bursátiles que coincidan con el filtro
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Registra tus compras y ventas confirmando el precio de ejecución real y las comisiones correspondientes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Fecha</th>
                  <th className="py-2.5 px-3">Activo</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Precio Ejecución</th>
                  <th className="py-2.5 px-3 text-right">Comisión</th>
                  <th className="py-2.5 px-3 text-right">Importe Bruto</th>
                  <th className="py-2.5 px-3 text-right">Resultado Realizado</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {transactions.map((tx) => {
                  const step = stepByTxId.get(tx.id);
                  const gross = new Decimal(tx.quantity).mul(new Decimal(tx.price_per_share));

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-3 whitespace-nowrap text-slate-300">
                        {formatDateISOToDisplay(tx.trade_date)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-white">
                          {tx.asset?.symbol ?? 'Activo'}
                        </span>
                        <span className="ml-1.5 text-[11px] text-slate-400">
                          {tx.asset?.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            tx.transaction_type === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {tx.transaction_type === 'buy' ? 'Compra' : 'Venta'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                        {formatShareQuantity(tx.quantity)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-200 whitespace-nowrap">
                        {formatSharePriceUSD(tx.price_per_share)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                        {formatCurrencyUSD(tx.fees)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-white whitespace-nowrap">
                        {formatCurrencyUSD(gross)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {tx.transaction_type === 'sell' && step?.realizedGainLoss ? (
                          <span
                            className={`font-semibold ${
                              Number(step.realizedGainLoss) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formatCurrencyUSD(step.realizedGainLoss, { showSign: true })}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTxModal(tx)}
                            aria-label={`Editar operación de ${tx.asset?.symbol ?? 'activo'}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            aria-label={`Eliminar operación de ${tx.asset?.symbol ?? 'activo'}`}
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

      {/* Modal de Registro / Edición de Compra o Venta */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editingTx ? 'Editar operación bursátil' : 'Registrar compra o venta'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setTxType('buy')}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    txType === 'buy'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compra (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('sell')}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    txType === 'sell'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Venta (Sell)
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="inv-asset" className="block text-xs font-medium text-slate-300">
                    Activo *
                  </label>
                  <select
                    id="inv-asset"
                    required
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol} — {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Disponible actual:{' '}
                    <strong className="font-mono text-slate-200">
                      {formatShareQuantity(currentAvailableSharesForAsset)}
                    </strong>{' '}
                    títulos
                  </p>
                </div>

                <div>
                  <label htmlFor="inv-date" className="block text-xs font-medium text-slate-300">
                    Fecha de negociación *
                  </label>
                  <input
                    id="inv-date"
                    type="date"
                    required
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Precio de ejecución confirmado con referencia opcional a última cotización (Sección 5.3.B) */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="inv-price" className="block text-xs font-medium text-slate-300">
                    Precio de ejecución por título (USD) *
                  </label>
                  {selectedAssetQuote && (
                    <button
                      type="button"
                      onClick={() =>
                        setPricePerShare(Number(selectedAssetQuote.price).toString())
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>
                        Usar referencia ({formatSharePriceUSD(selectedAssetQuote.price)})
                      </span>
                    </button>
                  )}
                </div>
                <input
                  id="inv-price"
                  type="number"
                  step="any"
                  min="0.00000001"
                  required
                  value={pricePerShare}
                  onChange={(e) => setPricePerShare(e.target.value)}
                  placeholder="Ej. 185.50"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Introduce el precio real de ejecución de tu operación (no se confunde automáticamente con el precio de mercado).
                </p>
              </div>

              {/* Modo de entrada: Por cantidad de títulos (fraccionados) o por importe en USD */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    Método de cálculo de la posición:
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                    <button
                      type="button"
                      onClick={() => setInputMode('quantity')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                        inputMode === 'quantity'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      Por cantidad de títulos
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('amount')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                        inputMode === 'amount'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      Por importe en USD
                    </button>
                  </div>
                </div>

                {inputMode === 'quantity' ? (
                  <div>
                    <label htmlFor="inv-qty" className="block text-xs font-medium text-slate-300">
                      Cantidad de títulos (admite fracciones ej. 0.25, 0.5, 1.75) *
                    </label>
                    <input
                      id="inv-qty"
                      type="number"
                      step="any"
                      min="0.0000000001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Ej. 0.5 o 2.75"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="inv-amount" className="block text-xs font-medium text-slate-300">
                      Importe de la operación en USD (Cantidad = Importe / Precio) *
                    </label>
                    <input
                      id="inv-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="Ej. 100.00"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="inv-fees" className="block text-xs font-medium text-slate-300">
                    Comisiones del bróker (USD)
                  </label>
                  <input
                    id="inv-fees"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label htmlFor="inv-notes" className="block text-xs font-medium text-slate-300">
                    Notas (opcional)
                  </label>
                  <input
                    id="inv-notes"
                    type="text"
                    maxLength={1000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Aportación mensual DCA"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {livePreview && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Cantidad de títulos calculada:</span>
                    <strong className="font-mono text-white">
                      {formatShareQuantity(livePreview.computedQuantity)} títulos
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Importe bruto:</span>
                    <strong className="text-white">
                      {formatCurrencyUSD(livePreview.grossAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>
                      {txType === 'buy'
                        ? 'Costo total (bruto + comisión):'
                        : 'Ingreso neto (bruto − comisión):'}
                    </span>
                    <strong className="text-indigo-300">
                      {formatCurrencyUSD(livePreview.netTotal)}
                    </strong>
                  </div>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
                >
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
                  <span>
                    {editingTx
                      ? 'Guardar cambios'
                      : `Confirmar ${txType === 'buy' ? 'compra' : 'venta'}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingTx)}
        title="Eliminar operación bursátil"
        description={
          deletingTx
            ? `¿Confirmas eliminar la ${
                deletingTx.transaction_type === 'buy' ? 'compra' : 'venta'
              } de ${formatShareQuantity(deletingTx.quantity)} títulos de ${
                deletingTx.asset?.symbol ?? 'activo'
              }? El sistema verificará que eliminarla no deje en negativo ninguna venta posterior.`
            : ''
        }
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  );
}
