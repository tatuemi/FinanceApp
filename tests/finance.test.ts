import { describe, it, expect } from 'vitest';
import {
  financeCategorySchema,
  financeTransactionSchema,
  financeHistoryFilterSchema,
} from '@/lib/validations/finance';
import {
  calculateMonthlyPeriodSummary,
  calculateCategoryBreakdown,
  calculateDailyBalanceEvolution,
  buildFinanceDashboardMetrics,
} from '@/lib/finance/calculations';
import type { FinanceCategoryRow, FinanceTransactionRow } from '@/types/database';

describe('Fase 5: Validaciones y Cálculos del Módulo de Finanzas Personales', () => {
  it('valida categorías personalizadas y rechaza nombres vacíos o colores/iconos inválidos', () => {
    const valid = financeCategorySchema.safeParse({
      name: '  Supermercado  ',
      kind: 'expense',
      color: '#10b981',
      icon: 'utensils',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.name).toBe('Supermercado');
    }

    const emptyName = financeCategorySchema.safeParse({
      name: '   ',
      kind: 'expense',
      color: '#10b981',
      icon: 'utensils',
    });
    expect(emptyName.success).toBe(false);

    const invalidIcon = financeCategorySchema.safeParse({
      name: 'Válido',
      kind: 'income',
      color: '#10b981',
      icon: 'icono-inexistente',
    });
    expect(invalidIcon.success).toBe(false);

    const invalidColor = financeCategorySchema.safeParse({
      name: 'Válido',
      kind: 'income',
      color: 'red',
      icon: 'wallet',
    });
    expect(invalidColor.success).toBe(false);
  });

  it('valida operaciones de ingresos y gastos con precisión NUMERIC(19,4) y rechaza importes <= 0', () => {
    const validTx = financeTransactionSchema.safeParse({
      categoryId: '15',
      transactionType: 'expense',
      amount: '49.95',
      transactionDate: '2026-10-15',
      description: 'Compra mensual de despensa',
      notes: 'Supermercado local',
    });
    expect(validTx.success).toBe(true);
    if (validTx.success) {
      expect(validTx.data.amount).toBe('49.9500');
    }

    const negativeAmount = financeTransactionSchema.safeParse({
      categoryId: '15',
      transactionType: 'expense',
      amount: '-10.00',
      transactionDate: '2026-10-15',
      description: 'Importe negativo',
    });
    expect(negativeAmount.success).toBe(false);

    const zeroAmount = financeTransactionSchema.safeParse({
      categoryId: '15',
      transactionType: 'income',
      amount: '0',
      transactionDate: '2026-10-15',
      description: 'Importe cero',
    });
    expect(zeroAmount.success).toBe(false);

    const invalidDate = financeTransactionSchema.safeParse({
      categoryId: '15',
      transactionType: 'income',
      amount: '100.00',
      transactionDate: '2026-02-30', // 30 de febrero no existe
      description: 'Fecha inexistente',
    });
    expect(invalidDate.success).toBe(false);
  });

  it('calcula balances mensuales exactos, desgloses por categoría y comparativa intermensual', () => {
    const categories: Pick<FinanceCategoryRow, 'id' | 'name' | 'color' | 'icon' | 'kind'>[] = [
      { id: '1', name: 'Sueldo', kind: 'income', color: '#10b981', icon: 'briefcase' },
      { id: '2', name: 'Freelance', kind: 'income', color: '#06b6d4', icon: 'laptop' },
      { id: '3', name: 'Alimentación', kind: 'expense', color: '#f59e0b', icon: 'utensils' },
      { id: '4', name: 'Servicios', kind: 'expense', color: '#6366f1', icon: 'zap' },
    ];

    const transactions: Pick<
      FinanceTransactionRow,
      'category_id' | 'transaction_type' | 'amount' | 'transaction_date'
    >[] = [
      // Septiembre 2026 (mes anterior)
      {
        category_id: '1',
        transaction_type: 'income',
        amount: '3000.0000',
        transaction_date: '2026-09-05',
      },
      {
        category_id: '3',
        transaction_type: 'expense',
        amount: '1000.0000',
        transaction_date: '2026-09-15',
      },
      // Octubre 2026 (mes actual) — prueba de precisión decimal (0.1 + 0.2 = 0.3 exacto)
      {
        category_id: '1',
        transaction_type: 'income',
        amount: '3200.1000',
        transaction_date: '2026-10-01',
      },
      {
        category_id: '2',
        transaction_type: 'income',
        amount: '400.2000',
        transaction_date: '2026-10-12',
      },
      {
        category_id: '3',
        transaction_type: 'expense',
        amount: '600.0500',
        transaction_date: '2026-10-08',
      },
      {
        category_id: '4',
        transaction_type: 'expense',
        amount: '200.2500',
        transaction_date: '2026-10-20',
      },
    ];

    const summaryOct = calculateMonthlyPeriodSummary(transactions, 2026, 10);
    expect(summaryOct.incomeTotal).toBe('3600.3000');
    expect(summaryOct.expenseTotal).toBe('800.3000');
    expect(summaryOct.netBalance).toBe('2800.0000');
    expect(summaryOct.transactionCount).toBe(4);

    const expenseBreakdown = calculateCategoryBreakdown(
      transactions,
      categories,
      'expense',
      2026,
      10
    );
    expect(expenseBreakdown.length).toBe(2);
    expect(expenseBreakdown[0]?.categoryName).toBe('Alimentación');
    expect(expenseBreakdown[0]?.totalAmount).toBe('600.0500');

    const dailyPoints = calculateDailyBalanceEvolution(transactions, 2026, 10);
    expect(dailyPoints.length).toBe(31);
    expect(dailyPoints[30]?.cumulativeBalance).toBe(2800);

    const dashboardMetrics = buildFinanceDashboardMetrics(transactions, categories, 2026, 10);
    expect(dashboardMetrics.comparison.previous.netBalance).toBe('2000.0000');
    expect(dashboardMetrics.comparison.balanceDiff).toBe('800.0000');
    expect(dashboardMetrics.comparison.incomeChangePct).toBe('20.01');

    const filterParsed = financeHistoryFilterSchema.safeParse({
      search: 'despensa',
      transactionType: 'expense',
      page: '2',
    });
    expect(filterParsed.success).toBe(true);
    if (filterParsed.success) {
      expect(filterParsed.data.page).toBe(2);
    }
  });
});
