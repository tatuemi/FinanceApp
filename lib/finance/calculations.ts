import Decimal from 'decimal.js';
import type {
  FinanceCategoryRow,
  FinanceTransactionRow,
  FinanceTransactionType,
} from '@/types/database';

export interface MonthlyPeriodSummary {
  year: number;
  month: number; // 1..12
  periodLabel: string;
  incomeTotal: string; // NUMERIC(19,4)
  expenseTotal: string; // NUMERIC(19,4)
  netBalance: string; // Ingresos - Gastos
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
}

export interface MonthOverMonthComparison {
  current: MonthlyPeriodSummary;
  previous: MonthlyPeriodSummary;
  incomeChangePct: string | null;
  expenseChangePct: string | null;
  balanceDiff: string;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  kind: FinanceTransactionType;
  totalAmount: string;
  percentageOfKind: string; // 0..100
  transactionCount: number;
}

export interface DailyBalancePoint {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  income: number;
  expense: number;
  dailyNet: number;
  cumulativeBalance: number;
}

export interface FinanceDashboardMetrics {
  comparison: MonthOverMonthComparison;
  expenseByCategory: CategoryBreakdownItem[];
  incomeByCategory: CategoryBreakdownItem[];
  dailyEvolution: DailyBalancePoint[];
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function getMonthDateRange(year: number, month: number): {
  startDate: string;
  endDate: string;
  daysInMonth: number;
} {
  const safeMonth = Math.min(Math.max(Math.trunc(month), 1), 12);
  const safeYear = Math.trunc(year);
  const daysInMonth = new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();
  const mm = String(safeMonth).padStart(2, '0');
  const dd = String(daysInMonth).padStart(2, '0');
  return {
    startDate: `${safeYear}-${mm}-01`,
    endDate: `${safeYear}-${mm}-${dd}`,
    daysInMonth,
  };
}

export function getPreviousYearMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * Calcula el resumen mensual exacto:
 * Balance = Ingresos del período − Gastos del período
 */
export function calculateMonthlyPeriodSummary(
  transactions: Pick<
    FinanceTransactionRow,
    'transaction_type' | 'amount' | 'transaction_date'
  >[],
  year: number,
  month: number
): MonthlyPeriodSummary {
  const { startDate, endDate } = getMonthDateRange(year, month);
  let income = new Decimal(0);
  let expense = new Decimal(0);
  let incomeCount = 0;
  let expenseCount = 0;

  for (const tx of transactions) {
    if (tx.transaction_date < startDate || tx.transaction_date > endDate) {
      continue;
    }
    const amt = new Decimal(tx.amount);
    if (tx.transaction_type === 'income') {
      income = income.plus(amt);
      incomeCount += 1;
    } else if (tx.transaction_type === 'expense') {
      expense = expense.plus(amt);
      expenseCount += 1;
    }
  }

  const netBalance = income.minus(expense);
  const monthName = MONTH_NAMES_ES[month - 1] ?? String(month);

  return {
    year,
    month,
    periodLabel: `${monthName} ${year}`,
    incomeTotal: income.toFixed(4),
    expenseTotal: expense.toFixed(4),
    netBalance: netBalance.toFixed(4),
    transactionCount: incomeCount + expenseCount,
    incomeCount,
    expenseCount,
  };
}

/**
 * Calcula el desglose por categoría para un tipo específico ('income' o 'expense').
 */
export function calculateCategoryBreakdown(
  transactions: Pick<
    FinanceTransactionRow,
    'category_id' | 'transaction_type' | 'amount' | 'transaction_date'
  >[],
  categories: Pick<FinanceCategoryRow, 'id' | 'name' | 'color' | 'icon' | 'kind'>[],
  kind: FinanceTransactionType,
  year: number,
  month: number
): CategoryBreakdownItem[] {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const categoryMap = new Map<string, Pick<FinanceCategoryRow, 'id' | 'name' | 'color' | 'icon' | 'kind'>>();
  for (const cat of categories) {
    categoryMap.set(String(cat.id), cat);
  }

  const totalsByCategory = new Map<string, { amount: Decimal; count: number }>();
  let grandTotal = new Decimal(0);

  for (const tx of transactions) {
    if (tx.transaction_type !== kind) continue;
    if (tx.transaction_date < startDate || tx.transaction_date > endDate) continue;

    const catId = String(tx.category_id);
    const amt = new Decimal(tx.amount);
    grandTotal = grandTotal.plus(amt);

    const existing = totalsByCategory.get(catId);
    if (existing) {
      existing.amount = existing.amount.plus(amt);
      existing.count += 1;
    } else {
      totalsByCategory.set(catId, { amount: amt, count: 1 });
    }
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [catId, data] of totalsByCategory.entries()) {
    const cat = categoryMap.get(catId);
    const pct = grandTotal.greaterThan(0)
      ? data.amount.div(grandTotal).mul(100).toFixed(2)
      : '0.00';

    items.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Sin categoría',
      color: cat?.color ?? '#64748b',
      icon: cat?.icon ?? 'tag',
      kind,
      totalAmount: data.amount.toFixed(4),
      percentageOfKind: pct,
      transactionCount: data.count,
    });
  }

  items.sort((a, b) => new Decimal(b.totalAmount).cmp(new Decimal(a.totalAmount)));
  return items;
}

