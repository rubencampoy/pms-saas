'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { createUnitSchema, updateUnitSchema } from '@/lib/validators/unit';
import { unitRepo } from '@/server/repositories/unit.repo';
import type { ActionResult } from '@/types/actions';
import type { CreateUnitInput, UpdateUnitInput } from '@/lib/validators/unit';

export async function getUnitsByRoomType(roomTypeId: string) {
  const session = await auth();
  if (!session?.user) return [];

  return unitRepo.findByRoomType(session.user.organizationId, roomTypeId);
}

export async function createUnit(
  input: CreateUnitInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createUnitSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const unit = await unitRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath('/settings/room-types');
    return { success: true, data: { id: unit.id } };
  } catch (error) {
    console.error('createUnit failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateUnit(
  input: UpdateUnitInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = updateUnitSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const unit = await unitRepo.update(
      session.user.organizationId,
      id,
      data,
    );

    if (!unit) {
      return { success: false, error: 'Unit not found' };
    }

    revalidatePath('/settings/room-types');
    return { success: true, data: { id: unit.id } };
  } catch (error) {
    console.error('updateUnit failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteUnit(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const unit = await unitRepo.delete(session.user.organizationId, id);

    if (!unit) {
      return { success: false, error: 'Unit not found' };
    }

    revalidatePath('/settings/room-types');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteUnit failed:', error);

    const cause = error instanceof Error ? (error as { cause?: { code?: string } }).cause : undefined;
    if (cause?.code === '23503') {
      return {
        success: false,
        error: 'No se puede eliminar esta habitación porque tiene tareas de housekeeping u otros registros asociados. Elimínalos primero.',
      };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
