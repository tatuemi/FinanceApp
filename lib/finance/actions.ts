'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  financeCategorySchema,
  financeTransactionSchema,
  profileUpdateSchema,
  type FinanceCategoryInput,
  type FinanceTransactionInput,
  type ProfileUpdateInput,
} from '@/lib/validations/finance';
import { normalizeEntityId } from '@/lib/utils/format';
import type { FinanceCategoryRow, FinanceTransactionRow } from '@/types/database';

export interface ActionResult<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
}

function revalidateFinancePaths() {
  revalidatePath('/dashboard');
  revalidatePath('/finances');
  revalidatePath('/transactions');
  revalidatePath('/settings');
}

export async function createFinanceCategoryAction(
  rawInput: FinanceCategoryInput
): Promise<ActionResult<FinanceCategoryRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = financeCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de categoría inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createServerSupabaseClient();
  const { name, kind, color, icon } = parsed.data;

  // Verificar duplicado insensible a mayúsculas/minúsculas dentro del mismo usuario y tipo
  const { data: existing } = await supabase
    .from('finance_categories')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('kind', kind)
    .ilike('name', name);

  if (existing && existing.length > 0) {
    const exactMatch = existing.some(
      (c) => (c as { name: string }).name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (exactMatch) {
      return {
        success: false,
        message: `Ya existe una categoría de ${kind === 'income' ? 'ingresos' : 'gastos'} llamada "${name}".`,
        code: 'DUPLICATE_CATEGORY',
      };
    }
  }

  const { data, error } = await supabase
    .from('finance_categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      kind,
      color,
      icon,
    } as never)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        message: `Ya existe una categoría con ese nombre en ${kind === 'income' ? 'ingresos' : 'gastos'}.`,
        code: 'DUPLICATE_CATEGORY',
      };
    }
    return {
      success: false,
      message: 'No se pudo guardar la categoría. Intenta nuevamente.',
      code: 'DB_ERROR',
    };
  }

  const created = data as FinanceCategoryRow;
  revalidateFinancePaths();

  return {
    success: true,
    message: 'Categoría creada correctamente.',
    data: { ...created, id: String(created.id) },
  };
}

export async function updateFinanceCategoryAction(
  categoryId: string,
  rawInput: FinanceCategoryInput
): Promise<ActionResult<FinanceCategoryRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(categoryId);
  } catch {
    return { success: false, message: 'Identificador de categoría inválido.', code: 'INVALID_ID' };
  }

  const parsed = financeCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de categoría inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createServerSupabaseClient();
  const { name, kind, color, icon } = parsed.data;

  // Verificar categoría actual del usuario
  const { data: currentCat } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('id', safeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!currentCat) {
    return { success: false, message: 'La categoría no existe o no tienes permiso.', code: 'NOT_FOUND' };
  }

  const existingCat = currentCat as FinanceCategoryRow;
  if (existingCat.kind !== kind) {
    // Comprobar si tiene operaciones asociadas antes de cambiar el tipo
    const { count } = await supabase
      .from('finance_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('category_id', safeId);

    if ((count ?? 0) > 0) {
      return {
        success: false,
        message:
          'No se puede cambiar el tipo (ingreso/gasto) de una categoría que ya tiene operaciones registradas.',
        code: 'CATEGORY_IN_USE',
      };
    }
  }

  const { data, error } = await supabase
    .from('finance_categories')
    .update({
      name: name.trim(),
      kind,
      color,
      icon,
    } as never)
    .eq('id', safeId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        message: 'Ya existe otra categoría con ese nombre en el mismo tipo.',
        code: 'DUPLICATE_CATEGORY',
      };
    }
    return {
      success: false,
      message: 'No se pudo actualizar la categoría.',
      code: 'DB_ERROR',
    };
  }

  const updated = data as FinanceCategoryRow;
  revalidateFinancePaths();

  return {
    success: true,
    message: 'Categoría actualizada correctamente.',
    data: { ...updated, id: String(updated.id) },
  };
}

