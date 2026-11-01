import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import type { ProfileRow } from '@/types/database';

export interface AuthenticatedContext {
  user: User;
  profile: ProfileRow;
}

const DEFAULT_CATEGORIES_SEED = [
  { name: 'Sueldo', kind: 'income' as const, color: '#10b981', icon: 'briefcase' },
  { name: 'Freelance', kind: 'income' as const, color: '#06b6d4', icon: 'laptop' },
  { name: 'Otros ingresos', kind: 'income' as const, color: '#8b5cf6', icon: 'plus-circle' },
  { name: 'Alimentación', kind: 'expense' as const, color: '#f59e0b', icon: 'utensils' },
  { name: 'Transporte', kind: 'expense' as const, color: '#3b82f6', icon: 'car' },
  { name: 'Servicios', kind: 'expense' as const, color: '#6366f1', icon: 'zap' },
  { name: 'Educación', kind: 'expense' as const, color: '#ec4899', icon: 'graduation-cap' },
  { name: 'Comida', kind: 'expense' as const, color: '#f97316', icon: 'coffee' },
  { name: 'Salida amigos', kind: 'expense' as const, color: '#a855f7', icon: 'users' },
  { name: 'Ocio', kind: 'expense' as const, color: '#14b8a6', icon: 'gamepad-2' },
  { name: 'Otros', kind: 'expense' as const, color: '#64748b', icon: 'tag' },
];

export async function getAuthenticatedUser(): Promise<User | null> {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    return null;
  }
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?reason=session_required');
  }
  return user;
}

/**
 * Crea o recupera el perfil del usuario autenticado evitando duplicados ante concurrencia,
 * e inicializa las categorías financieras base si el usuario aún no tiene ninguna.
 */
export async function ensureUserProfileForUser(user: User): Promise<ProfileRow> {
  const supabase = await createServerSupabaseClient();
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Usuario';
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  // Intentar primero mediante la función RPC transaccional definida en la migración
  const rpcResult = (await supabase.rpc('ensure_user_profile' as never, {
    p_full_name: fullName,
    p_avatar_url: avatarUrl,
  } as never)) as unknown as { data: ProfileRow | ProfileRow[] | null; error: unknown };

  if (!rpcResult.error && rpcResult.data) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (row) {
      return {
        id: String(row.id),
        user_id: row.user_id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        base_currency: 'USD',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
  }

  // Fallback seguro mediante upsert directo respetando RLS
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  let profile = existingProfile as ProfileRow | null;

  if (!profile) {
    const { data: upserted } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          base_currency: 'USD',
        } as never,
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    profile = upserted as ProfileRow | null;
  }

  // Asegurar categorías iniciales si el usuario no tiene ninguna
  const { count } = await supabase
    .from('finance_categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count === 0) {
    await supabase.from('finance_categories').insert(
      DEFAULT_CATEGORIES_SEED.map((c) => ({
        user_id: user.id,
        name: c.name,
        kind: c.kind,
        color: c.color,
        icon: c.icon,
      })) as never
    );
  }

  if (profile) {
    return {
      ...profile,
      id: String(profile.id),
    };
  }

  return {
    id: '0',
    user_id: user.id,
    full_name: fullName,
    avatar_url: avatarUrl,
    base_currency: 'USD',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
