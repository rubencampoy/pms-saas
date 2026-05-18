'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import {
  createReservationSchema,
  changeReservationStatusSchema,
  assignUnitSchema,
  availabilityCheckSchema,
  moveReservationSchema,
  unassignRoomSchema,
  updateReservationNotesSchema,
  updateReservationSchema,
} from '@/lib/validators/reservation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { folioRepo } from '@/server/repositories/folio.repo';
import { reservationService } from '@/server/services/reservation.service';
import { ratePlanRepo } from '@/server/repositories/rate-plan.repo';
import { rateRepo } from '@/server/repositories/rate.repo';
import { ReservationStatus } from '@/lib/constants/reservation';
import { differenceInDays, addDays, format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import type { CreateReservationInput, ChangeReservationStatusInput, UpdateReservationNotesInput, UpdateReservationInput } from '@/lib/validators/reservation';

export async function getReservations(options?: {
  propertyId?: string;
  status?: string[];
}) {
  const session = await auth();
  if (!session?.user) return [];

  return reservationRepo.findAll(session.user.organizationId, options);
}

export async function getReservationsByDateRange(
  propertyId: string,
  startDate: string,
  endDate: string,
) {
  const session = await auth();
  if (!session?.user) return [];

  return reservationRepo.findByDateRange(
    session.user.organizationId,
    propertyId,
    startDate,
    endDate,
  );
}

export async function searchReservations(query: string) {
  const session = await auth();
  if (!session?.user) return [];

  if (!query.trim()) {
    return reservationRepo.findAll(session.user.organizationId);
  }

  return reservationRepo.search(session.user.organizationId, query.trim());
}

export async function checkAvailability(
  input: { roomTypeId: string; checkInDate: string; checkOutDate: string },
): Promise<ActionResult<{ totalUnits: number; blockedUnits: number; availableUnits: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const validated = availabilityCheckSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const result = await reservationService.checkAvailability(
      session.user.organizationId,
      validated.data.roomTypeId,
      validated.data.checkInDate,
      validated.data.checkOutDate,
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('checkAvailability failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function calculateStayPrice(
  input: { propertyId: string; roomTypeId: string; checkInDate: string; checkOutDate: string },
): Promise<ActionResult<{ totalAmount: string; nightlyRates: { date: string; amount: string }[]; ratePlanName: string; minStay: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const orgId = session.user.organizationId;

    // Find the highest-priority active rate plan for this property
    const plans = await ratePlanRepo.findByProperty(orgId, input.propertyId);
    const activePlan = plans.find((p) => p.isActive);
    if (!activePlan) {
      return { success: false, error: 'No active rate plan found for this property' };
    }

    // Rates are per-night: checkIn is first night, checkOut-1 is last night
    const lastNight = format(addDays(new Date(input.checkOutDate), -1), 'yyyy-MM-dd');

    const rates = await rateRepo.findByRatePlanAndRoomType(
      orgId,
      activePlan.id,
      input.roomTypeId,
      input.checkInDate,
      lastNight,
    );

    if (rates.length === 0) {
      return { success: false, error: 'No rates configured for these dates' };
    }

    const nightlyRates = rates.map((r) => ({
      date: r.date,
      amount: r.amount,
    }));

    const totalAmount = rates
      .reduce((sum, r) => sum + parseFloat(r.amount), 0)
      .toFixed(2);

    const minStay = Math.max(...rates.map((r) => r.minStay));

    return {
      success: true,
      data: { totalAmount, nightlyRates, ratePlanName: activePlan.name, minStay },
    };
  } catch (error) {
    console.error('calculateStayPrice failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<ActionResult<{ id: string; confirmationCode: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = createReservationSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const reservation = await reservationService.create(
      session.user.organizationId,
      {
        ...validated.data,
        specialRequests: validated.data.specialRequests || undefined,
        internalNotes: validated.data.internalNotes || undefined,
      },
    );

    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return {
      success: true,
      data: { id: reservation.id, confirmationCode: reservation.confirmationCode },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('createReservation failed:', error);
    return { success: false, error: message };
  }
}

export async function changeReservationStatus(
  input: ChangeReservationStatusInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = changeReservationStatusSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const reservation = await reservationService.changeStatus(
      session.user.organizationId,
      validated.data.id,
      validated.data.status as ReservationStatus,
      validated.data.reason,
    );

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('changeReservationStatus failed:', error);
    return { success: false, error: message };
  }
}

export async function assignUnit(
  input: { reservationId: string; unitId: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = assignUnitSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const reservation = await reservationService.assignUnit(
      session.user.organizationId,
      validated.data.reservationId,
      validated.data.unitId,
    );

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('assignUnit failed:', error);
    return { success: false, error: message };
  }
}

export async function moveReservation(
  input: { reservationId: string; unitId: string; checkInDate: string; checkOutDate: string; newTotalAmount?: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = moveReservationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const reservation = await reservationService.moveReservation(
      session.user.organizationId,
      validated.data.reservationId,
      {
        unitId: validated.data.unitId,
        checkInDate: validated.data.checkInDate,
        checkOutDate: validated.data.checkOutDate,
        newTotalAmount: validated.data.newTotalAmount,
      },
    );

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('moveReservation failed:', error);
    return { success: false, error: message };
  }
}

export async function unassignRoom(
  input: { reservationId: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = unassignRoomSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const reservation = await reservationService.unassignUnit(
      session.user.organizationId,
      validated.data.reservationId,
    );

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('unassignRoom failed:', error);
    return { success: false, error: message };
  }
}

export async function getReservationFolioSummary(
  reservationId: string,
): Promise<ActionResult<{ folioId: string; total: string; paidAmount: string; balance: string } | null>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const folio = await folioRepo.findByReservation(session.user.organizationId, reservationId);
    if (!folio) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        folioId: folio.id,
        total: folio.total,
        paidAmount: folio.paidAmount,
        balance: folio.balance,
      },
    };
  } catch (error) {
    console.error('getReservationFolioSummary failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateReservationNotes(
  input: UpdateReservationNotesInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = updateReservationNotesSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid input' };
    }

    const reservation = await reservationRepo.update(
      session.user.organizationId,
      validated.data.id,
      { internalNotes: validated.data.internalNotes },
    );

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath(`/reservations/${validated.data.id}`);

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('updateReservationNotes failed:', error);
    return { success: false, error: message };
  }
}

