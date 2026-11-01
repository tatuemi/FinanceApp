import Decimal from 'decimal.js';

// Configuración global de Decimal.js con alta precisión para evitar errores de redondeo intermedio
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Normaliza un identificador BIGINT (representado como string o bigint) a cadena opaca.
 * Evita conversiones innecesarias a `number` de JavaScript que pierden precisión sobre 2^53 - 1.
 */
export function normalizeEntityId(value: string | bigint | number): string {
  const raw = String(value).trim();
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`Identificador de entidad inválido: ${raw}`);
  }
  return raw;
}

/**
 * Formatea un importe monetario en USD con 2 decimales (o hasta 4 si tiene fracciones relevantes).
 */
export function formatCurrencyUSD(
  value: string | number | Decimal | null | undefined,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number; showSign?: boolean }
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  try {
    const dec = new Decimal(value);
    const minDigits = options?.minimumFractionDigits ?? 2;
    const maxDigits = options?.maximumFractionDigits ?? 2;
    const isNeg = dec.isNegative() && !dec.isZero();
    const absNum = dec.abs().toDP(maxDigits, Decimal.ROUND_HALF_UP).toNumber();

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(absNum);

    if (isNeg) {
      return `-${formatted}`;
    }
    if (options?.showSign && dec.greaterThan(0)) {
      return `+${formatted}`;
    }
    return formatted;
  } catch {
    return '—';
  }
}

/**
 * Formatea precios unitarios de activos (2 a 4 decimales según precisión).
 */
export function formatSharePriceUSD(value: string | number | Decimal | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  try {
    const dec = new Decimal(value);
    const hasSubCent = !dec.mul(100).isInteger();
    return formatCurrencyUSD(dec, {
      minimumFractionDigits: 2,
      maximumFractionDigits: hasSubCent ? 4 : 2,
    });
  } catch {
    return '—';
  }
}

/**
 * Formatea una cantidad de títulos admitiendo fracciones hasta 8 decimales sin ceros finales innecesarios.
 */
export function formatShareQuantity(value: string | number | Decimal | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }
  try {
    const dec = new Decimal(value);
    if (dec.isZero()) return '0';
    // Redondear a máximo 8 decimales para presentación y eliminar ceros a la derecha
    const fixed = dec.toDP(8, Decimal.ROUND_HALF_UP).toFixed();
    const parts = fixed.split('.');
    const intPart = Number(parts[0] ?? '0').toLocaleString('en-US');
    if (parts[1]) {
      return `${intPart}.${parts[1]}`;
    }
    return intPart;
  } catch {
    return '0';
  }
}

/**
 * Formatea un porcentaje con signo opcional. Devuelve 'N/A' si es nulo (por ejemplo, cuando costo base es 0).
 */
export function formatPercentage(
  value: string | number | Decimal | null | undefined,
  options?: { showSign?: boolean; decimals?: number }
): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  try {
    const dec = new Decimal(value);
    const decimals = options?.decimals ?? 2;
    const rounded = dec.toDP(decimals, Decimal.ROUND_HALF_UP);
    const prefix = options?.showSign && rounded.greaterThan(0) ? '+' : '';
    return `${prefix}${rounded.toFixed(decimals)}%`;
  } catch {
    return 'N/A';
  }
}

/**
 * Formatea una fecha YYYY-MM-DD sin desfases de zona horaria.
 */
export function formatDateISOToDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    const [, year, month, day] = match;
    const months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ];
    const mIdx = Number(month) - 1;
    return `${Number(day)} ${months[mIdx] ?? month} ${year}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formatea una marca de tiempo ISO completa (con fecha y hora).
 */
export function formatTimestampToDisplay(isoStr: string | null | undefined): string {
  if (!isoStr) return 'Sin actualizar';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return 'Sin actualizar';
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Sin actualizar';
  }
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD.
 */
export function getTodayDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
