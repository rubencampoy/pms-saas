'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { bookingEngineSettingsSchema } from '@/lib/validators/booking-engine-settings';
import { bookingEngineSettingsRepo } from '@/server/repositories/booking-engine-settings.repo';
import type { ActionResult } from '@/types/actions';
import type { BookingEngineSettingsInput } from '@/lib/validators/booking-engine-settings';

export async function getBookingEngineSettings(propertyId: string) {
  const session = await auth();
  if (!session?.user) return null;

  return bookingEngineSettingsRepo.findByProperty(
    session.user.organizationId,
    propertyId,
  );
}

export async function saveBookingEngineSettings(
  input: BookingEngineSettingsInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = bookingEngineSettingsSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { propertyId, ...data } = validated.data;

    const settings = await bookingEngineSettingsRepo.upsert(
      session.user.organizationId,
      propertyId,
      data,
    );

    revalidatePath('/settings/booking-engine');
    return { success: true, data: { id: settings.id } };
  } catch (error) {
    console.error('saveBookingEngineSettings failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
