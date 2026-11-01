'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  investmentAssetSchema,
  investmentTransactionSchema,
  manualQuoteSchema,
  type InvestmentAssetInput,
  type InvestmentTransactionRawInput,
  type ManualQuoteInput,
} from '@/lib/validations/investments';
import { processAssetTransactionsChronologically } from './calculations';
import { resolveMarketDataProvider } from '@/lib/market-data/providers';
import { normalizeEntityId } from '@/lib/utils/format';
import type {
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionRow,
} from '@/types/database';
import type { ActionResult } from '@/lib/finance/actions';

function revalidateInvestmentPaths() {
  revalidatePath('/dashboard');
  revalidatePath('/portfolio');
  revalidatePath('/assets');
  revalidatePath('/investments');
}

/**
 * Intenta obtener y guardar en caché la cotización actual automáticamente desde el proveedor
 * gratuito configurado (Twelve Data o Finnhub) al crear un activo o registrar una operación.
 * Si el proveedor no está configurado o alcanza el límite de peticiones, falla silenciosamente
 * sin interrumpir el registro contable.
 */
async function tryAutoFetchAssetQuote(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  assetId: string;
  symbol: string;
  providerSymbol?: string | null;
}): Promise<void> {
  try {
    const provider = resolveMarketDataProvider();
    if (!provider.isConfigured) return;

    const querySymbol = (params.providerSymbol ?? params.symbol).trim().toUpperCase();
    const freshQuote = await provider.getQuote(querySymbol);

    await params.supabase.from('investment_quote_cache').upsert(
      {
        user_id: params.userId,
        asset_id: params.assetId,
        price: freshQuote.price,
        currency: 'USD',
        provider: freshQuote.provider,
        market_time: freshQuote.marketTime,
        fetched_at: freshQuote.fetchedAt,
      } as never,
      { onConflict: 'asset_id,user_id' }
    );
  } catch {
    // Falla de forma no bloqueante si no hay cuota o red
  }
}

export async function createInvestmentAssetAction(
  rawInput: InvestmentAssetInput
): Promise<ActionResult<InvestmentAssetRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = investmentAssetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos del activo inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { symbol, name, assetType, exchange, providerSymbol } = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('investment_assets')
    .insert({
      user_id: user.id,
      symbol,
      name,
      asset_type: assetType,
      exchange,
      provider_symbol: providerSymbol ?? symbol,
      currency: 'USD',
    } as never)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        message: `El activo con símbolo "${symbol}" ya está registrado en tu portafolio.`,
        code: 'DUPLICATE_ASSET',
      };
    }
    return {
      success: false,
      message: 'No se pudo registrar el activo en PostgreSQL.',
      code: 'DB_ERROR',
    };
  }

  const created = data as InvestmentAssetRow;
  await tryAutoFetchAssetQuote({
    supabase,
    userId: user.id,
    assetId: String(created.id),
    symbol: created.symbol,
    providerSymbol: created.provider_symbol,
  });
  revalidateInvestmentPaths();

  return {
    success: true,
    message: `Activo ${created.symbol} (${created.name}) registrado correctamente.`,
    data: { ...created, id: String(created.id) },
  };
}

export async function updateInvestmentAssetAction(
  assetId: string,
  rawInput: InvestmentAssetInput
): Promise<ActionResult<InvestmentAssetRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(assetId);
  } catch {
    return { success: false, message: 'Identificador de activo inválido.', code: 'INVALID_ID' };
  }

  const parsed = investmentAssetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos del activo inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { symbol, name, assetType, exchange, providerSymbol } = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('investment_assets')
    .update({
      symbol,
      name,
      asset_type: assetType,
      exchange,
      provider_symbol: providerSymbol ?? symbol,
    } as never)
    .eq('id', safeId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        message: `Ya tienes otro activo registrado con el símbolo "${symbol}".`,
        code: 'DUPLICATE_ASSET',
      };
    }
    return {
      success: false,
      message: 'No se pudo actualizar el activo.',
      code: 'DB_ERROR',
    };
  }

  const updated = data as InvestmentAssetRow;
  revalidateInvestmentPaths();

  return {
    success: true,
    message: `Activo ${updated.symbol} actualizado correctamente.`,
    data: { ...updated, id: String(updated.id) },
  };
}

export async function deleteInvestmentAssetAction(assetId: string): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  let safeId: string;
  try {
    safeId = normalizeEntityId(assetId);
  } catch {
    return { success: false, message: 'Identificador de activo inválido.', code: 'INVALID_ID' };
  }

  const supabase = await createServerSupabaseClient();

  const { count } = await supabase
    .from('investment_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('asset_id', safeId);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: `Este activo tiene ${count} operación(es) de compra/venta registrada(s). Elimina primero sus operaciones si deseas borrar el activo.`,
      code: 'ASSET_HAS_TRANSACTIONS',
    };
  }

  const { error } = await supabase
    .from('investment_assets')
    .delete()
    .eq('id', safeId)
    .eq('user_id', user.id);

  if (error) {
    return {
      success: false,
      message: 'No se pudo eliminar el activo.',
      code: 'DB_ERROR',
    };
  }

  revalidateInvestmentPaths();
  return {
    success: true,
    message: 'Activo eliminado del portafolio.',
  };
}

