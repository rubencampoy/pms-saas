'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { createRoomBlockSchema, updateRoomBlockSchema, deleteRoomBlockSchema } from '@/lib/validators/room-block';
import { roomBlockRepo } from '@/server/repositories/room-block.repo';
import type { ActionResult } from '@/types/actions';

export async function getRoomBlocksByDateRange(
  propertyId: string,
  startDate: string,
  endDate: string,
) {
  const session = await auth();
  if (!session?.user) return [];

  return roomBlockRepo.findByPropertyAndDateRange(
    session.user.organizationId,
    propertyId,
    startDate,
    endDate,
  );
}

export async function createRoomBlock(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  // 1. Auth
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Not authenticated' };
  const orgId = session.user.organizationId;

  // 2. Validate
  const parsed = createRoomBlockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { propertyId, unitId, type, startDate, endDate, reason } = parsed.data;

  // 3. Check for overlapping blocks on same unit
  const overlapping = await roomBlockRepo.findOverlapping(orgId, unitId, startDate, endDate);
  if (overlapping.length > 0) {
    return {
      success: false,
      error: 'This unit already has a block that overlaps with the selected dates',
    };
  }

  // 3b. Check for overlapping reservations on same unit
  const resOverlaps = await roomBlockRepo.findReservationOverlaps(orgId, unitId, startDate, endDate);
  if (resOverlaps.length > 0) {
    return {
      success: false,
      error: 'Cannot block dates — there are existing reservations in this date range',
    };
  }

  // 4. Create
  const block = await roomBlockRepo.create(orgId, {
    propertyId,
    unitId,
    type,
    startDate,
    endDate,
    reason: reason || undefined,
    createdBy: session.user.id,
  });

  // 5. Revalidate
  revalidatePath('/calendar');

  return { success: true, data: { id: block.id } };
}

export async function updateRoomBlock(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  // 1. Auth
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Not authenticated' };
  const orgId = session.user.organizationId;

  // 2. Validate
  const parsed = updateRoomBlockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, type, startDate, endDate, reason } = parsed.data;

  // 3. Verify block exists
  const existing = await roomBlockRepo.findById(orgId, id);
  if (!existing) {
    return { success: false, error: 'Block not found' };
  }

  // 4. Check for overlapping blocks (exclude self)
  const overlapping = await roomBlockRepo.findOverlapping(orgId, existing.unitId, startDate, endDate, id);
  if (overlapping.length > 0) {
    return {
      success: false,
      error: 'This unit already has a block that overlaps with the selected dates',
    };
  }

  // 4b. Check for overlapping reservations on same unit
  const resOverlaps = await roomBlockRepo.findReservationOverlaps(orgId, existing.unitId, startDate, endDate);
  if (resOverlaps.length > 0) {
    return {
      success: false,
      error: 'Cannot block dates — there are existing reservations in this date range',
    };
  }

  // 5. Update
  const updated = await roomBlockRepo.update(orgId, id, {
    type,
    startDate,
    endDate,
    reason: reason || null,
  });

  if (!updated) {
    return { success: false, error: 'Failed to update block' };
  }

  // 6. Revalidate
  revalidatePath('/calendar');

  return { success: true, data: { id: updated.id } };
}

export async function deleteRoomBlock(
  input: unknown,
): Promise<ActionResult> {
  // 1. Auth
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Not authenticated' };
  const orgId = session.user.organizationId;

  // 2. Validate
  const parsed = deleteRoomBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid block ID' };
  }

  // 3. Delete
  const deleted = await roomBlockRepo.delete(orgId, parsed.data.id);
  if (!deleted) {
    return { success: false, error: 'Block not found' };
  }

  // 4. Revalidate
  revalidatePath('/calendar');

  return { success: true, data: undefined };
}