export async function updateReservation(
  input: UpdateReservationInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = updateReservationSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...fields } = validated.data;
    const orgId = session.user.organizationId;

    // Only allow editing confirmed/checked_in reservations
    const existing = await reservationRepo.findById(orgId, id);
    if (!existing) {
      return { success: false, error: 'Reservation not found' };
    }
    if (existing.status !== 'confirmed' && existing.status !== 'checked_in') {
      return { success: false, error: `Cannot edit a reservation with status '${existing.status}'` };
    }

    // Recalculate nights if dates changed
    const updateData: Record<string, unknown> = { ...fields };
    const checkIn = fields.checkInDate ?? existing.checkInDate;
    const checkOut = fields.checkOutDate ?? existing.checkOutDate;
    if (fields.checkInDate || fields.checkOutDate) {
      const nights = differenceInDays(new Date(checkOut), new Date(checkIn));
      if (nights <= 0) {
        return { success: false, error: 'Check-out date must be after check-in date' };
      }
      updateData.nights = nights;
    }

    const reservation = await reservationRepo.update(orgId, id, updateData as Parameters<typeof reservationRepo.update>[2]);

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    revalidatePath('/reservations');
    revalidatePath(`/reservations/${id}`);
    revalidatePath('/calendar');

    return { success: true, data: { id: reservation.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('updateReservation failed:', error);
    return { success: false, error: message };
  }
}
