import type { folios, folioLineItems, payments } from '@/server/db/schema';

type FolioRow = typeof folios.$inferSelect;
type FolioLineItemRow = typeof folioLineItems.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

/** A charge on a folio. `createdBy` (the staff user) is never exposed. */
export interface FolioLineItemDto {
  id: string;
  type: string;
  description: string;
  date: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  createdAt: string;
}

/**
 * A payment against a folio.
 *
 * `notes` and `processedBy` are staff-only. `reference` is kept: it is what
 * lets a guest match a line to their own card or transfer statement.
 */
export interface PaymentDto {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  processedAt: string;
}

/**
 * The public shape of a folio. Withheld: `organizationId`, and `notes`
 * (staff-only free text).
 *
 * All monetary fields are decimal **strings**, mirroring the `numeric` columns.
 * Never parse them as floats for arithmetic.
 */
export interface FolioDto {
  id: string;
  reservationId: string;
  guestId: string;
  folioNumber: string;
  status: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  balance: string;
  currency: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: FolioLineItemDto[];
  payments?: PaymentDto[];
}

export function toFolioDto(
  row: FolioRow,
  detail?: { lineItems: FolioLineItemRow[]; payments: PaymentRow[] },
): FolioDto {
  const folio: FolioDto = {
    id: row.id,
    reservationId: row.reservationId,
    guestId: row.guestId,
    folioNumber: row.folioNumber,
    status: row.status,
    subtotal: row.subtotal,
    taxTotal: row.taxTotal,
    total: row.total,
    paidAmount: row.paidAmount,
    balance: row.balance,
    currency: row.currency,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (detail) {
    folio.lineItems = detail.lineItems.map(toFolioLineItemDto);
    folio.payments = detail.payments.map(toPaymentDto);
  }

  return folio;
}

export function toFolioLineItemDto(row: FolioLineItemRow): FolioLineItemDto {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    date: row.date,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
    taxRate: row.taxRate,
    taxAmount: row.taxAmount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    method: row.method,
    amount: row.amount,
    reference: row.reference,
    processedAt: row.processedAt.toISOString(),
  };
}