/**
 * Calcula la evolución diaria y acumulada del balance durante el mes seleccionado.
 */
export function calculateDailyBalanceEvolution(
  transactions: Pick<
    FinanceTransactionRow,
    'transaction_type' | 'amount' | 'transaction_date'
  >[],
  year: number,
  month: number
): DailyBalancePoint[] {
  const { startDate, endDate, daysInMonth } = getMonthDateRange(year, month);
  const dailyMap = new Map<string, { income: Decimal; expense: Decimal }>();

  const mm = String(month).padStart(2, '0');
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0');
    dailyMap.set(`${year}-${mm}-${dd}`, {
      income: new Decimal(0),
      expense: new Decimal(0),
    });
  }

  for (const tx of transactions) {
    if (tx.transaction_date < startDate || tx.transaction_date > endDate) continue;
    const entry = dailyMap.get(tx.transaction_date);
    if (!entry) continue;
    const amt = new Decimal(tx.amount);
    if (tx.transaction_type === 'income') {
      entry.income = entry.income.plus(amt);
    } else {
      entry.expense = entry.expense.plus(amt);
    }
  }

  const points: DailyBalancePoint[] = [];
  let runningBalance = new Decimal(0);

  for (const [date, values] of dailyMap.entries()) {
    const dailyNet = values.income.minus(values.expense);
    runningBalance = runningBalance.plus(dailyNet);
    const dayNum = date.slice(8, 10);

    points.push({
      date,
      dayLabel: `${Number(dayNum)}/${mm}`,
      income: values.income.toDP(2).toNumber(),
      expense: values.expense.toDP(2).toNumber(),
      dailyNet: dailyNet.toDP(2).toNumber(),
      cumulativeBalance: runningBalance.toDP(2).toNumber(),
    });
  }

  return points;
}

/**
 * Calcula todos los indicadores del dashboard financiero incluyendo comparativa con el mes anterior.
 */
export function buildFinanceDashboardMetrics(
  transactions: Pick<
    FinanceTransactionRow,
    'category_id' | 'transaction_type' | 'amount' | 'transaction_date'
  >[],
  categories: Pick<FinanceCategoryRow, 'id' | 'name' | 'color' | 'icon' | 'kind'>[],
  year: number,
  month: number
): FinanceDashboardMetrics {
  const current = calculateMonthlyPeriodSummary(transactions, year, month);
  const prevPeriod = getPreviousYearMonth(year, month);
  const previous = calculateMonthlyPeriodSummary(transactions, prevPeriod.year, prevPeriod.month);

  const curIncome = new Decimal(current.incomeTotal);
  const prevIncome = new Decimal(previous.incomeTotal);
  const curExpense = new Decimal(current.expenseTotal);
  const prevExpense = new Decimal(previous.expenseTotal);
  const curBalance = new Decimal(current.netBalance);
  const prevBalance = new Decimal(previous.netBalance);

  const incomeChangePct = prevIncome.greaterThan(0)
    ? curIncome.minus(prevIncome).div(prevIncome).mul(100).toFixed(2)
    : null;

  const expenseChangePct = prevExpense.greaterThan(0)
    ? curExpense.minus(prevExpense).div(prevExpense).mul(100).toFixed(2)
    : null;

  const balanceDiff = curBalance.minus(prevBalance).toFixed(4);

  return {
    comparison: {
      current,
      previous,
      incomeChangePct,
      expenseChangePct,
      balanceDiff,
    },
    expenseByCategory: calculateCategoryBreakdown(transactions, categories, 'expense', year, month),
    incomeByCategory: calculateCategoryBreakdown(transactions, categories, 'income', year, month),
    dailyEvolution: calculateDailyBalanceEvolution(transactions, year, month),
  };
}
