'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  FinanceCategoryRow,
  FinanceTransactionType,
  FinanceTransactionWithCategory,
} from '@/types/database';
import {
  updateFinanceTransactionAction,
  deleteFinanceTransactionAction,
} from '@/lib/finance/actions';
import { formatCurrencyUSD, formatDateISOToDisplay } from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Search,
  Filter,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  X,
  Loader2,
} from 'lucide-react';

interface FinanceHistoryViewProps {
  items: FinanceTransactionWithCategory[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: FinanceCategoryRow[];
  initialFilters: {
    search: string;
    transactionType: 'all' | 'income' | 'expense';
    categoryId: string;
    startDate: string;
    endDate: string;
    sortOrder: 'desc' | 'asc';
  };
}

export function FinanceHistoryView({
  items,
  totalCount,
  page,
  totalPages,
  categories,
  initialFilters,
}: FinanceHistoryViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialFilters.search);
  const [transactionType, setTransactionType] = useState<'all' | 'income' | 'expense'>(
    initialFilters.transactionType
  );
  const [categoryId, setCategoryId] = useState(initialFilters.categoryId);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(initialFilters.sortOrder);

  // Estado de edición y eliminación
  const [editingTx, setEditingTx] = useState<FinanceTransactionWithCategory | null>(null);
  const [editType, setEditType] = useState<FinanceTransactionType>('expense');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingTx, setDeletingTx] = useState<FinanceTransactionWithCategory | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function buildUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (transactionType !== 'all') params.set('transactionType', transactionType);
    if (categoryId !== 'all') params.set('categoryId', categoryId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    params.set('page', String(targetPage));
    return `/transactions?${params.toString()}`;
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl(1));
  }

  function handleResetFilters() {
    setSearch('');
    setTransactionType('all');
    setCategoryId('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
    router.push('/transactions');
  }

  function openEdit(tx: FinanceTransactionWithCategory) {
    setEditingTx(tx);
    setEditType(tx.transaction_type);
    setEditCategoryId(tx.category_id);
    setEditAmount(Number(tx.amount).toString());
    setEditDate(tx.transaction_date);
    setEditDesc(tx.description);
    setEditNotes(tx.notes ?? '');
    setEditError(null);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTx) return;
    setEditError(null);

    startTransition(async () => {
      const res = await updateFinanceTransactionAction(editingTx.id, {
        categoryId: editCategoryId,
        transactionType: editType,
        amount: editAmount,
        transactionDate: editDate,
        description: editDesc,
        notes: editNotes,
      });

      if (!res.success) {
        setEditError(res.message);
        return;
      }

      setEditingTx(null);
      setFeedback(res.message);
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!deletingTx) return;
    startTransition(async () => {
      const res = await deleteFinanceTransactionAction(deletingTx.id);
      setDeletingTx(null);
      setFeedback(res.message);
      router.refresh();
    });
  }

  const editCategories = categories.filter((c) => c.kind === editType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          Historial de Movimientos Financieros
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Consulta, filtra, edita o elimina tus operaciones de ingresos y gastos (separado de tus compras/ventas de acciones para evitar duplicidades contables).
        </p>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="hist-search" className="block text-[11px] font-medium text-slate-400">
              Buscar por descripción
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                id="hist-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej. Supermercado, Sueldo..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hist-type" className="block text-[11px] font-medium text-slate-400">
              Tipo
            </label>
            <select
              id="hist-type"
              value={transactionType}
              onChange={(e) =>
                setTransactionType(e.target.value as 'all' | 'income' | 'expense')
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
          </div>

          <div>
            <label htmlFor="hist-category" className="block text-[11px] font-medium text-slate-400">
              Categoría
            </label>
            <select
              id="hist-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.kind === 'income' ? 'Ingreso' : 'Gasto'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hist-start" className="block text-[11px] font-medium text-slate-400">
              Desde fecha
            </label>
            <input
              id="hist-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label htmlFor="hist-end" className="block text-[11px] font-medium text-slate-400">
              Hasta fecha
            </label>
            <input
              id="hist-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-2">
            <label htmlFor="hist-sort" className="text-xs text-slate-400">
              Orden por fecha:
            </label>
            <select
              id="hist-sort"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
            >
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguos primero</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Aplicar filtros</span>
            </button>
          </div>
        </div>
      </form>

      {/* Tabla / Tarjetas de resultados */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
          <span>
            Total encontrados: <strong className="text-white">{totalCount}</strong> registro(s)
          </span>
          <span>
            Página <strong className="text-white">{page}</strong> de{' '}
            <strong className="text-white">{totalPages}</strong>
          </span>
        </div>

        {items.length === 0 ? (
          <div className="my-12 flex flex-col items-center justify-center text-center">
            <Receipt className="h-9 w-9 text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-300">
              No se encontraron movimientos con los filtros seleccionados
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Prueba cambiar los criterios de búsqueda o registra una nueva operación en Finanzas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Fecha</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Importe (USD)</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-3 whitespace-nowrap text-slate-300">
                      {formatDateISOToDisplay(tx.transaction_date)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          tx.transaction_type === 'income'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tx.transaction_type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-white">{tx.description}</p>
                      {tx.notes && (
                        <p className="text-[11px] text-slate-400 max-w-xs truncate">
                          {tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
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
                          onClick={() => openEdit(tx)}
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

        {/* Controles de paginación */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => router.push(buildUrl(page - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>
            <span className="text-xs text-slate-400">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl(page + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {editingTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Editar operación</h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditType('expense');
                    const first = categories.find((c) => c.kind === 'expense');
                    if (first) setEditCategoryId(first.id);
                  }}
                  className={`rounded-lg py-1.5 text-xs font-semibold ${
                    editType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditType('income');
                    const first = categories.find((c) => c.kind === 'income');
                    if (first) setEditCategoryId(first.id);
                  }}
                  className={`rounded-lg py-1.5 text-xs font-semibold ${
                    editType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Ingreso
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300">Importe (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300">Categoría *</label>
                <select
                  required
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {editCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300">Descripción *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300">Notas</label>
                <input
                  type="text"
                  maxLength={1000}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              {editError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingTx)}
        title="Eliminar operación financiera"
        description={
          deletingTx
            ? `¿Confirmas eliminar "${deletingTx.description}" (${formatCurrencyUSD(
                deletingTx.amount
              )})?`
            : ''
        }
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  );
}
