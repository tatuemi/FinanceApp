import { z } from 'zod';
import Decimal from 'decimal.js';

export const CATEGORY_ICON_OPTIONS = [
  { value: 'wallet', label: 'Billetera' },
  { value: 'briefcase', label: 'Trabajo / Sueldo' },
  { value: 'laptop', label: 'Freelance / Tecnología' },
  { value: 'plus-circle', label: 'Ingreso extra' },
  { value: 'utensils', label: 'Alimentación' },
  { value: 'car', label: 'Transporte' },
  { value: 'zap', label: 'Servicios / Luz' },
  { value: 'graduation-cap', label: 'Educación' },
  { value: 'coffee', label: 'Comida / Café' },
  { value: 'users', label: 'Salida amigos' },
  { value: 'gamepad-2', label: 'Ocio' },
  { value: 'home', label: 'Hogar / Alquiler' },
  { value: 'heart-pulse', label: 'Salud' },
  { value: 'shopping-bag', label: 'Compras' },
  { value: 'plane', label: 'Viajes' },
  { value: 'tag', label: 'Otros' },
] as const;

export const ALLOWED_CATEGORY_ICONS = CATEGORY_ICON_OPTIONS.map((i) => i.value);

export const CATEGORY_COLOR_OPTIONS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#64748b', // Slate
] as const;

const entityIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, 'Identificador numérico inválido.');

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

const positiveMonetaryAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), {
    message: 'El importe debe ser un número positivo con hasta 4 decimales.',
  })
  .refine(
    (v) => {
      try {
        const d = new Decimal(v);
        return d.isFinite() && d.greaterThan(0) && d.lessThanOrEqualTo('999999999999999.9999');
      } catch {
        return false;
      }
    },
    {
      message: 'El importe debe ser mayor que $0.00.',
    }
  )
  .transform((v) => new Decimal(v).toFixed(4));

export const financeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre de la categoría es obligatorio.')
    .max(80, 'El nombre no puede superar los 80 caracteres.'),
  kind: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'Selecciona si la categoría es de ingreso o de gasto.' }),
  }),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato hexadecimal (#RRGGBB).')
    .default('#64748b'),
  icon: z
    .string()
    .trim()
    .refine((val) => (ALLOWED_CATEGORY_ICONS as readonly string[]).includes(val), {
      message: 'Selecciona un icono válido de la lista.',
    })
    .default('wallet'),
});

export type FinanceCategoryInput = z.infer<typeof financeCategorySchema>;

export const financeTransactionSchema = z.object({
  categoryId: entityIdSchema,
  transactionType: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'El tipo de operación debe ser ingreso o gasto.' }),
  }),
  amount: positiveMonetaryAmountSchema,
  transactionDate: dateIsoSchema,
  description: z
    .string()
    .trim()
    .min(1, 'La descripción es obligatoria.')
    .max(200, 'La descripción no puede superar los 200 caracteres.'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Las notas no pueden superar los 1000 caracteres.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type FinanceTransactionInput = z.infer<typeof financeTransactionSchema>;

export const financeHistoryFilterSchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  transactionType: z.enum(['all', 'income', 'expense']).optional().default('all'),
  categoryId: z
    .string()
    .trim()
    .optional()
    .default('all')
    .refine((v) => v === 'all' || /^[1-9]\d*$/.test(v), 'Categoría de filtro inválida.'),
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
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(15),
});

export type FinanceHistoryFilterInput = z.infer<typeof financeHistoryFilterSchema>;

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'El nombre no puede estar vacío.')
    .max(120, 'El nombre no puede exceder 120 caracteres.'),
  baseCurrency: z.literal('USD').default('USD'),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
