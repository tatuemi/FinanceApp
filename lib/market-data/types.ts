export type MarketQuote = {
  symbol: string;
  price: string;
  currency: 'USD';
  marketTime: string | null;
  fetchedAt: string;
  provider: string;
};

export type PriceCandle = {
  time: number; // Unix timestamp en segundos (UTC) compatible con lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type HistoryRange = '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface MarketDataProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  getQuote(symbol: string): Promise<MarketQuote>;
  getHistory(symbol: string, range: HistoryRange): Promise<PriceCandle[]>;
}

export type MarketDataErrorCode =
  | 'PROVIDER_UNCONFIGURED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_SYMBOL'
  | 'PROVIDER_FORBIDDEN'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE';

export class MarketDataError extends Error {
  public readonly code: MarketDataErrorCode;
  public readonly statusCode: number;
  public readonly provider: string;

  constructor(
    message: string,
    code: MarketDataErrorCode,
    statusCode: number,
    provider: string
  ) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider;
  }
}
