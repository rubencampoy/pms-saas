'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { propertyRepo } from '@/server/repositories/property.repo';

const COOKIE_KEY = 'chamelio-property-id';

/**
 * Switch the active property for the current user session.
 * Validates that the property belongs to the user's organization.
 */
export async function switchProperty(propertyId: string) {
  const session = await auth();
  if (!session?.user) return;

  // Validate property belongs to user's org
  const property = await propertyRepo.findById(session.user.organizationId, propertyId);
  if (!property) return;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEY, propertyId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}

/**
 * Read the selected property ID from cookies (server-side).
 * Returns the raw cookie value (may be stale/invalid — caller must validate).
 */
export async function getSelectedPropertyId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_KEY)?.value ?? null;
}
