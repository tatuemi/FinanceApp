import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

describe('Fase 3: Esquema PostgreSQL, Integridad, Claves Sustitutas y Aislamiento RLS', () => {
  let db: PGlite;

  const USER_A = '11111111-1111-4111-8111-111111111111';
  const USER_B = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    db = new PGlite();

    // Preparar esquema mínimo compatible con Supabase Auth (`auth.users`, `auth.uid()`, roles `authenticated` y `anon`)
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
      END
      $$;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;

      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'alice@example.com'),
        ('${USER_B}', 'bob@example.com');
    `);

    // Ejecutar la migración oficial del proyecto
    const migrationPath = path.resolve(
      __dirname,
      '../migrations/20261028000001_initial_schema_and_security.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    await db.exec(migrationSql);
  });

  afterAll(async () => {
    await db.close();
  });

  /**
   * Ejecuta sentencias SQL dentro de una transacción autenticada como `userId`.
   */
  async function runAsUser<T = Record<string, unknown>>(
    userId: string,
    sqlText: string
  ): Promise<T[]> {
    await db.exec('BEGIN;');
    try {
      await db.exec(`SET LOCAL ROLE authenticated;`);
      await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', true);`);
      const res = await db.query<T>(sqlText);
      await db.exec('COMMIT;');
      return res.rows;
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
  }

  it('verifica que las 7 tablas de negocio tienen id BIGINT GENERATED ALWAYS AS IDENTITY y RLS activo', async () => {
    const tables = [
      'profiles',
      'finance_categories',
      'finance_transactions',
      'investment_assets',
      'investment_transactions',
      'investment_quote_cache',
      'investment_price_history',
    ];

    for (const tableName of tables) {
      const colRes = await db.query<{
        data_type: string;
        is_identity: string;
        identity_generation: string;
      }>(`
        SELECT data_type, is_identity, identity_generation
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${tableName}'
          AND column_name = 'id';
      `);

      expect(colRes.rows.length).toBe(1);
      expect(colRes.rows[0]?.data_type).toBe('bigint');
      expect(colRes.rows[0]?.is_identity).toBe('YES');
      expect(colRes.rows[0]?.identity_generation).toBe('ALWAYS');

      const rlsRes = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = '${tableName}';
      `);

      expect(rlsRes.rows[0]?.relrowsecurity).toBe(true);
      expect(rlsRes.rows[0]?.relforcerowsecurity).toBe(true);
    }
  });

  it('crea perfiles y categorías base de forma aislada para Usuario A y Usuario B', async () => {
    const profileA = await runAsUser<{ user_id: string; full_name: string }>(
      USER_A,
      `SELECT * FROM public.ensure_user_profile('Alice Investor', NULL);`
    );
    expect(profileA[0]?.user_id).toBe(USER_A);
    expect(profileA[0]?.full_name).toBe('Alice Investor');

    const profileB = await runAsUser<{ user_id: string; full_name: string }>(
      USER_B,
      `SELECT * FROM public.ensure_user_profile('Bob Trader', NULL);`
    );
    expect(profileB[0]?.user_id).toBe(USER_B);

    // Usuario A solo ve su propio perfil y sus propias categorías
    const visibleProfilesForA = await runAsUser(USER_A, `SELECT * FROM public.profiles;`);
    expect(visibleProfilesForA.length).toBe(1);

    const categoriesA = await runAsUser<{ id: string; name: string; kind: string }>(
      USER_A,
      `SELECT id, name, kind FROM public.finance_categories ORDER BY id;`
    );
    expect(categoriesA.length).toBe(11);
  });

  it('impide asociar un ingreso a una categoría de gasto o a una categoría de otro usuario', async () => {
    const expenseCatA = await runAsUser<{ id: string }>(
      USER_A,
      `SELECT id FROM public.finance_categories WHERE kind = 'expense' LIMIT 1;`
    );
    const incomeCatA = await runAsUser<{ id: string }>(
      USER_A,
      `SELECT id FROM public.finance_categories WHERE kind = 'income' LIMIT 1;`
    );

    const expenseCatIdA = expenseCatA[0]!.id;
    const incomeCatIdA = incomeCatA[0]!.id;

    // 1. Usuario A intenta registrar un 'income' usando una categoría 'expense' -> Rechazado por FK compuesta
    await expect(
      runAsUser(
        USER_A,
        `INSERT INTO public.finance_transactions (user_id, category_id, transaction_type, amount, description)
         VALUES ('${USER_A}', ${expenseCatIdA}, 'income', 1500.00, 'Intento inválido de tipo');`
      )
    ).rejects.toThrow();

    // 2. Usuario B intenta registrar un 'income' apuntando al category_id de Usuario A -> Rechazado por FK compuesta
    await expect(
      runAsUser(
        USER_B,
        `INSERT INTO public.finance_transactions (user_id, category_id, transaction_type, amount, description)
         VALUES ('${USER_B}', ${incomeCatIdA}, 'income', 1500.00, 'Intento cruzado entre usuarios');`
      )
    ).rejects.toThrow();

    // 3. Usuario A registra operación válida
    const insertedTx = await runAsUser<{ id: string; amount: string }>(
      USER_A,
      `INSERT INTO public.finance_transactions (user_id, category_id, transaction_type, amount, description)
       VALUES ('${USER_A}', ${incomeCatIdA}, 'income', 2500.5000, 'Sueldo Octubre')
       RETURNING id, amount;`
    );
    expect(insertedTx.length).toBe(1);

    // 4. Usuario B no puede leer, actualizar ni eliminar la transacción de Usuario A
    const readByB = await runAsUser(USER_B, `SELECT * FROM public.finance_transactions;`);
    expect(readByB.length).toBe(0);

    const updatedByB = await runAsUser(
      USER_B,
      `UPDATE public.finance_transactions SET amount = 1.00 WHERE id = ${insertedTx[0]!.id} RETURNING id;`
    );
    expect(updatedByB.length).toBe(0);

    const deletedByB = await runAsUser(
      USER_B,
      `DELETE FROM public.finance_transactions WHERE id = ${insertedTx[0]!.id} RETURNING id;`
    );
    expect(deletedByB.length).toBe(0);
  });

  it('garantiza aislamiento de activos y bloquea ventas sin títulos suficientes o retroactivas inválidas', async () => {
    // Usuario A crea activo AAPL
    const assetRes = await runAsUser<{ id: string }>(
      USER_A,
      `INSERT INTO public.investment_assets (user_id, symbol, name, asset_type, exchange)
       VALUES ('${USER_A}', 'AAPL', 'Apple Inc.', 'stock', 'NASDAQ')
       RETURNING id;`
    );
    const assetIdA = assetRes[0]!.id;

    // Usuario B no puede insertar una compra referenciando el assetIdA de Usuario A
    await expect(
      runAsUser(
        USER_B,
        `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
         VALUES ('${USER_B}', ${assetIdA}, 'buy', '2026-10-01', 1.0, 200.00, 0);`
      )
    ).rejects.toThrow();

    // Usuario A compra 1.5 acciones el 2026-10-10
    const buyRes = await runAsUser<{ id: string }>(
      USER_A,
      `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
       VALUES ('${USER_A}', ${assetIdA}, 'buy', '2026-10-10', 1.5000000000, 180.00000000, 1.0000)
       RETURNING id;`
    );
    const buyId = buyRes[0]!.id;

    // Intento 1: Vender 2.0 acciones el 2026-10-15 (más de las 1.5 disponibles) -> Rechazado por trigger
    await expect(
      runAsUser(
        USER_A,
        `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
         VALUES ('${USER_A}', ${assetIdA}, 'sell', '2026-10-15', 2.0000000000, 195.00000000, 1.0000);`
      )
    ).rejects.toThrow(/INSUFFICIENT_SHARES/);

    // Intento 2: Vender 0.5 acciones en fecha ANTERIOR a la compra (2026-10-01) -> Rechazado por validación cronológica
    await expect(
      runAsUser(
        USER_A,
        `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
         VALUES ('${USER_A}', ${assetIdA}, 'sell', '2026-10-01', 0.5000000000, 190.00000000, 0);`
      )
    ).rejects.toThrow(/INSUFFICIENT_SHARES/);

    // Operación válida: Vender 0.75 acciones el 2026-10-12
    const sellRes = await runAsUser<{ id: string }>(
      USER_A,
      `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
       VALUES ('${USER_A}', ${assetIdA}, 'sell', '2026-10-12', 0.7500000000, 195.00000000, 0.5000)
       RETURNING id;`
    );
    expect(sellRes.length).toBe(1);

    // Intento 3: Reducir retroactivamente la compra original a 0.5 acciones (dejaría la venta de 0.75 en negativo)
    await expect(
      runAsUser(
        USER_A,
        `UPDATE public.investment_transactions SET quantity = 0.5000000000 WHERE id = ${buyId};`
      )
    ).rejects.toThrow(/INSUFFICIENT_SHARES/);

    // Intento 4: Eliminar la compra original mientras existe una venta posterior -> Rechazado
    await expect(
      runAsUser(USER_A, `DELETE FROM public.investment_transactions WHERE id = ${buyId};`)
    ).rejects.toThrow(/INSUFFICIENT_SHARES/);
  });

  it('aísla la caché de cotizaciones e historial de precios y rechaza acceso anónimo', async () => {
    const assetRes = await runAsUser<{ id: string }>(
      USER_A,
      `SELECT id FROM public.investment_assets WHERE symbol = 'AAPL' LIMIT 1;`
    );
    const assetIdA = assetRes[0]!.id;

    // Guardar cotización para Usuario A
    const quoteRes = await runAsUser<{ price: string; provider: string }>(
      USER_A,
      `SELECT * FROM public.upsert_investment_quote(${assetIdA}::BIGINT, 212.35000000, 'manual', NOW());`
    );
    expect(Number(quoteRes[0]?.price)).toBeCloseTo(212.35, 2);
    expect(quoteRes[0]?.provider).toBe('manual');

    // Usuario B no ve la cotización de Usuario A
    const quotesForB = await runAsUser(USER_B, `SELECT * FROM public.investment_quote_cache;`);
    expect(quotesForB.length).toBe(0);

    // Rol anon no tiene permisos sobre las tablas
    await db.exec('BEGIN;');
    let anonFailed = false;
    try {
      await db.exec('SET LOCAL ROLE anon;');
      await db.query('SELECT * FROM public.finance_transactions;');
    } catch {
      anonFailed = true;
    } finally {
      await db.exec('ROLLBACK;');
    }
    expect(anonFailed).toBe(true);
  });
});
