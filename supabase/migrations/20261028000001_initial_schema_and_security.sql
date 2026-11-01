-- ============================================================================
-- MIGRACIÓN BASE: ESQUEMA DE FINANZAS E INVERSIONES, INTEGRIDAD Y RLS
-- Archivo: supabase/migrations/20261028000001_initial_schema_and_security.sql
-- ============================================================================

-- 1. TIPOS ENUMERADOS DE DOMINIO
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_transaction_type') THEN
        CREATE TYPE public.finance_transaction_type AS ENUM ('income', 'expense');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investment_asset_type') THEN
        CREATE TYPE public.investment_asset_type AS ENUM ('stock', 'etf');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investment_transaction_type') THEN
        CREATE TYPE public.investment_transaction_type AS ENUM ('buy', 'sell');
    END IF;
END
$$;

-- 2. TABLAS DE NEGOCIO CON CLAVES SUSTITUTAS (BIGINT IDENTITY) Y PROPIETARIO (UUID)

-- 2.1. Perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE
        REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    base_currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (base_currency = 'USD'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id)
);

-- 2.2. Categorías personalizadas de ingresos y gastos
CREATE TABLE IF NOT EXISTS public.finance_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 80),
    kind public.finance_transaction_type NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b'
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    icon TEXT NOT NULL DEFAULT 'wallet'
        CHECK (length(trim(icon)) BETWEEN 1 AND 40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id, kind)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_categories_unique_name_idx
ON public.finance_categories (
    user_id,
    kind,
    lower(trim(name))
);