/**
 * Registra una compra o venta de acciones/ETF.
 * Valida la consistencia cronológica del libro mayor tanto en la capa de dominio
 * como mediante el trigger de PostgreSQL `validate_investment_ledger_consistency`.
 */
export async function createInvestmentTransactionAction(
  rawInput: InvestmentTransactionRawInput
): Promise<ActionResult<InvestmentTransactionRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = investmentTransactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de la operación bursátil inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { assetId, transactionType, tradeDate, quantity, pricePerShare, fees, notes } =
    parsed.data;

  const supabase = await createServerSupabaseClient();

  // Verificar que el activo pertenezca al usuario
  const { data: assetData } = await supabase
    .from('investment_assets')
    .select('id, symbol, provider_symbol')
    .eq('id', assetId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!assetData) {
    return {
      success: false,
      message: 'El activo seleccionado no existe o no pertenece a tu cuenta.',
      code: 'ASSET_NOT_FOUND',
    };
  }

  const assetInfo = assetData as Pick<
    InvestmentAssetRow,
    'id' | 'symbol' | 'provider_symbol'
  >;

  // Pre-validación cronológica del historial del activo antes de insertar
  const { data: existingTxsData } = await supabase
    .from('investment_transactions')
    .select('id, trade_date, transaction_type, quantity, price_per_share, fees')
    .eq('user_id', user.id)
    .eq('asset_id', assetId);

  const existingTxs = (existingTxsData ?? []) as Pick<
    InvestmentTransactionRow,
    'id' | 'trade_date' | 'transaction_type' | 'quantity' | 'price_per_share' | 'fees'
  >[];

  const simulatedLedger = processAssetTransactionsChronologically([
    ...existingTxs.map((t) => ({ ...t, id: String(t.id) })),
    {
      id: '9223372036854775807', // Simula el nuevo registro al final de la misma fecha
      trade_date: tradeDate,
      transaction_type: transactionType,
      quantity,
      price_per_share: pricePerShare,
      fees,
    },
  ]);

  if (!simulatedLedger.valid) {
    return {
      success: false,
      message:
        simulatedLedger.errorMessage ??
        'No tienes títulos suficientes en la fecha indicada para realizar esta venta.',
      code: 'INSUFFICIENT_SHARES',
    };
  }

  const { data, error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: user.id,
      asset_id: assetId,
      transaction_type: transactionType,
      trade_date: tradeDate,
      quantity,
      price_per_share: pricePerShare,
      fees,
      currency: 'USD',
      notes,
    } as never)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.message?.includes('INSUFFICIENT_SHARES')) {
      return {
        success: false,
        message:
          'Operación rechazada por PostgreSQL: la venta excede la cantidad de títulos disponibles en esa fecha.',
        code: 'INSUFFICIENT_SHARES',
      };
    }
    return {
      success: false,
      message: 'No se pudo registrar la operación bursátil.',
      code: 'DB_ERROR',
    };
  }

  const created = data as InvestmentTransactionRow;
  await tryAutoFetchAssetQuote({
    supabase,
    userId: user.id,
    assetId,
    symbol: assetInfo.symbol,
    providerSymbol: assetInfo.provider_symbol,
  });
  revalidateInvestmentPaths();

  return {
    success: true,
    message: `Operación de ${transactionType === 'buy' ? 'compra' : 'venta'} registrada correctamente.`,
    data: {
      ...created,
      id: String(created.id),
      asset_id: String(created.asset_id),
      quantity: String(created.quantity),
      price_per_share: String(created.price_per_share),
      fees: String(created.fees),
    },
  };
}

