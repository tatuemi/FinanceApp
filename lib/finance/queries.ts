import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser, ensureUserProfileForUser } from '@/lib/auth/session';
import type {
  FinanceCategoryRow,
  FinanceTransactionRow,
  FinanceTransactionWithCategory,
} from '@/types/database';
import {
  buildFinanceDashboardMetrics,
  getMonthDateRange,
  getPreviousYearMonth,
  type FinanceDashboardMetrics,
} from './calculations';
import {
  financeHistoryFilterSchema,
  type FinanceHistoryFilterInput,
} from '@/lib/validations/finance';

export interface FinanceDashboardData {
  year: number;
  month: number;
  categories: FinanceCategoryRow[];
  metrics: FinanceDashboardMetrics;
  recentTransactions: FinanceTransactionWithCategory[];
}

export interface PaginatedFinanceHistory {
  items: FinanceTransactionWithCategory[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: FinanceCategoryRow[];
}

function normalizeCategoryRow(row: FinanceCategoryRow): FinanceCategoryRow {
  return {
    ...row,
    id: String(row.id),
  };
}

function normalizeTransactionRow(
  row: FinanceTransactionRow,
  categoryMap?: Map<string, FinanceCategoryRow>
): FinanceTransactionWithCategory {
  const catId = String(row.category_id);
  const cat = categoryMap?.get(catId) ?? null;
  return {
    ...row,
    id: String(row.id),
    category_id: catId,
    amount: String(row.amount),
    category: cat
      ? {
          id: cat.id,
          name: cat.name,
          kind: cat.kind,
          color: cat.color,
          icon: cat.icon,
        }
      : null,
  };
}

export async function getUserFinanceCategories(): Promise<FinanceCategoryRow[]> {
  const user = await requireAuthenticatedUser();
  await ensureUserProfileForUser(user);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('kind', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as FinanceCategoryRow[]).map(normalizeCategoryRow);
}

export async function getFinanceDashboardData(
  year?: number,
  month?: number
): Promise<FinanceDashboardData> {
  const user = await requireAuthenticatedUser();
  await ensureUserProfileForUser(user);
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const targetYear =
    year && Number.isFinite(year) && year >= 2000 && year <= 2100
      ? Math.trunc(year)
      : now.getFullYear();
  const targetMonth =
    month && Number.isFinite(month) && month >= 1 && month <= 12
      ? Math.trunc(month)
      : now.getMonth() + 1;

  const prev = getPreviousYearMonth(targetYear, targetMonth);
  const prevRange = getMonthDateRange(prev.year, prev.month);
  const currRange = getMonthDateRange(targetYear, targetMonth);

  const [catRes, txRes] = await Promise.all([
    supabase
      .from('finance_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('kind', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('finance_transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('transaction_date', prevRange.startDate)
      .lte('transaction_date', currRange.endDate)
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: false }),
  ]);

  const categories = ((catRes.data ?? []) as FinanceCategoryRow[]).map(normalizeCategoryRow);
  const categoryMap = new Map<string, FinanceCategoryRow>(
    categories.map((c) => [c.id, c])
  );

  const allTwoMonthsTxs = ((txRes.data ?? []) as FinanceTransactionRow[]).map((tx) =>
    normalizeTransactionRow(tx, categoryMap)
  );

  const metrics = buildFinanceDashboardMetrics(
    allTwoMonthsTxs,
    categories,
    targetYear,
    targetMonth
  );

  const recentTransactions = allTwoMonthsTxs
    .filter(
      (tx) =>
        tx.transaction_date >= currRange.startDate &&
        tx.transaction_date <= currRange.endDate
    )
    .slice(0, 10);

  return {
    year: targetYear,
    month: targetMonth,
    categories,
    metrics,
    recentTransactions,
  };
}

export async function getPaginatedFinanceTransactions(
  rawFilters: Partial<FinanceHistoryFilterInput>
): Promise<PaginatedFinanceHistory> {
  const user = await requireAuthenticatedUser();
  await ensureUserProfileForUser(user);
  const supabase = await createServerSupabaseClient();

  const parsed = financeHistoryFilterSchema.safeParse(rawFilters);
  const filters: FinanceHistoryFilterInput = parsed.success
    ? parsed.data
    : {
        search: '',
        transactionType: 'all',
        categoryId: 'all',
        startDate: '',
        endDate: '',
        sortOrder: 'desc',
        page: 1,
        pageSize: 15,
      };

  const categories = await getUserFinanceCategories();
  const categoryMap = new Map<string, FinanceCategoryRow>(
    categories.map((c) => [c.id, c])
  );

  let query = supabase
    .from('finance_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id);

  if (filters.transactionType !== 'all') {
    query = query.eq('transaction_type', filters.transactionType);
  }

  if (filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters.startDate) {
    query = query.gte('transaction_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('transaction_date', filters.endDate);
  }

  if (filters.search) {
    const cleanSearch = filters.search.replace(/[%_]/g, '').trim();
    if (cleanSearch.length > 0) {
      query = query.ilike('description', `%${cleanSearch}%`);
    }
  }

  const ascending = filters.sortOrder === 'asc';
  const offset = (filters.page - 1) * filters.pageSize;

  const { data, count, error } = await query
    .order('transaction_date', { ascending })
    .order('id', { ascending })
    .range(offset, offset + filters.pageSize - 1);

  if (error || !data) {
    return {
      items: [],
      totalCount: 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: 1,
      categories,
    };
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const items = (data as FinanceTransactionRow[]).map((tx) =>
    normalizeTransactionRow(tx, categoryMap)
  );

  return {
    items,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
    categories,
  };
}
