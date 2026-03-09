'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { createRoomTypeSchema, updateRoomTypeSchema } from '@/lib/validators/room-type';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import type { ActionResult } from '@/types/actions';
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from '@/lib/validators/room-type';

export async function getRoomTypesByProperty(propertyId: string) {
  const session = await auth();
  if (!session?.user) return [];

  return roomTypeRepo.findByProperty(session.user.organizationId, propertyId);
}

export async function createRoomType(
  input: CreateRoomTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createRoomTypeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const roomType = await roomTypeRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath('/settings/room-types');
    return { success: true, data: { id: roomType.id } };
  } catch (error) {
    console.error('createRoomType failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateRoomType(
  input: UpdateRoomTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = updateRoomTypeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const roomType = await roomTypeRepo.update(
      session.user.organizationId,
      id,
      data,
    );

    if (!roomType) {
      return { success: false, error: 'Room type not found' };
    }

    revalidatePath('/settings/room-types');
    return { success: true, data: { id: roomType.id } };
  } catch (error) {
    console.error('updateRoomType failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteRoomType(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const roomType = await roomTypeRepo.delete(session.user.organizationId, id);

    if (!roomType) {
      return { success: false, error: 'Room type not found' };
    }

    revalidatePath('/settings/room-types');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteRoomType failed:', error);

    const cause = error instanceof Error ? (error as { cause?: { code?: string } }).cause : undefined;
    if (cause?.code === '23503') {
      return {
        success: false,
        error: 'No se puede eliminar esta categoría porque tiene habitaciones asignadas. Elimina o reasigna las habitaciones primero.',
      };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