export async function updateInvestmentTransactionAction(
  transactionId: string,
  rawInput: InvestmentTransactionRawInput
): Promise<ActionResult<InvestmentTransactionRow>> {
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

  const parsed = investmentTransactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de la operación inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { assetId, transactionType, tradeDate, quantity, pricePerShare, fees, notes } =
    parsed.data;

  const supabase = await createServerSupabaseClient();

  // Verificar historial del activo sustituyendo la operación editada
  const { data: existingTxsData } = await supabase
    .from('investment_transactions')
    .select('id, trade_date, transaction_type, quantity, price_per_share, fees')
    .eq('user_id', user.id)
    .eq('asset_id', assetId);

  const existingTxs = (existingTxsData ?? []) as Pick<
    InvestmentTransactionRow,
    'id' | 'trade_date' | 'transaction_type' | 'quantity' | 'price_per_share' | 'fees'
  >[];

  const simulatedList = existingTxs
    .filter((t) => String(t.id) !== safeId)
    .map((t) => ({ ...t, id: String(t.id) }));

  simulatedList.push({
    id: safeId,
    trade_date: tradeDate,
    transaction_type: transactionType,
    quantity,
    price_per_share: pricePerShare,
    fees,
  });

  const simulatedLedger = processAssetTransactionsChronologically(simulatedList);
  if (!simulatedLedger.valid) {
    return {
      success: false,
      message:
        simulatedLedger.errorMessage ??
        'La modificación solicitada dejaría una venta posterior sin títulos suficientes.',
      code: 'INSUFFICIENT_SHARES',
    };
  }

  const { data, error } = await supabase
    .from('investment_transactions')
    .update({
      asset_id: assetId,
      transaction_type: transactionType,
      trade_date: tradeDate,
      quantity,
      price_per_share: pricePerShare,
      fees,
      notes,
    } as never)
    .eq('id', safeId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.message?.includes('INSUFFICIENT_SHARES')) {
      return {
        success: false,
        message:
          'Edición rechazada por PostgreSQL: el cambio deja el saldo de títulos en negativo en algún punto del historial.',
        code: 'INSUFFICIENT_SHARES',
      };
    }
    return {
      success: false,
      message: 'No se pudo actualizar la operación bursátil.',
      code: 'DB_ERROR',
    };
  }

  const updated = data as InvestmentTransactionRow;
  revalidateInvestmentPaths();

  return {
    success: true,
    message: 'Operación bursátil actualizada y métricas recalculadas.',
    data: {
      ...updated,
      id: String(updated.id),
      asset_id: String(updated.asset_id),
      quantity: String(updated.quantity),
      price_per_share: String(updated.price_per_share),
      fees: String(updated.fees),
    },
  };
}

export async function deleteInvestmentTransactionAction(
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

  const { data: targetTxData } = await supabase
    .from('investment_transactions')
    .select('id, asset_id')
    .eq('id', safeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!targetTxData) {
    return { success: false, message: 'Operación no encontrada.', code: 'NOT_FOUND' };
  }

  const assetId = String((targetTxData as { asset_id: string }).asset_id);

  // Verificar que eliminar esta operación no deje en negativo una venta posterior
  const { data: existingTxsData } = await supabase
    .from('investment_transactions')
    .select('id, trade_date, transaction_type, quantity, price_per_share, fees')
    .eq('user_id', user.id)
    .eq('asset_id', assetId);

  const remainingTxs = ((existingTxsData ?? []) as Pick<
    InvestmentTransactionRow,
    'id' | 'trade_date' | 'transaction_type' | 'quantity' | 'price_per_share' | 'fees'
  >[])
    .filter((t) => String(t.id) !== safeId)
    .map((t) => ({ ...t, id: String(t.id) }));

  const simulatedLedger = processAssetTransactionsChronologically(remainingTxs);
  if (!simulatedLedger.valid) {
    return {
      success: false,
      message:
        simulatedLedger.errorMessage ??
        'No puedes eliminar esta compra porque existen ventas posteriores que dependen de esos títulos.',
      code: 'INSUFFICIENT_SHARES',
    };
  }

  const { error } = await supabase
    .from('investment_transactions')
    .delete()
    .eq('id', safeId)
    .eq('user_id', user.id);

  if (error) {
    if (error.message?.includes('INSUFFICIENT_SHARES')) {
      return {
        success: false,
        message:
          'No se puede eliminar la operación porque dejaría una venta posterior en descubierto.',
        code: 'INSUFFICIENT_SHARES',
      };
    }
    return {
      success: false,
      message: 'No se pudo eliminar la operación.',
      code: 'DB_ERROR',
    };
  }

  revalidateInvestmentPaths();
  return {
    success: true,
    message: 'Operación eliminada y portafolio recalculado.',
  };
}

/**
 * Permite registrar o actualizar una cotización manual (`provider = 'manual'`)
 * cuando la API bursátil no está disponible o el usuario desea fijar un precio de referencia (Sección 5.3.E).
 */
export async function upsertManualQuoteAction(
  rawInput: ManualQuoteInput
): Promise<ActionResult<InvestmentQuoteCacheRow>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: 'Sesión expirada. Inicia sesión nuevamente.', code: 'UNAUTHORIZED' };
  }

  const parsed = manualQuoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de cotización manual inválidos.',
      code: 'VALIDATION_ERROR',
    };
  }

  const { assetId, price, referenceDate } = parsed.data;
  const marketTimeIso = referenceDate
    ? new Date(referenceDate).toISOString()
    : new Date().toISOString();

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('investment_quote_cache')
    .upsert(
      {
        user_id: user.id,
        asset_id: assetId,
        price,
        currency: 'USD',
        provider: 'manual',
        market_time: marketTimeIso,
        fetched_at: new Date().toISOString(),
      } as never,
      { onConflict: 'asset_id,user_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      message: 'No se pudo guardar la cotización manual.',
      code: 'DB_ERROR',
    };
  }

  const saved = data as InvestmentQuoteCacheRow;
  revalidateInvestmentPaths();

  return {
    success: true,
    message: 'Cotización manual actualizada correctamente.',
    data: {
      ...saved,
      id: String(saved.id),
      asset_id: String(saved.asset_id),
      price: String(saved.price),
    },
  };
}
