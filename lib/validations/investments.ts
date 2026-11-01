import { z } from 'zod';
import Decimal from 'decimal.js';

const entityIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, 'Identificador de entidad inválido.');

const dateIsoSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD.')
  .refine((val) => {
    const [y, m, d] = val.split('-').map(Number);
    if (!y || !m || !d) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, 'Fecha calendario inválida.');

export const investmentAssetSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9.-]{1,20}$/.test(v), {
      message: 'El símbolo bursátil debe tener entre 1 y 20 caracteres alfanuméricos (ej. AAPL, QQQ, BRK.B).',
    }),
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del activo es obligatorio.')
    .max(150, 'El nombre no puede exceder 150 caracteres.'),
  assetType: z.enum(['stock', 'etf'], {
    errorMap: () => ({ message: 'Selecciona si el activo es Acción (Stock) o ETF.' }),
  }),
  exchange: z
    .string()
    .trim()
    .max(50, 'El mercado o bolsa no puede exceder 50 caracteres.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  providerSymbol: z
    .string()
    .trim()
    .max(30, 'El símbolo del proveedor no puede exceder 30 caracteres.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  currency: z.literal('USD').default('USD'),
});

export type InvestmentAssetInput = z.infer<typeof investmentAssetSchema>;

const positivePriceSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d{1,8})?$/.test(v), {
    message: 'El precio por título debe ser positivo con hasta 8 decimales.',
  })
  .refine(
    (v) => {
      try {
        const d = new Decimal(v);
        return d.isFinite() && d.greaterThan(0) && d.lessThanOrEqualTo('999999999999.99999999');
      } catch {
        return false;
      }
    },
    { message: 'El precio por título debe ser mayor que 0.' }
  )
  .transform((v) => new Decimal(v).toFixed(8));

const nonNegativeFeeSchema = z
  .union([z.string(), z.number()])
  .optional()
  .default('0')
  .transform((v) => {
    const s = String(v ?? '0').trim();
    return s === '' ? '0' : s;
  })
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), {
    message: 'La comisión debe ser un importe mayor o igual a 0 con hasta 4 decimales.',
  })
  .refine(
    (v) => {
      try {
        const d = new Decimal(v);
        return d.isFinite() && d.greaterThanOrEqualTo(0);
      } catch {
        return false;
      }
    },
    { message: 'La comisión no puede ser negativa.' }
  )
  .transform((v) => new Decimal(v).toFixed(4));

/**
 * Esquema de registro de compras y ventas.
 * Admite entrada por `quantity` (cantidad de títulos, incluidas fracciones)
 * o por `inputMode = 'amount'` (`totalAmount` / `pricePerShare`).
 */
export const investmentTransactionSchema = z
  .object({
    assetId: entityIdSchema,
    transactionType: z.enum(['buy', 'sell'], {
      errorMap: () => ({ message: 'El tipo de operación debe ser compra o venta.' }),
    }),
    tradeDate: dateIsoSchema,
    inputMode: z.enum(['quantity', 'amount']).default('quantity'),
    quantity: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v !== undefined && v !== null ? String(v).trim() : '')),
    totalAmount: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v !== undefined && v !== null ? String(v).trim() : '')),
    pricePerShare: positivePriceSchema,
    fees: nonNegativeFeeSchema,
    notes: z
      .string()
      .trim()
      .max(1000, 'Las notas no pueden superar los 1000 caracteres.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    if (data.inputMode === 'amount') {
      if (!data.totalAmount || !/^\d+(\.\d{1,4})?$/.test(data.totalAmount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalAmount'],
          message: 'Introduce un importe en dólares válido (hasta 4 decimales).',
        });
        return;
      }
      const amt = new Decimal(data.totalAmount);
      if (amt.lessThanOrEqualTo(0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalAmount'],
          message: 'El importe de la operación debe ser mayor que $0.00.',
        });
        return;
      }
      const price = new Decimal(data.pricePerShare);
      const computedQty = amt.div(price).toDP(10, Decimal.ROUND_HALF_UP);
      if (computedQty.lessThanOrEqualTo(0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalAmount'],
          message: 'El importe respecto al precio produce una cantidad de títulos nula.',
        });
      }
    } else {
      if (!data.quantity || !/^\d+(\.\d{1,10})?$/.test(data.quantity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantity'],
          message: 'Introduce una cantidad de títulos positiva (admite fracciones de hasta 10 decimales).',
        });
        return;
      }
      const qty = new Decimal(data.quantity);
      if (qty.lessThanOrEqualTo(0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantity'],
          message: 'La cantidad de títulos debe ser mayor que 0.',
        });
      }
    }
  })
  .transform((data) => {
    const price = new Decimal(data.pricePerShare);
    const resolvedQty =
      data.inputMode === 'amount'
        ? new Decimal(data.totalAmount!).div(price).toDP(10, Decimal.ROUND_HALF_UP)
        : new Decimal(data.quantity!).toDP(10, Decimal.ROUND_HALF_UP);

    const grossAmount = resolvedQty.mul(price).toDP(4, Decimal.ROUND_HALF_UP);

    return {
      assetId: data.assetId,
      transactionType: data.transactionType,
      tradeDate: data.tradeDate,
      quantity: resolvedQty.toFixed(10),
      pricePerShare: price.toFixed(8),
      fees: data.fees,
      grossAmount: grossAmount.toFixed(4),
      notes: data.notes,
    };
  });

export type InvestmentTransactionValidated = z.output<typeof investmentTransactionSchema>;
export type InvestmentTransactionRawInput = z.input<typeof investmentTransactionSchema>;

export const manualQuoteSchema = z.object({
  assetId: entityIdSchema,
  price: positivePriceSchema,
  referenceDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || !Number.isNaN(new Date(v).getTime()),
      'Fecha de referencia inválida.'
    ),
});

export type ManualQuoteInput = z.infer<typeof manualQuoteSchema>;

export const investmentHistoryFilterSchema = z.object({
  assetId: z
    .string()
    .trim()
    .optional()
    .default('all')
    .refine((v) => v === 'all' || /^[1-9]\d*$/.test(v), 'Activo inválido.'),
  transactionType: z.enum(['all', 'buy', 'sell']).optional().default('all'),
  startDate: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inicial inválida.'),
  endDate: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha final inválida.'),
  sortOrder: z.enum(['desc', 'asc']).optional().default('desc'),
});

export type InvestmentHistoryFilterInput = z.infer<typeof investmentHistoryFilterSchema>;
