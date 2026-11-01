import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { calculateMonthlyPeriodSummary } from '@/lib/finance/calculations';
import { calculatePortfolioOverview } from '@/lib/investments/calculations';
import type {
  FinanceTransactionRow,
  InvestmentAssetRow,
  InvestmentQuoteCacheRow,
  InvestmentTransactionRow,
} from '@/types/database';

describe('Fase 9: Integración CRUD Completa en PostgreSQL (Finanzas, Categorías, Portafolio e Historial OHLC)', () => {
  let db: PGlite;
  const USER_ID = '33333333-3333-4333-8333-333333333333';

  beforeAll(async () => {
    db = new PGlite();

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

      INSERT INTO auth.users (id, email) VALUES ('${USER_ID}', 'investor@example.com');
    `);

    const migrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261028000001_initial_schema_and_security.sql'
    );
    await db.exec(fs.readFileSync(migrationPath, 'utf-8'));
  });

  afterAll(async () => {
    await db.close();
  });

  async function queryAsUser<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    await db.exec('BEGIN;');
    try {
      await db.exec('SET LOCAL ROLE authenticated;');
      await db.exec(`SELECT set_config('request.jwt.claim.sub', '${USER_ID}', true);`);
      const res = await db.query<T>(sql);
      await db.exec('COMMIT;');
      return res.rows;
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  it('ejecuta flujo CRUD de categorías personalizadas con protección y reasignación de movimientos', async () => {
    await queryAsUser(`SELECT * FROM public.ensure_user_profile('Investor User', NULL);`);

    // 1. Crear categoría personalizada de gasto
    const createdCat = await queryAsUser<{ id: string; name: string }>(
      `INSERT INTO public.finance_categories (user_id, name, kind, color, icon)
       VALUES ('${USER_ID}', 'Suscripciones Cloud', 'expense', '#6366f1', 'laptop')
       RETURNING id, name;`
    );
    const customCatId = createdCat[0]!.id;

    // 2. Rechazar duplicado insensible a mayúsculas/minúsculas dentro del mismo usuario y tipo
    await expect(
      queryAsUser(
        `INSERT INTO public.finance_categories (user_id, name, kind, color, icon)
         VALUES ('${USER_ID}', '  suscripciones cloud ', 'expense', '#10b981', 'laptop');`
      )
    ).rejects.toThrow();

    // 3. Registrar gasto asociado a la categoría personalizada
    await queryAsUser(
      `INSERT INTO public.finance_transactions (user_id, category_id, transaction_type, amount, transaction_date, description)
       VALUES ('${USER_ID}', ${customCatId}, 'expense', 15.9900, '2026-10-10', 'Almacenamiento en la nube');`
    );

    // 4. Intentar eliminar la categoría sin reasignar -> Bloqueado por ON DELETE RESTRICT
    await expect(
      queryAsUser(`DELETE FROM public.finance_categories WHERE id = ${customCatId};`)
    ).rejects.toThrow();

    // 5. Reasignar el gasto a otra categoría de gasto ('Servicios') y luego eliminar la categoría personalizada
    const targetCat = await queryAsUser<{ id: string }>(
      `SELECT id FROM public.finance_categories WHERE kind = 'expense' AND name = 'Servicios' LIMIT 1;`
    );
    const targetCatId = targetCat[0]!.id;

    await queryAsUser(
      `UPDATE public.finance_transactions SET category_id = ${targetCatId} WHERE category_id = ${customCatId};`
    );
    const deletedCat = await queryAsUser<{ id: string }>(
      `DELETE FROM public.finance_categories WHERE id = ${customCatId} RETURNING id;`
    );
    expect(deletedCat.length).toBe(1);
  });

  it('verifica consistencia entre get_monthly_finance_summary en PostgreSQL y calculateMonthlyPeriodSummary en dominio', async () => {
    const incomeCat = await queryAsUser<{ id: string }>(
      `SELECT id FROM public.finance_categories WHERE kind = 'income' AND name = 'Sueldo' LIMIT 1;`
    );
    const incomeCatId = incomeCat[0]!.id;

    // Insertar un ingreso en octubre 2026
    const insertedIncome = await queryAsUser<{ id: string }>(
      `INSERT INTO public.finance_transactions (user_id, category_id, transaction_type, amount, transaction_date, description)
       VALUES ('${USER_ID}', ${incomeCatId}, 'income', 3500.0000, '2026-10-05', 'Nómina Octubre')
       RETURNING id;`
    );

    // Editar el importe del ingreso (CRUD Update)
    await queryAsUser(
      `UPDATE public.finance_transactions SET amount = 3650.2500 WHERE id = ${insertedIncome[0]!.id};`
    );

    const allOctTxs = await queryAsUser<FinanceTransactionRow>(
      `SELECT * FROM public.finance_transactions WHERE user_id = '${USER_ID}';`
    );

    const domainSummary = calculateMonthlyPeriodSummary(allOctTxs, 2026, 10);
    const sqlSummary = await queryAsUser<{
      income_total: string;
      expense_total: string;
      net_balance: string;
      transaction_count: string;
    }>(`SELECT * FROM public.get_monthly_finance_summary(2026, 10);`);

    expect(sqlSummary[0]?.income_total).toBe(domainSummary.incomeTotal);
    expect(sqlSummary[0]?.expense_total).toBe(domainSummary.expenseTotal);
    expect(sqlSummary[0]?.net_balance).toBe(domainSummary.netBalance);
    expect(Number(sqlSummary[0]?.transaction_count)).toBe(domainSummary.transactionCount);
  });

  it('verifica consistencia entre get_portfolio_positions_summary en PostgreSQL y calculatePortfolioOverview en dominio, más historial OHLC', async () => {
    const assetRows = await queryAsUser<InvestmentAssetRow>(
      `INSERT INTO public.investment_assets (user_id, symbol, name, asset_type, exchange, provider_symbol)
       VALUES ('${USER_ID}', 'VOO', 'Vanguard S&P 500 ETF', 'etf', 'NYSE', 'VOO')
       RETURNING *;`
    );
    const asset = assetRows[0]!;

    // Comprar 1.25 títulos a $480 + $1 comisión, luego comprar 0.75 títulos a $500 + $1 comisión, luego vender 0.5 títulos a $520 - $1 comisión
    await queryAsUser(
      `INSERT INTO public.investment_transactions (user_id, asset_id, transaction_type, trade_date, quantity, price_per_share, fees)
       VALUES
         ('${USER_ID}', ${asset.id}, 'buy', '2026-10-01', 1.2500000000, 480.00000000, 1.0000),
         ('${USER_ID}', ${asset.id}, 'buy', '2026-10-05', 0.7500000000, 500.00000000, 1.0000),
         ('${USER_ID}', ${asset.id}, 'sell', '2026-10-12', 0.5000000000, 520.00000000, 1.0000);`
    );

    // Guardar cotización en caché
    await queryAsUser(
      `SELECT * FROM public.upsert_investment_quote(${asset.id}::BIGINT, 530.00000000, 'twelvedata', NOW());`
    );

    const txs = await queryAsUser<InvestmentTransactionRow>(
      `SELECT * FROM public.investment_transactions WHERE asset_id = ${asset.id};`
    );
    const quotes = await queryAsUser<InvestmentQuoteCacheRow>(
      `SELECT * FROM public.investment_quote_cache WHERE asset_id = ${asset.id};`
    );

    const domainOverview = calculatePortfolioOverview([asset], txs, quotes);
    const domainPos = domainOverview.positions[0]!;

    const sqlPositions = await queryAsUser<{
      quantity: string;
      cost_basis: string;
      avg_cost_per_share: string;
      realized_gain_loss: string;
      market_value: string;
      unrealized_gain_loss: string;
    }>(`SELECT * FROM public.get_portfolio_positions_summary();`);

    expect(sqlPositions[0]?.quantity).toBe(domainPos.quantity);
    expect(sqlPositions[0]?.cost_basis).toBe(domainPos.costBasis);
    expect(sqlPositions[0]?.avg_cost_per_share).toBe(domainPos.averageCostPerShare);
    expect(sqlPositions[0]?.realized_gain_loss).toBe(domainPos.realizedGainLoss);
    expect(sqlPositions[0]?.market_value).toBe(domainPos.marketValue);
    expect(sqlPositions[0]?.unrealized_gain_loss).toBe(domainPos.unrealizedGainLoss);

    // Probar inserción y restricción CHECK de velas OHLC en investment_price_history
    await queryAsUser(
      `INSERT INTO public.investment_price_history (user_id, asset_id, interval, candle_at, open, high, low, close, volume, provider)
       VALUES ('${USER_ID}', ${asset.id}, '1day', '2026-10-20T00:00:00Z', 510.00, 525.00, 508.00, 522.00, 3200000, 'twelvedata');`
    );

    const historyRows = await queryAsUser(
      `SELECT * FROM public.get_asset_price_history(${asset.id}::BIGINT, '1day', 30);`
    );
    expect(historyRows.length).toBe(1);

    // Vela inválida donde high < low debe ser rechazada por investment_history_ohlc_valid
    await expect(
      queryAsUser(
        `INSERT INTO public.investment_price_history (user_id, asset_id, interval, candle_at, open, high, low, close, provider)
         VALUES ('${USER_ID}', ${asset.id}, '1day', '2026-10-21T00:00:00Z', 510.00, 500.00, 508.00, 505.00, 'twelvedata');`
      )
    ).rejects.toThrow();
  });
});
