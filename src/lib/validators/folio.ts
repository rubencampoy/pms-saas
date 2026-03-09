import { z } from 'zod';

export const addChargeSchema = z.object({
  folioId: z.string().uuid('Invalid folio ID'),
  type: z.enum([
    'room_charge', 'supplement', 'minibar', 'restaurant',
    'damage', 'tax', 'discount', 'adjustment',
  ], { message: 'Invalid charge type' }),
  description: z.string().min(1, 'Description is required').max(500),
  date: z.string().date('Invalid date'),
  quantity: z.number().int().min(1).max(100).default(1),
  unitPrice: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Invalid unit price'),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid tax rate').default('10'),
});

export const addPaymentSchema = z.object({
  folioId: z.string().uuid('Invalid folio ID'),
  method: z.enum([
    'cash', 'credit_card', 'debit_card',
    'bank_transfer', 'online', 'other',
  ], { message: 'Invalid payment method' }),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const closeFolioSchema = z.object({
  folioId: z.string().uuid('Invalid folio ID'),
});

export type AddChargeInput = z.infer<typeof addChargeSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type CloseFolioInput = z.infer<typeof closeFolioSchema>;
