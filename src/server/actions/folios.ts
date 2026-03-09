'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import {
  addChargeSchema,
  addPaymentSchema,
  closeFolioSchema,
} from '@/lib/validators/folio';
import { folioRepo, folioLineItemRepo, paymentRepo } from '@/server/repositories/folio.repo';
import type { ActionResult } from '@/types/actions';
import type { AddChargeInput, AddPaymentInput, CloseFolioInput } from '@/lib/validators/folio';

// ── Create folio for a reservation ──
export async function createFolio(
  reservationId: string,
  guestId: string,
): Promise<ActionResult<{ id: string; folioNumber: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const orgId = session.user.organizationId;

    // Check if folio already exists
    const existing = await folioRepo.findByReservation(orgId, reservationId);
    if (existing) {
      return { success: true, data: { id: existing.id, folioNumber: existing.folioNumber } };
    }

    const folioNumber = await folioRepo.getNextFolioNumber(orgId);
    const folio = await folioRepo.create(orgId, {
      reservationId,
      guestId,
      folioNumber,
    });

    revalidatePath('/reservations');
    return { success: true, data: { id: folio.id, folioNumber: folio.folioNumber } };
  } catch (error) {
    console.error('createFolio failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Add a charge ──
export async function addCharge(
  input: AddChargeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = addChargeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const orgId = session.user.organizationId;

    // Check folio is open
    const folio = await folioRepo.findById(orgId, validated.data.folioId);
    if (!folio) return { success: false, error: 'Folio not found' };
    if (folio.status !== 'open') return { success: false, error: 'Folio is not open' };

    const { folioId, type, description, date, quantity, unitPrice, taxRate } = validated.data;
    const amount = (quantity * parseFloat(unitPrice)).toFixed(2);
    const taxAmount = (parseFloat(amount) * parseFloat(taxRate) / 100).toFixed(2);

    const item = await folioLineItemRepo.create(orgId, {
      folioId,
      type,
      description,
      date,
      quantity,
      unitPrice,
      amount,
      taxRate,
      taxAmount,
      createdBy: session.user.id,
    });

    await folioRepo.recalculateTotals(orgId, folioId);

    revalidatePath('/reservations');
    return { success: true, data: { id: item.id } };
  } catch (error) {
    console.error('addCharge failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Remove a charge ──
export async function removeCharge(
  lineItemId: string,
  folioId: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const orgId = session.user.organizationId;

    const folio = await folioRepo.findById(orgId, folioId);
    if (!folio) return { success: false, error: 'Folio not found' };
    if (folio.status !== 'open') return { success: false, error: 'Folio is not open' };

    const item = await folioLineItemRepo.delete(orgId, lineItemId);
    if (!item) return { success: false, error: 'Line item not found' };

    await folioRepo.recalculateTotals(orgId, folioId);

    revalidatePath('/reservations');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('removeCharge failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Add a payment ──
export async function addPayment(
  input: AddPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = addPaymentSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const orgId = session.user.organizationId;

    const folio = await folioRepo.findById(orgId, validated.data.folioId);
    if (!folio) return { success: false, error: 'Folio not found' };
    if (folio.status !== 'open') return { success: false, error: 'Folio is not open' };

    const payment = await paymentRepo.create(orgId, {
      ...validated.data,
      processedBy: session.user.id,
    });

    await folioRepo.recalculateTotals(orgId, validated.data.folioId);

    revalidatePath('/reservations');
    return { success: true, data: { id: payment.id } };
  } catch (error) {
    console.error('addPayment failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Remove a payment ──
export async function removePayment(
  paymentId: string,
  folioId: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const orgId = session.user.organizationId;

    const folio = await folioRepo.findById(orgId, folioId);
    if (!folio) return { success: false, error: 'Folio not found' };
    if (folio.status !== 'open') return { success: false, error: 'Folio is not open' };

    const payment = await paymentRepo.delete(orgId, paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };

    await folioRepo.recalculateTotals(orgId, folioId);

    revalidatePath('/reservations');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('removePayment failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Close folio ──
export async function closeFolio(
  input: CloseFolioInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = closeFolioSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const orgId = session.user.organizationId;

    const folio = await folioRepo.findById(orgId, validated.data.folioId);
    if (!folio) return { success: false, error: 'Folio not found' };
    if (folio.status !== 'open') return { success: false, error: 'Folio is already closed' };

    if (parseFloat(folio.balance) !== 0) {
      return { success: false, error: `Folio has an outstanding balance of ${folio.balance} ${folio.currency}. Collect payment before closing.` };
    }

    const closed = await folioRepo.close(orgId, validated.data.folioId);
    if (!closed) return { success: false, error: 'Failed to close folio' };

    revalidatePath('/reservations');
    return { success: true, data: { id: closed.id } };
  } catch (error) {
    console.error('closeFolio failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ── Void folio ──
export async function voidFolio(
  folioId: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin']);

    const orgId = session.user.organizationId;
    const folio = await folioRepo.void_(orgId, folioId);
    if (!folio) return { success: false, error: 'Folio not found' };

    revalidatePath('/reservations');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('voidFolio failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