/**
 * Elimina una categoría personalizada.
 * Si tiene operaciones asociadas, exige `reassignToCategoryId` del mismo tipo
 * para no perder registros silenciosamente (Sección 5.2.B).
 */
export async function deleteFinanceCategoryAction(
  categoryId: string,
  reassignToCategoryId?: string
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(categoryId);
  } catch {
    return { success: false, message: 'Identificador de categoría inválido.', code: 'INVALID_ID' };
  }

  const supabase = await createServerSupabaseClient();

  const { data: catData } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('id', safeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!catData) {
    return { success: false, message: 'Categoría no encontrada.', code: 'NOT_FOUND' };
  }

  const category = catData as FinanceCategoryRow;

  const { count } = await supabase
    .from('finance_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('category_id', safeId);

  const txCount = count ?? 0;

  if (txCount > 0) {
    if (!reassignToCategoryId) {
      return {
        success: false,
        message: `Esta categoría tiene ${txCount} operación(es) registrada(s). Selecciona una categoría destino para reasignarlas antes de eliminarla.`,
        code: 'REASSIGNMENT_REQUIRED',
      };
    }

    let safeTargetId: string;
    try {
      safeTargetId = normalizeEntityId(reassignToCategoryId);
    } catch {
      return { success: false, message: 'Categoría de reasignación inválida.', code: 'INVALID_TARGET' };
    }

    if (safeTargetId === safeId) {
      return {
        success: false,
        message: 'La categoría de destino debe ser distinta a la categoría que deseas eliminar.',
        code: 'INVALID_TARGET',
      };
    }

    const { data: targetCatData } = await supabase
      .from('finance_categories')
      .select('*')
      .eq('id', safeTargetId)
      .eq('user_id', user.id)
      .maybeSingle();

    const targetCat = targetCatData as FinanceCategoryRow | null;
    if (!targetCat || targetCat.kind !== category.kind) {
      return {
        success: false,
        message: 'La categoría destino debe pertenecer a tu cuenta y ser del mismo tipo (ingreso o gasto).',
        code: 'INVALID_TARGET_KIND',
      };
    }

    const { error: reassignError } = await supabase
      .from('finance_transactions')
      .update({ category_id: safeTargetId } as never)
      .eq('user_id', user.id)
      .eq('category_id', safeId);

    if (reassignError) {
      return {
        success: false,
        message: 'No se pudieron reasignar las operaciones asociadas.',
        code: 'REASSIGN_FAILED',
      };
    }
  }

  const { error: deleteError } = await supabase
    .from('finance_categories')
    .delete()
    .eq('id', safeId)
    .eq('user_id', user.id);

  if (deleteError) {
    return {
      success: false,
      message: 'No se pudo eliminar la categoría.',
      code: 'DB_ERROR',
    };
  }

  revalidateFinancePaths();
  return {
    success: true,
    message:
      txCount > 0
        ? `Categoría eliminada y ${txCount} operación(es) reasignada(s) correctamente.`
        : 'Categoría eliminada correctamente.',
  };
}