-- 2.3. Transacciones financieras (ingresos y gastos)
CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL,
    transaction_type public.finance_transaction_type NOT NULL,
    amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL
        CHECK (length(trim(description)) BETWEEN 1 AND 200),
    notes TEXT
        CHECK (notes IS NULL OR length(notes) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT finance_transaction_category_owner_fk
        FOREIGN KEY (
            category_id,
            user_id,
            transaction_type
        )
        REFERENCES public.finance_categories (
            id,
            user_id,
            kind
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS finance_transactions_user_date_idx
ON public.finance_transactions (
    user_id,
    transaction_date DESC,
    id DESC
);

CREATE INDEX IF NOT EXISTS finance_transactions_user_category_date_idx
ON public.finance_transactions (
    user_id,
    category_id,
    transaction_date DESC
);

-- 2.4. Activos de inversión (acciones y ETF)
CREATE TABLE IF NOT EXISTS public.investment_assets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL
        CHECK (
            length(trim(symbol)) BETWEEN 1 AND 20
            AND symbol = upper(trim(symbol))
        ),
    name TEXT NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 150),
    asset_type public.investment_asset_type NOT NULL,
    exchange TEXT
        CHECK (exchange IS NULL OR length(trim(exchange)) <= 50),
    provider_symbol TEXT
        CHECK (provider_symbol IS NULL OR length(trim(provider_symbol)) <= 30),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_assets_user_symbol_unique
        UNIQUE (user_id, symbol),

    CONSTRAINT investment_assets_id_user_unique
        UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS investment_assets_user_idx
ON public.investment_assets (user_id, id);

-- 2.5. Transacciones de inversión (compras y ventas)
CREATE TABLE IF NOT EXISTS public.investment_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    transaction_type public.investment_transaction_type NOT NULL,
    trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(28,10) NOT NULL CHECK (quantity > 0),
    price_per_share NUMERIC(20,8) NOT NULL
        CHECK (price_per_share > 0),
    fees NUMERIC(19,4) NOT NULL DEFAULT 0
        CHECK (fees >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    notes TEXT
        CHECK (notes IS NULL OR length(notes) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_transaction_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS investment_transactions_user_asset_date_idx
ON public.investment_transactions (
    user_id,
    asset_id,
    trade_date,
    id
);

-- 2.6. Caché de última cotización por activo
CREATE TABLE IF NOT EXISTS public.investment_quote_cache (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    price NUMERIC(20,8) NOT NULL CHECK (price > 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    provider TEXT NOT NULL
        CHECK (length(trim(provider)) BETWEEN 1 AND 50),
    market_time TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_quote_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT investment_quote_one_per_asset
        UNIQUE (asset_id, user_id)
);

CREATE INDEX IF NOT EXISTS investment_quote_user_asset_idx
ON public.investment_quote_cache (user_id, asset_id);

-- 2.7. Historial de precios (velas OHLC) por activo
CREATE TABLE IF NOT EXISTS public.investment_price_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    interval TEXT NOT NULL
        CHECK (
            interval IN (
                '1min', '5min', '15min',
                '30min', '1hour', '1day',
                '1week', '1month'
            )
        ),
    candle_at TIMESTAMPTZ NOT NULL,
    open NUMERIC(20,8) NOT NULL CHECK (open > 0),
    high NUMERIC(20,8) NOT NULL CHECK (high > 0),
    low NUMERIC(20,8) NOT NULL CHECK (low > 0),
    close NUMERIC(20,8) NOT NULL CHECK (close > 0),
    volume NUMERIC(28,10) CHECK (volume IS NULL OR volume >= 0),
    provider TEXT NOT NULL
        CHECK (length(trim(provider)) BETWEEN 1 AND 50),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_history_ohlc_valid
        CHECK (
            high >= low
            AND high >= open
            AND high >= close
            AND low <= open
            AND low <= close
        ),

    CONSTRAINT investment_history_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT investment_history_point_unique
        UNIQUE (user_id, asset_id, interval, candle_at)
);

CREATE INDEX IF NOT EXISTS investment_history_user_asset_time_idx
ON public.investment_price_history (
    user_id,
    asset_id,
    interval,
    candle_at DESC
);

-- ============================================================================
-- 3. TRIGGERS DE TIMESTAMPS (updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS finance_transactions_set_updated_at ON public.finance_transactions;
CREATE TRIGGER finance_transactions_set_updated_at
BEFORE UPDATE ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS investment_assets_set_updated_at ON public.investment_assets;
CREATE TRIGGER investment_assets_set_updated_at
BEFORE UPDATE ON public.investment_assets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS investment_transactions_set_updated_at ON public.investment_transactions;
CREATE TRIGGER investment_transactions_set_updated_at
BEFORE UPDATE ON public.investment_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. VALIDACIÓN TRANSACCIONAL CRONOLÓGICA DE DISPONIBILIDAD DE TÍTULOS
-- ============================================================================
-- Impide que una venta o una edición/eliminación retroactiva deje en negativo
-- la posición de un activo en cualquier punto de la línea temporal (trade_date, id).

CREATE OR REPLACE FUNCTION public.validate_investment_ledger_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_asset_id BIGINT;
    v_running_qty NUMERIC(28,10) := 0;
    v_rec RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        v_asset_id := OLD.asset_id;
    ELSE
        v_user_id := NEW.user_id;
        v_asset_id := NEW.asset_id;
    END IF;

    -- Bloqueo transaccional por activo para evitar condiciones de carrera concurrentes
    PERFORM pg_advisory_xact_lock(v_asset_id);

    FOR v_rec IN
        SELECT id, transaction_type, trade_date, quantity
        FROM public.investment_transactions
        WHERE user_id = v_user_id
          AND asset_id = v_asset_id
        ORDER BY trade_date ASC, id ASC
    LOOP
        IF v_rec.transaction_type = 'buy' THEN
            v_running_qty := v_running_qty + v_rec.quantity;
        ELSIF v_rec.transaction_type = 'sell' THEN
            v_running_qty := v_running_qty - v_rec.quantity;
        END IF;

        IF v_running_qty < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_SHARES: La operación en la fecha % (ID %) deja la posición en negativo (% títulos disponibles). No se permiten ventas en descubierto ni correcciones que invaliden ventas posteriores.',
                v_rec.trade_date, v_rec.id, v_running_qty
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    -- Si en un UPDATE cambió el asset_id, validar también el activo anterior
    IF TG_OP = 'UPDATE' AND OLD.asset_id <> NEW.asset_id THEN
        PERFORM pg_advisory_xact_lock(OLD.asset_id);
        v_running_qty := 0;
        FOR v_rec IN
            SELECT id, transaction_type, trade_date, quantity
            FROM public.investment_transactions
            WHERE user_id = OLD.user_id
              AND asset_id = OLD.asset_id
            ORDER BY trade_date ASC, id ASC
        LOOP
            IF v_rec.transaction_type = 'buy' THEN
                v_running_qty := v_running_qty + v_rec.quantity;
            ELSIF v_rec.transaction_type = 'sell' THEN
                v_running_qty := v_running_qty - v_rec.quantity;
            END IF;

            IF v_running_qty < 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_SHARES: El cambio de activo deja en negativo el historial del activo original en la fecha %.',
                    v_rec.trade_date
                    USING ERRCODE = 'P0001';
            END IF;
        END LOOP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investment_transactions_validate_ledger_trg ON public.investment_transactions;
CREATE TRIGGER investment_transactions_validate_ledger_trg
AFTER INSERT OR UPDATE OR DELETE ON public.investment_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_investment_ledger_consistency();

-- ============================================================================
-- 5. FUNCIONES AUXILIARES DE NEGOCIO (PERFIL, CATEGORÍAS, CACHÉ, HISTORIAL)
-- ============================================================================

-- 5.1. Semilla de categorías predeterminadas para un usuario
CREATE OR REPLACE FUNCTION public.seed_default_finance_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_PROFILE_OPERATION' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.finance_categories (user_id, name, kind, color, icon)
    VALUES
        (p_user_id, 'Sueldo', 'income', '#10b981', 'briefcase'),
        (p_user_id, 'Freelance', 'income', '#06b6d4', 'laptop'),
        (p_user_id, 'Otros ingresos', 'income', '#8b5cf6', 'plus-circle'),
        (p_user_id, 'Alimentación', 'expense', '#f59e0b', 'utensils'),
        (p_user_id, 'Transporte', 'expense', '#3b82f6', 'car'),
        (p_user_id, 'Servicios', 'expense', '#6366f1', 'zap'),
        (p_user_id, 'Educación', 'expense', '#ec4899', 'graduation-cap'),
        (p_user_id, 'Comida', 'expense', '#f97316', 'coffee'),
        (p_user_id, 'Salida amigos', 'expense', '#a855f7', 'users'),
        (p_user_id, 'Ocio', 'expense', '#14b8a6', 'gamepad-2'),
        (p_user_id, 'Otros', 'expense', '#64748b', 'tag')
    ON CONFLICT (user_id, kind, lower(trim(name))) DO NOTHING;
END;
$$;

-- 5.2. Crear o recuperar perfil del usuario autenticado (idempotente ante concurrencia)
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
    p_full_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_profile public.profiles;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED_USER' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.profiles (user_id, full_name, avatar_url, base_currency)
    VALUES (v_uid, p_full_name, p_avatar_url, 'USD')
    ON CONFLICT (user_id) DO UPDATE
    SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW()
    RETURNING * INTO v_profile;

    -- Si el usuario no tiene categorías aún, inicializar las categorías base
    IF NOT EXISTS (SELECT 1 FROM public.finance_categories WHERE user_id = v_uid) THEN
        PERFORM public.seed_default_finance_categories(v_uid);
    END IF;

    RETURN v_profile;
END;
$$;

-- 5.2b. Trigger automático al registrarse un usuario en auth.users (Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_meta JSONB := to_jsonb(NEW);
    v_full_name TEXT;
    v_avatar_url TEXT;
BEGIN
    v_full_name := COALESCE(
        v_meta #>> '{raw_user_meta_data,full_name}',
        v_meta #>> '{raw_user_meta_data,name}',
        split_part(COALESCE(v_meta ->> 'email', ''), '@', 1),
        'Usuario'
    );
    v_avatar_url := COALESCE(
        v_meta #>> '{raw_user_meta_data,avatar_url}',
        v_meta #>> '{raw_user_meta_data,picture}'
    );

    INSERT INTO public.profiles (user_id, full_name, avatar_url, base_currency)
    VALUES (NEW.id, v_full_name, v_avatar_url, 'USD')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.finance_categories (user_id, name, kind, color, icon)
    VALUES
        (NEW.id, 'Sueldo', 'income', '#10b981', 'briefcase'),
        (NEW.id, 'Freelance', 'income', '#06b6d4', 'laptop'),
        (NEW.id, 'Otros ingresos', 'income', '#8b5cf6', 'plus-circle'),
        (NEW.id, 'Alimentación', 'expense', '#f59e0b', 'utensils'),
        (NEW.id, 'Transporte', 'expense', '#3b82f6', 'car'),
        (NEW.id, 'Servicios', 'expense', '#6366f1', 'zap'),
        (NEW.id, 'Educación', 'expense', '#ec4899', 'graduation-cap'),
        (NEW.id, 'Comida', 'expense', '#f97316', 'coffee'),
        (NEW.id, 'Salida amigos', 'expense', '#a855f7', 'users'),
        (NEW.id, 'Ocio', 'expense', '#14b8a6', 'gamepad-2'),
        (NEW.id, 'Otros', 'expense', '#64748b', 'tag')
    ON CONFLICT (user_id, kind, lower(trim(name))) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
-- 5.2c. Actualizar la caché de cotizaciones sin duplicar registros
CREATE OR REPLACE FUNCTION public.upsert_investment_quote(
    p_asset_id BIGINT,
    p_price NUMERIC(20,8),
    p_provider TEXT,
    p_market_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.investment_quote_cache
LANGUAGE plpgsql
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_quote public.investment_quote_cache;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED_USER' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.investment_quote_cache (
        user_id,
        asset_id,
        price,
        currency,
        provider,
        market_time,
        fetched_at
    )
    VALUES (
        v_uid,
        p_asset_id,
        p_price,
        'USD',
        trim(p_provider),
        p_market_time,
        NOW()
    )
    ON CONFLICT (asset_id, user_id) DO UPDATE
    SET
        price = EXCLUDED.price,
        provider = EXCLUDED.provider,
        market_time = EXCLUDED.market_time,
        fetched_at = NOW()
    RETURNING * INTO v_quote;

    RETURN v_quote;
END;
$$;

-- 5.4. Consultar el historial bursátil con filtros y límites seguros
CREATE OR REPLACE FUNCTION public.get_asset_price_history(
    p_asset_id BIGINT,
    p_interval TEXT DEFAULT '1day',
    p_limit INT DEFAULT 365
)
RETURNS SETOF public.investment_price_history
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM public.investment_price_history
    WHERE user_id = (SELECT auth.uid())
      AND asset_id = p_asset_id
      AND interval = p_interval
    ORDER BY candle_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 365), 1), 2000);
$$;

-- 5.5. Calcular resumen financiero mensual directamente en PostgreSQL
CREATE OR REPLACE FUNCTION public.get_monthly_finance_summary(
    p_year INT,
    p_month INT
)
RETURNS TABLE (
    income_total NUMERIC(19,4),
    expense_total NUMERIC(19,4),
    net_balance NUMERIC(19,4),
    transaction_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
    WITH period_txs AS (
        SELECT transaction_type, amount
        FROM public.finance_transactions
        WHERE user_id = (SELECT auth.uid())
          AND EXTRACT(YEAR FROM transaction_date) = p_year
          AND EXTRACT(MONTH FROM transaction_date) = p_month
    )
    SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(19,4) AS income_total,
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(19,4) AS expense_total,
        (
            COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0)
        )::NUMERIC(19,4) AS net_balance,
        COUNT(*)::BIGINT AS transaction_count
    FROM period_txs;
$$;

-- 5.6. Calcular posiciones y costo promedio ponderado móvil directamente en PostgreSQL
CREATE OR REPLACE FUNCTION public.get_portfolio_positions_summary()
RETURNS TABLE (
    asset_id BIGINT,
    symbol TEXT,
    name TEXT,
    asset_type public.investment_asset_type,
    quantity NUMERIC(28,10),
    cost_basis NUMERIC(19,4),
    avg_cost_per_share NUMERIC(20,8),
    realized_gain_loss NUMERIC(19,4),
    quote_price NUMERIC(20,8),
    quote_provider TEXT,
    quote_fetched_at TIMESTAMPTZ,
    market_value NUMERIC(19,4),
    unrealized_gain_loss NUMERIC(19,4)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_asset RECORD;
    v_tx RECORD;
    v_qty NUMERIC(28,10);
    v_cost NUMERIC(19,4);
    v_avg NUMERIC(20,8);
    v_realized NUMERIC(19,4);
    v_cost_sold NUMERIC(19,4);
    v_quote RECORD;
BEGIN
    FOR v_asset IN
        SELECT a.id, a.symbol, a.name, a.asset_type
        FROM public.investment_assets a
        WHERE a.user_id = v_uid
        ORDER BY a.symbol ASC
    LOOP
        v_qty := 0;
        v_cost := 0;
        v_avg := 0;
        v_realized := 0;

        FOR v_tx IN
            SELECT t.id, t.transaction_type, t.trade_date, t.quantity, t.price_per_share, t.fees
            FROM public.investment_transactions t
            WHERE t.user_id = v_uid
              AND t.asset_id = v_asset.id
            ORDER BY t.trade_date ASC, t.id ASC
        LOOP
            IF v_tx.transaction_type = 'buy' THEN
                v_qty := v_qty + v_tx.quantity;
                v_cost := v_cost + ROUND((v_tx.quantity * v_tx.price_per_share) + v_tx.fees, 4);
                IF v_qty > 0 THEN
                    v_avg := ROUND(v_cost / v_tx.quantity * (v_tx.quantity / v_qty), 8);
                    v_avg := ROUND(v_cost / v_qty, 8);
                END IF;
            ELSIF v_tx.transaction_type = 'sell' THEN
                IF v_qty > 0 THEN
                    v_avg := ROUND(v_cost / v_qty, 8);
                ELSE
                    v_avg := 0;
                END IF;

                IF v_tx.quantity = v_qty THEN
                    v_cost_sold := v_cost;
                    v_qty := 0;
                    v_cost := 0;
                    v_avg := 0;
                ELSE
                    v_cost_sold := ROUND((v_cost / v_qty) * v_tx.quantity, 4);
                    v_qty := v_qty - v_tx.quantity;
                    v_cost := GREATEST(0, v_cost - v_cost_sold);
                    IF v_qty > 0 THEN
                        v_avg := ROUND(v_cost / v_qty, 8);
                    ELSE
                        v_avg := 0;
                    END IF;
                END IF;

                v_realized := v_realized + ROUND((v_tx.quantity * v_tx.price_per_share) - v_tx.fees - v_cost_sold, 4);
            END IF;
        END LOOP;

        SELECT q.price, q.provider, q.fetched_at
        INTO v_quote
        FROM public.investment_quote_cache q
        WHERE q.user_id = v_uid
          AND q.asset_id = v_asset.id
        LIMIT 1;

        asset_id := v_asset.id;
        symbol := v_asset.symbol;
        name := v_asset.name;
        asset_type := v_asset.asset_type;
        quantity := v_qty;
        cost_basis := v_cost;
        avg_cost_per_share := v_avg;
        realized_gain_loss := v_realized;

        IF FOUND AND v_quote.price IS NOT NULL THEN
            quote_price := v_quote.price;
            quote_provider := v_quote.provider;
            quote_fetched_at := v_quote.fetched_at;
            market_value := ROUND(v_qty * v_quote.price, 4);
            unrealized_gain_loss := ROUND((v_qty * v_quote.price) - v_cost, 4);
        ELSE
            quote_price := NULL;
            quote_provider := NULL;
            quote_fetched_at := NULL;
            market_value := NULL;
            unrealized_gain_loss := NULL;
        END IF;

        RETURN NEXT;
    END LOOP;
END;
$$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) EN LAS 7 TABLAS DE NEGOCIO
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_assets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investment_quote_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_quote_cache FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investment_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_price_history FORCE ROW LEVEL SECURITY;

-- 6.1. Políticas para profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own ON public.profiles
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.2. Políticas para finance_categories
DROP POLICY IF EXISTS finance_categories_select_own ON public.finance_categories;
CREATE POLICY finance_categories_select_own ON public.finance_categories
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_categories_insert_own ON public.finance_categories;
CREATE POLICY finance_categories_insert_own ON public.finance_categories
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_categories_update_own ON public.finance_categories;
CREATE POLICY finance_categories_update_own ON public.finance_categories
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_categories_delete_own ON public.finance_categories;
CREATE POLICY finance_categories_delete_own ON public.finance_categories
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.3. Políticas para finance_transactions
DROP POLICY IF EXISTS finance_transactions_select_own ON public.finance_transactions;
CREATE POLICY finance_transactions_select_own ON public.finance_transactions
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_transactions_insert_own ON public.finance_transactions;
CREATE POLICY finance_transactions_insert_own ON public.finance_transactions
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_transactions_update_own ON public.finance_transactions;
CREATE POLICY finance_transactions_update_own ON public.finance_transactions
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS finance_transactions_delete_own ON public.finance_transactions;
CREATE POLICY finance_transactions_delete_own ON public.finance_transactions
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.4. Políticas para investment_assets
DROP POLICY IF EXISTS investment_assets_select_own ON public.investment_assets;
CREATE POLICY investment_assets_select_own ON public.investment_assets
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_assets_insert_own ON public.investment_assets;
CREATE POLICY investment_assets_insert_own ON public.investment_assets
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_assets_update_own ON public.investment_assets;
CREATE POLICY investment_assets_update_own ON public.investment_assets
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_assets_delete_own ON public.investment_assets;
CREATE POLICY investment_assets_delete_own ON public.investment_assets
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.5. Políticas para investment_transactions
DROP POLICY IF EXISTS investment_transactions_select_own ON public.investment_transactions;
CREATE POLICY investment_transactions_select_own ON public.investment_transactions
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_transactions_insert_own ON public.investment_transactions;
CREATE POLICY investment_transactions_insert_own ON public.investment_transactions
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_transactions_update_own ON public.investment_transactions;
CREATE POLICY investment_transactions_update_own ON public.investment_transactions
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_transactions_delete_own ON public.investment_transactions;
CREATE POLICY investment_transactions_delete_own ON public.investment_transactions
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.6. Políticas para investment_quote_cache
DROP POLICY IF EXISTS investment_quote_cache_select_own ON public.investment_quote_cache;
CREATE POLICY investment_quote_cache_select_own ON public.investment_quote_cache
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_quote_cache_insert_own ON public.investment_quote_cache;
CREATE POLICY investment_quote_cache_insert_own ON public.investment_quote_cache
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_quote_cache_update_own ON public.investment_quote_cache;
CREATE POLICY investment_quote_cache_update_own ON public.investment_quote_cache
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_quote_cache_delete_own ON public.investment_quote_cache;
CREATE POLICY investment_quote_cache_delete_own ON public.investment_quote_cache
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- 6.7. Políticas para investment_price_history
DROP POLICY IF EXISTS investment_price_history_select_own ON public.investment_price_history;
CREATE POLICY investment_price_history_select_own ON public.investment_price_history
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_price_history_insert_own ON public.investment_price_history;
CREATE POLICY investment_price_history_insert_own ON public.investment_price_history
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_price_history_update_own ON public.investment_price_history;
CREATE POLICY investment_price_history_update_own ON public.investment_price_history
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS investment_price_history_delete_own ON public.investment_price_history;
CREATE POLICY investment_price_history_delete_own ON public.investment_price_history
FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 7. PERMISOS EXPLÍCITOS POR ROL (PRIVILEGIO MÍNIMO)
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.profiles,
    public.finance_categories,
    public.finance_transactions,
    public.investment_assets,
    public.investment_transactions,
    public.investment_quote_cache,
    public.investment_price_history
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.seed_default_finance_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_investment_quote(BIGINT, NUMERIC, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_asset_price_history(BIGINT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_finance_summary(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_positions_summary() TO authenticated;

-- Recargar caché de esquema de PostgREST en Supabase automáticamente tras ejecutar la migración
NOTIFY pgrst, 'reload schema';
