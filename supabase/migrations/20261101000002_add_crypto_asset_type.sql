-- Migración incremental: añade soporte para Criptomonedas ('crypto') en el enum investment_asset_type
ALTER TYPE public.investment_asset_type ADD VALUE IF NOT EXISTS 'crypto';
NOTIFY pgrst, 'reload schema';