export async function createFinanceTransactionAction(
  rawInput: FinanceTransactionInput
): Promise<ActionResult<FinanceTransactionRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = financeTransactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de la operación inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { categoryId, transactionType, amount, transactionDate, description, notes } = parsed.data;
  const supabase = await createServerSupabaseClient();

  // Verificar que la categoría pertenezca al usuario y coincida con el tipo de operación (Sección 5.2.A)
  const { data: catData } = await supabase
    .from('finance_categories')
    .select('id, kind, name')
    .eq('id', categoryId)
    .eq('user_id', user.id)
    .maybeSingle();

  const category = catData as Pick<FinanceCategoryRow, 'id' | 'kind' | 'name'> | null;
  if (!category) {
    return {
      success: false,
      message: 'La categoría seleccionada no existe o no pertenece a tu cuenta.',
      code: 'CATEGORY_NOT_FOUND',
    };
  }

  if (category.kind !== transactionType) {
    return {
      success: false,
      message: `No se puede asociar una categoría de ${
        category.kind === 'expense' ? 'gasto' : 'ingreso'
      } ("${category.name}") a una operación de ${
        transactionType === 'income' ? 'ingreso' : 'gasto'
      }.`,
      code: 'CATEGORY_TYPE_MISMATCH',
    };
  }

  const { data, error } = await supabase
    .from('finance_transactions')
    .insert({
      user_id: user.id,
      category_id: categoryId,
      transaction_type: transactionType,
      amount,
      currency: 'USD',
      transaction_date: transactionDate,
      description,
      notes,
    } as never)
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      message: 'No se pudo registrar la operación financiera en PostgreSQL.',
      code: 'DB_ERROR',
    };
  }

  const created = data as FinanceTransactionRow;
  revalidateFinancePaths();

  return {
    success: true,
    message: `${transactionType === 'income' ? 'Ingreso' : 'Gasto'} registrado correctamente.`,
    data: {
      ...created,
      id: String(created.id),
      category_id: String(created.category_id),
      amount: String(created.amount),
    },
  };
}

export async function updateFinanceTransactionAction(
  transactionId: string,
  rawInput: FinanceTransactionInput
): Promise<ActionResult<FinanceTransactionRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(transactionId);
  } catch {
    return { success: false, message: 'Identificador de operación inválido.', code: 'INVALID_ID' };
  }

  const parsed = financeTransactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de la operación inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { categoryId, transactionType, amount, transactionDate, description, notes } = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data: catData } = await supabase
    .from('finance_categories')
    .select('id, kind, name')
    .eq('id', categoryId)
    .eq('user_id', user.id)
    .maybeSingle();

  const category = catData as Pick<FinanceCategoryRow, 'id' | 'kind' | 'name'> | null;
  if (!category) {
    return {
      success: false,
      message: 'La categoría seleccionada no existe.',
      code: 'CATEGORY_NOT_FOUND',
    };
  }

  if (category.kind !== transactionType) {
    return {
      success: false,
      message: `No puedes asociar una categoría de ${
        category.kind === 'expense' ? 'gasto' : 'ingreso'
      } a una operación de ${transactionType === 'income' ? 'ingreso' : 'gasto'}.`,
      code: 'CATEGORY_TYPE_MISMATCH',
    };
  }

  const { data, error } = await supabase
    .from('finance_transactions')
    .update({
      category_id: categoryId,
      transaction_type: transactionType,
      amount,
      transaction_date: transactionDate,
      description,
      notes,
    } as never)
    .eq('id', safeId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      message: 'No se pudo actualizar la operación financiera.',
      code: 'DB_ERROR',
    };
  }

  const updated = data as FinanceTransactionRow;
  revalidateFinancePaths();

  return {
    success: true,
    message: 'Operación actualizada correctamente.',
    data: {
      ...updated,
      id: String(updated.id),
      category_id: String(updated.category_id),
      amount: String(updated.amount),
    },
  };
}

export async function deleteFinanceTransactionAction(
  transactionId: string
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(transactionId);
  } catch {
    return { success: false, message: 'Identificador de operación inválido.', code: 'INVALID_ID' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('finance_transactions')
    .delete()
    .eq('id', safeId)
    .eq('user_id', user.id);

  if (error) {
    return {
      success: false,
      message: 'No se pudo eliminar la operación.',
      code: 'DB_ERROR',
    };
  }

  revalidateFinancePaths();
  return {
    success: true,
    message: 'Operación eliminada correctamente.',
  };
}

export async function updateUserProfileAction(
  rawInput: ProfileUpdateInput
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = profileUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de perfil inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      base_currency: 'USD',
    } as never)
    .eq('user_id', user.id);

  if (error) {
    return {
      success: false,
      message: 'No se pudo actualizar el perfil.',
      code: 'DB_ERROR',
    };
  }

  revalidateFinancePaths();
  return {
    success: true,
    message: 'Perfil actualizado correctamente.',
  };
}
