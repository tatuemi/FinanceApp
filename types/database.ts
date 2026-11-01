/**
 * Tipos estrictos del esquema PostgreSQL (Supabase).
 *
 * REGLA OBLIGATORIA (Sección 3.3 y 3.5):
 * - Los identificadores BIGINT se representan como `string` opaco (`EntityId`)
 *   para conservar precisión de 64 bits al cruzar JSON y límites de red.
 * - Los importes monetarios, precios y cantidades NUMERIC se representan como
 *   cadenas decimales (`DecimalString`) desde la base de datos y se operan con `decimal.js`.
 */

export type EntityId = string;
export type UserId = string;
export type DecimalString = string;

export type FinanceTransactionType = 'income' | 'expense';
export type InvestmentAssetType = 'stock' | 'etf';
export type InvestmentTransactionType = 'buy' | 'sell';
export type PriceCandleInterval =
  | '1min'
  | '5min'
  | '15min'
  | '30min'
  | '1hour'
  | '1day'
  | '1week'
  | '1month';

export interface ProfileRow {
  id: EntityId;
  user_id: UserId;
  full_name: string | null;
  avatar_url: string | null;
  base_currency: 'USD';
  created_at: string;
  updated_at: string;
}

export interface FinanceCategoryRow {
  id: EntityId;
  user_id: UserId;
  name: string;
  kind: FinanceTransactionType;
  color: string;
  icon: string;
  created_at: string;
}

export interface FinanceTransactionRow {
  id: EntityId;
  user_id: UserId;
  category_id: EntityId;
  transaction_type: FinanceTransactionType;
  amount: DecimalString; // NUMERIC(19,4)
  currency: 'USD';
  transaction_date: string; // YYYY-MM-DD
  description: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransactionWithCategory extends FinanceTransactionRow {
  category?: Pick<FinanceCategoryRow, 'id' | 'name' | 'kind' | 'color' | 'icon'> | null;
}

export interface InvestmentAssetRow {
  id: EntityId;
  user_id: UserId;
  symbol: string;
  name: string;
  asset_type: InvestmentAssetType;
  exchange: string | null;
  provider_symbol: string | null;
  currency: 'USD';
  created_at: string;
  updated_at: string;
}

export interface InvestmentTransactionRow {
  id: EntityId;
  user_id: UserId;
  asset_id: EntityId;
  transaction_type: InvestmentTransactionType;
  trade_date: string; // YYYY-MM-DD
  quantity: DecimalString; // NUMERIC(28,10)
  price_per_share: DecimalString; // NUMERIC(20,8)
  fees: DecimalString; // NUMERIC(19,4)
  currency: 'USD';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentTransactionWithAsset extends InvestmentTransactionRow {
  asset?: Pick<InvestmentAssetRow, 'id' | 'symbol' | 'name' | 'asset_type' | 'currency'> | null;
}

export interface InvestmentQuoteCacheRow {
  id: EntityId;
  user_id: UserId;
  asset_id: EntityId;
  price: DecimalString; // NUMERIC(20,8)
  currency: 'USD';
  provider: string;
  market_time: string | null;
  fetched_at: string;
}

export interface InvestmentPriceHistoryRow {
  id: EntityId;
  user_id: UserId;
  asset_id: EntityId;
  interval: PriceCandleInterval;
  candle_at: string;
  open: DecimalString;
  high: DecimalString;
  low: DecimalString;
  close: DecimalString;
  volume: DecimalString | null;
  provider: string;
  fetched_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          user_id: UserId;
          full_name?: string | null;
          avatar_url?: string | null;
          base_currency?: 'USD';
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          base_currency?: 'USD';
        };
      };
      finance_categories: {
        Row: FinanceCategoryRow;
        Insert: {
          user_id: UserId;
          name: string;
          kind: FinanceTransactionType;
          color?: string;
          icon?: string;
        };
        Update: {
          name?: string;
          kind?: FinanceTransactionType;
          color?: string;
          icon?: string;
        };
      };
      finance_transactions: {
        Row: FinanceTransactionRow;
        Insert: {
          user_id: UserId;
          category_id: EntityId;
          transaction_type: FinanceTransactionType;
          amount: DecimalString;
          currency?: 'USD';
          transaction_date?: string;
          description: string;
          notes?: string | null;
        };
        Update: {
          category_id?: EntityId;
          transaction_type?: FinanceTransactionType;
          amount?: DecimalString;
          transaction_date?: string;
          description?: string;
          notes?: string | null;
        };
      };
      investment_assets: {
        Row: InvestmentAssetRow;
        Insert: {
          user_id: UserId;
          symbol: string;
          name: string;
          asset_type: InvestmentAssetType;
          exchange?: string | null;
          provider_symbol?: string | null;
          currency?: 'USD';
        };
        Update: {
          symbol?: string;
          name?: string;
          asset_type?: InvestmentAssetType;
          exchange?: string | null;
          provider_symbol?: string | null;
        };
      };
      investment_transactions: {
        Row: InvestmentTransactionRow;
        Insert: {
          user_id: UserId;
          asset_id: EntityId;
          transaction_type: InvestmentTransactionType;
          trade_date?: string;
          quantity: DecimalString;
          price_per_share: DecimalString;
          fees?: DecimalString;
          currency?: 'USD';
          notes?: string | null;
        };
        Update: {
          asset_id?: EntityId;
          transaction_type?: InvestmentTransactionType;
          trade_date?: string;
          quantity?: DecimalString;
          price_per_share?: DecimalString;
          fees?: DecimalString;
          notes?: string | null;
        };
      };
      investment_quote_cache: {
        Row: InvestmentQuoteCacheRow;
        Insert: {
          user_id: UserId;
          asset_id: EntityId;
          price: DecimalString;
          currency?: 'USD';
          provider: string;
          market_time?: string | null;
          fetched_at?: string;
        };
        Update: {
          price?: DecimalString;
          provider?: string;
          market_time?: string | null;
          fetched_at?: string;
        };
      };
      investment_price_history: {
        Row: InvestmentPriceHistoryRow;
        Insert: {
          user_id: UserId;
          asset_id: EntityId;
          interval: PriceCandleInterval;
          candle_at: string;
          open: DecimalString;
          high: DecimalString;
          low: DecimalString;
          close: DecimalString;
          volume?: DecimalString | null;
          provider: string;
          fetched_at?: string;
        };
        Update: {
          open?: DecimalString;
          high?: DecimalString;
          low?: DecimalString;
          close?: DecimalString;
          volume?: DecimalString | null;
          provider?: string;
          fetched_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_user_profile: {
        Args: {
          p_full_name?: string | null;
          p_avatar_url?: string | null;
        };
        Returns: ProfileRow;
      };
      seed_default_finance_categories: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      upsert_investment_quote: {
        Args: {
          p_asset_id: string;
          p_price: string;
          p_provider: string;
          p_market_time?: string | null;
        };
        Returns: InvestmentQuoteCacheRow;
      };
      get_asset_price_history: {
        Args: {
          p_asset_id: string;
          p_interval?: string;
          p_limit?: number;
        };
        Returns: InvestmentPriceHistoryRow[];
      };
    };
    Enums: {
      finance_transaction_type: FinanceTransactionType;
      investment_asset_type: InvestmentAssetType;
      investment_transaction_type: InvestmentTransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
