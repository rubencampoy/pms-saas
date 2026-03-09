'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { createGuestSchema, updateGuestSchema } from '@/lib/validators/guest';
import { guestRepo } from '@/server/repositories/guest.repo';
import type { ActionResult } from '@/types/actions';
import type { CreateGuestInput, UpdateGuestInput } from '@/lib/validators/guest';

export async function getGuests() {
  const session = await auth();
  if (!session?.user) return [];

  return guestRepo.findAll(session.user.organizationId);
}

export async function searchGuests(query: string) {
  const session = await auth();
  if (!session?.user) return [];

  if (!query.trim()) {
    return guestRepo.findAll(session.user.organizationId);
  }

  return guestRepo.search(session.user.organizationId, query.trim());
}

export async function getGuestById(id: string) {
  const session = await auth();
  if (!session?.user) return null;

  return guestRepo.findById(session.user.organizationId, id);
}

export async function checkDuplicateGuests(
  email?: string,
  documentType?: string,
  documentNumber?: string,
) {
  const session = await auth();
  if (!session?.user) return [];

  return guestRepo.findDuplicates(
    session.user.organizationId,
    email || undefined,
    documentType || undefined,
    documentNumber || undefined,
  );
}

export async function createGuest(
  input: CreateGuestInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = createGuestSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // Clean empty strings to undefined
    const data = cleanEmptyStrings(validated.data);

    const guest = await guestRepo.create(session.user.organizationId, data);

    revalidatePath('/guests');
    return { success: true, data: { id: guest.id } };
  } catch (error) {
    console.error('createGuest failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateGuest(
  input: UpdateGuestInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = updateGuestSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...rawData } = validated.data;
    const data = cleanEmptyStrings(rawData);

    const guest = await guestRepo.update(session.user.organizationId, id, data);

    if (!guest) {
      return { success: false, error: 'Guest not found' };
    }

    revalidatePath('/guests');
    return { success: true, data: { id: guest.id } };
  } catch (error) {
    console.error('updateGuest failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteGuest(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const guest = await guestRepo.delete(session.user.organizationId, id);

    if (!guest) {
      return { success: false, error: 'Guest not found' };
    }

    revalidatePath('/guests');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteGuest failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/** Strip empty strings so they become undefined (DB null) */
function cleanEmptyStrings<T extends Record<string, unknown>>(obj: T): T {
  const cleaned = { ...obj };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === '') {
      (cleaned as Record<string, unknown>)[key] = undefined;
    }
  }
  return cleaned;
}
