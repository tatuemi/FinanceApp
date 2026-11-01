'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  FinanceCategoryRow,
  FinanceTransactionType,
  FinanceTransactionWithCategory,
} from '@/types/database';
import type { FinanceDashboardMetrics } from '@/lib/finance/calculations';
import {
  createFinanceCategoryAction,
  updateFinanceCategoryAction,
  deleteFinanceCategoryAction,
  createFinanceTransactionAction,
  updateFinanceTransactionAction,
  deleteFinanceTransactionAction,
} from '@/lib/finance/actions';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from '@/lib/validations/finance';
import {
  formatCurrencyUSD,
  formatDateISOToDisplay,
  formatPercentage,
  getTodayDateISO,
} from '@/lib/utils/format';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  FinanceBalanceEvolutionChart,
  CategoryBreakdownCard,
} from '@/components/charts/FinanceCharts';
import {
  Plus,
  Tags,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Receipt,
  Pencil,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface FinanceWorkspaceProps {
  year: number;
  month: number;
  categories: FinanceCategoryRow[];
  metrics: FinanceDashboardMetrics;
  recentTransactions: FinanceTransactionWithCategory[];
}

const MONTHS_OPTIONS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export function FinanceWorkspace({
  year,
  month,
  categories,
  metrics,
  recentTransactions,
}: FinanceWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estado de modales y feedback
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransactionWithCategory | null>(null);
  const [txType, setTxType] = useState<FinanceTransactionType>('expense');
  const [txCategoryId, setTxCategoryId] = useState<string>('');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(getTodayDateISO());
  const [txDescription, setTxDescription] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txError, setTxError] = useState<string | null>(null);

  // Confirmación de eliminación de transacción
  const [deletingTx, setDeletingTx] = useState<FinanceTransactionWithCategory | null>(null);

  // Estado de gestión de categorías personalizadas
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<FinanceCategoryRow | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catKind, setCatKind] = useState<FinanceTransactionType>('expense');
  const [catColor, setCatColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);
  const [catIcon, setCatIcon] = useState<string>('wallet');
  const [catFeedback, setCatFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [deletingCat, setDeletingCat] = useState<FinanceCategoryRow | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [needsReassign, setNeedsReassign] = useState(false);

  const [bannerMessage, setBannerMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const filteredCategoriesForTx = categories.filter((c) => c.kind === txType);

  function openNewTransactionModal(defaultType: FinanceTransactionType = 'expense') {
    setEditingTx(null);
    setTxType(defaultType);
    const matching = categories.filter((c) => c.kind === defaultType);
    setTxCategoryId(matching[0]?.id ?? '');
    setTxAmount('');
    setTxDate(getTodayDateISO());
    setTxDescription('');
    setTxNotes('');
    setTxError(null);
    setTxModalOpen(true);
  }

  function openEditTransactionModal(tx: FinanceTransactionWithCategory) {
    setEditingTx(tx);
    setTxType(tx.transaction_type);
    setTxCategoryId(tx.category_id);
    setTxAmount(Number(tx.amount).toString());
    setTxDate(tx.transaction_date);
    setTxDescription(tx.description);
    setTxNotes(tx.notes ?? '');
    setTxError(null);
    setTxModalOpen(true);
  }

  function handleTxTypeChange(newType: FinanceTransactionType) {
    setTxType(newType);
    const matching = categories.filter((c) => c.kind === newType);
    setTxCategoryId(matching[0]?.id ?? '');
  }

  function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setTxError(null);

    startTransition(async () => {
      const payload = {
        categoryId: txCategoryId,
        transactionType: txType,
        amount: txAmount,
        transactionDate: txDate,
        description: txDescription,
        notes: txNotes,
      };

      const result = editingTx
        ? await updateFinanceTransactionAction(editingTx.id, payload)
        : await createFinanceTransactionAction(payload);

      if (!result.success) {
        setTxError(result.message);
        return;
      }

      setTxModalOpen(false);
      setBannerMessage({ type: 'ok', text: result.message });
      router.refresh();
    });
  }

  function handleConfirmDeleteTx() {
    if (!deletingTx) return;
    startTransition(async () => {
      const result = await deleteFinanceTransactionAction(deletingTx.id);
      setDeletingTx(null);
      setBannerMessage({
        type: result.success ? 'ok' : 'err',
        text: result.message,
      });
      router.refresh();
    });
  }

  function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatFeedback(null);

    startTransition(async () => {
      const payload = {
        name: catName,
        kind: catKind,
        color: catColor,
        icon: catIcon,
      };

      const result = editingCat
        ? await updateFinanceCategoryAction(editingCat.id, payload)
        : await createFinanceCategoryAction(payload);

      if (!result.success) {
        setCatFeedback({ type: 'err', text: result.message });
        return;
      }

      setEditingCat(null);
      setCatName('');
      setCatFeedback({ type: 'ok', text: result.message });
      router.refresh();
    });
  }

  function handleDeleteCategory() {
    if (!deletingCat) return;
    startTransition(async () => {
      const result = await deleteFinanceCategoryAction(
        deletingCat.id,
        needsReassign && reassignTargetId ? reassignTargetId : undefined
      );

      if (!result.success && result.code === 'REASSIGNMENT_REQUIRED') {
        setNeedsReassign(true);
        const candidates = categories.filter(
          (c) => c.kind === deletingCat.kind && c.id !== deletingCat.id
        );
        setReassignTargetId(candidates[0]?.id ?? '');
        setCatFeedback({ type: 'err', text: result.message });
        return;
      }

      if (!result.success) {
        setCatFeedback({ type: 'err', text: result.message });
        return;
      }

      setDeletingCat(null);
      setNeedsReassign(false);
      setReassignTargetId('');
      setCatFeedback({ type: 'ok', text: result.message });
      router.refresh();
    });
  }

  const { current, previous, incomeChangePct, expenseChangePct, balanceDiff } =
    metrics.comparison;

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Encabezado y controles de período */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Finanzas Personales
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Control de ingresos, gastos, categorías personalizadas y balance mensual en USD
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="period-month" className="sr-only">
            Mes
          </label>
          <select
            id="period-month"
            value={month}
            onChange={(e) =>
              router.push(`/finances?year=${year}&month=${e.target.value}`)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none"
          >
            {MONTHS_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <label htmlFor="period-year" className="sr-only">
            Año
          </label>
          <select
            id="period-year"
            value={year}
            onChange={(e) =>
              router.push(`/finances?year=${e.target.value}&month=${month}`)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setCatFeedback(null);
              setEditingCat(null);
              setCatName('');
              setCatModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Tags className="h-3.5 w-3.5 text-indigo-400" />
            <span>Categorías ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => openNewTransactionModal('expense')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva operación</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
            bannerMessage.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tarjetas de indicadores del mes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Ingresos ({current.periodLabel})
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-400">
            {formatCurrencyUSD(current.incomeTotal)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {incomeChangePct !== null
              ? `${formatPercentage(incomeChangePct, { showSign: true })} vs ${previous.periodLabel}`
              : `Mes anterior: ${formatCurrencyUSD(previous.incomeTotal)}`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Gastos ({current.periodLabel})
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-rose-400">
            {formatCurrencyUSD(current.expenseTotal)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {expenseChangePct !== null
              ? `${formatPercentage(expenseChangePct, { showSign: true })} vs ${previous.periodLabel}`
              : `Mes anterior: ${formatCurrencyUSD(previous.expenseTotal)}`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Balance Mensual (Ingresos − Gastos)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-3 text-2xl font-bold ${
              Number(current.netBalance) >= 0 ? 'text-white' : 'text-rose-400'
            }`}
          >
            {formatCurrencyUSD(current.netBalance, { showSign: true })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Diferencia vs {previous.periodLabel}:{' '}
            {formatCurrencyUSD(balanceDiff, { showSign: true })}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Operaciones del período
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">
            {current.transactionCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {current.incomeCount} ingreso(s) · {current.expenseCount} gasto(s)
          </p>
        </div>
      </div>

      {/* Gráficos de evolución y desglose */}
      <FinanceBalanceEvolutionChart
        dailyPoints={metrics.dailyEvolution}
        periodLabel={current.periodLabel}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdownCard
          title="Desglose de Gastos por Categoría"
          subtitle={current.periodLabel}
          items={metrics.expenseByCategory}
          emptyMessage={`Sin gastos registrados en ${current.periodLabel}.`}
        />
        <CategoryBreakdownCard
          title="Desglose de Ingresos por Categoría"
          subtitle={current.periodLabel}
          items={metrics.incomeByCategory}
          emptyMessage={`Sin ingresos registrados en ${current.periodLabel}.`}
        />
      </div>

      {/* Operaciones recientes del mes */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Movimientos recientes ({current.periodLabel})
            </h2>
            <p className="text-xs text-slate-400">
              Últimas operaciones registradas en este período
            </p>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="my-10 flex flex-col items-center justify-center text-center">
            <Receipt className="h-9 w-9 text-slate-600" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              Aún no tienes movimientos registrados en {current.periodLabel}
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Registra tu primer ingreso o gasto para calcular tu balance mensual y estadísticas por categoría.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openNewTransactionModal('income')}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                + Registrar ingreso
              </button>
              <button
                type="button"
                onClick={() => openNewTransactionModal('expense')}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                + Registrar gasto
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Fecha</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Importe (USD)</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-3 whitespace-nowrap text-slate-300">
                      {formatDateISOToDisplay(tx.transaction_date)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-white">{tx.description}</p>
                      {tx.notes && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-200">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tx.category?.color ?? '#64748b' }}
                        />
                        <span>{tx.category?.name ?? 'Categoría'}</span>
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-semibold whitespace-nowrap ${
                        tx.transaction_type === 'income'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {tx.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrencyUSD(tx.amount)}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTransactionModal(tx)}
                          aria-label={`Editar ${tx.description}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTx(tx)}
                          aria-label={`Eliminar ${tx.description}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Creación / Edición de Operación Financiera */}
      {txModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 id="tx-modal-title" className="text-base font-semibold text-white">
                {editingTx ? 'Editar operación financiera' : 'Registrar ingreso o gasto'}
              </h3>
              <button
                type="button"
                onClick={() => setTxModalOpen(false)}
                aria-label="Cerrar modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => handleTxTypeChange('expense')}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    txType === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => handleTxTypeChange('income')}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    txType === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ingreso
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="tx-amount" className="block text-xs font-medium text-slate-300">
                    Importe (USD) *
                  </label>
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="tx-date" className="block text-xs font-medium text-slate-300">
                    Fecha *
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tx-category" className="block text-xs font-medium text-slate-300">
                  Categoría ({txType === 'income' ? 'Ingresos' : 'Gastos'}) *
                </label>
                <select
                  id="tx-category"
                  required
                  value={txCategoryId}
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {filteredCategoriesForTx.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tx-desc" className="block text-xs font-medium text-slate-300">
                  Descripción *
                </label>
                <input
                  id="tx-desc"
                  type="text"
                  required
                  maxLength={200}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Ej. Compra supermercado, Pago de luz, Sueldo mensual"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="tx-notes" className="block text-xs font-medium text-slate-300">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  id="tx-notes"
                  rows={2}
                  maxLength={1000}
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Detalles adicionales..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {txError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
                >
                  {txError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTxModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingTx ? 'Guardar cambios' : 'Registrar operación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Categorías Personalizadas */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-modal-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 id="cat-modal-title" className="text-base font-semibold text-white">
                Gestión de Categorías Personalizadas
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCatModalOpen(false);
                  setDeletingCat(null);
                  setNeedsReassign(false);
                }}
                aria-label="Cerrar gestor de categorías"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {catFeedback && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs ${
                  catFeedback.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                }`}
              >
                {catFeedback.text}
              </div>
            )}

            <form
              onSubmit={handleSaveCategory}
              className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
            >
              <p className="text-xs font-semibold text-slate-200">
                {editingCat ? `Editando categoría: ${editingCat.name}` : 'Crear nueva categoría'}
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="cat-name" className="block text-[11px] text-slate-400">
                    Nombre *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    maxLength={80}
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ej. Gimnasio, Dividendos"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label htmlFor="cat-kind" className="block text-[11px] text-slate-400">
                    Tipo *
                  </label>
                  <select
                    id="cat-kind"
                    value={catKind}
                    onChange={(e) => setCatKind(e.target.value as FinanceTransactionType)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cat-icon" className="block text-[11px] text-slate-400">
                    Icono
                  </label>
                  <select
                    id="cat-icon"
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    {CATEGORY_ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-slate-400">Color</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CATEGORY_COLOR_OPTIONS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setCatColor(hex)}
                      aria-label={`Seleccionar color ${hex}`}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        catColor === hex ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {editingCat && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCat(null);
                      setCatName('');
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingCat ? 'Actualizar categoría' : 'Añadir categoría'}</span>
                </button>
              </div>
            </form>

            {/* Reasignación explícita cuando una categoría a eliminar tiene operaciones */}
            {deletingCat && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-3">
                <p className="font-semibold">
                  ¿Eliminar la categoría «{deletingCat.name}»?
                </p>
                {needsReassign && (
                  <div>
                    <label
                      htmlFor="reassign-select"
                      className="block text-[11px] text-amber-200 mb-1"
                    >
                      Selecciona a qué categoría del mismo tipo reasignar sus operaciones para no perder registros:
                    </label>
                    <select
                      id="reassign-select"
                      value={reassignTargetId}
                      onChange={(e) => setReassignTargetId(e.target.value)}
                      className="w-full rounded-xl border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      {categories
                        .filter((c) => c.kind === deletingCat.kind && c.id !== deletingCat.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingCat(null);
                      setNeedsReassign(false);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCategory}
                    disabled={isPending}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                  >
                    {needsReassign ? 'Reasignar y eliminar' : 'Confirmar eliminación'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(['income', 'expense'] as const).map((kindGroup) => (
                <div key={kindGroup}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    {kindGroup === 'income' ? 'Categorías de Ingresos' : 'Categorías de Gastos'}
                  </h4>
                  <div className="space-y-1.5">
                    {categories
                      .filter((c) => c.kind === kindGroup)
                      .map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-white"
                              style={{ backgroundColor: cat.color }}
                            >
                              <CategoryIcon iconName={cat.icon} className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-medium text-slate-200">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCat(cat);
                                setCatName(cat.name);
                                setCatKind(cat.kind);
                                setCatColor(cat.color);
                                setCatIcon(cat.icon);
                              }}
                              aria-label={`Editar categoría ${cat.name}`}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingCat(cat);
                                setNeedsReassign(false);
                              }}
                              aria-label={`Eliminar categoría ${cat.name}`}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación antes de eliminar operación */}
      <ConfirmDialog
        isOpen={Boolean(deletingTx)}
        title="Eliminar operación financiera"
        description={
          deletingTx
            ? `¿Estás seguro de que deseas eliminar "${deletingTx.description}" por ${formatCurrencyUSD(
                deletingTx.amount
              )}? Esta acción actualizará el balance mensual y no se puede deshacer.`
            : ''
        }
        isLoading={isPending}
        onConfirm={handleConfirmDeleteTx}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  );
}
