'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import {
  createRatePlanSchema,
  updateRatePlanSchema,
  bulkSetRatesSchema,
  batchUpdateRatesSchema,
  createSeasonSchema,
  updateSeasonSchema,
  createSupplementSchema,
  updateSupplementSchema,
} from '@/lib/validators/rate';
import { ratePlanRepo } from '@/server/repositories/rate-plan.repo';
import { rateRepo } from '@/server/repositories/rate.repo';
import { seasonRepo } from '@/server/repositories/season.repo';
import { supplementRepo } from '@/server/repositories/supplement.repo';
import type { ActionResult } from '@/types/actions';
import type {
  CreateRatePlanInput,
  UpdateRatePlanInput,
  BulkSetRatesInput,
  BatchUpdateRatesInput,
  CreateSeasonInput,
  UpdateSeasonInput,
  CreateSupplementInput,
  UpdateSupplementInput,
} from '@/lib/validators/rate';

const RATES_PATH = '/settings/rates';

// ═══════════════════════════════════════════
// RATE PLANS
// ═══════════════════════════════════════════

export async function createRatePlan(
  input: CreateRatePlanInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createRatePlanSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const ratePlan = await ratePlanRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: ratePlan.id } };
  } catch (error) {
    console.error('createRatePlan failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateRatePlan(
  input: UpdateRatePlanInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = updateRatePlanSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const ratePlan = await ratePlanRepo.update(session.user.organizationId, id, data);
    if (!ratePlan) return { success: false, error: 'Rate plan not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: ratePlan.id } };
  } catch (error) {
    console.error('updateRatePlan failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteRatePlan(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const ratePlan = await ratePlanRepo.delete(session.user.organizationId, id);
    if (!ratePlan) return { success: false, error: 'Rate plan not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteRatePlan failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ═══════════════════════════════════════════
// RATES (bulk set)
// ═══════════════════════════════════════════

export async function bulkSetRates(
  input: BulkSetRatesInput,
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = bulkSetRatesSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // Upsert: inserts new rows or updates only the selected fields on existing rows
    const result = await rateRepo.bulkUpsert(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath(RATES_PATH);
    revalidatePath('/calendar');
    return { success: true, data: { count: result.length } };
  } catch (error) {
    // Extract the actual PostgreSQL error from Drizzle's error.cause
    const cause = error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : String(error);
    console.error('bulkSetRates failed:', cause, error);
    return { success: false, error: cause };
  }
}

// ═══════════════════════════════════════════
// RATES (batch cell update)
// ═══════════════════════════════════════════

export async function batchUpdateRates(
  input: BatchUpdateRatesInput,
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = batchUpdateRatesSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const result = await rateRepo.batchUpsertCells(
      session.user.organizationId,
      validated.data.changes,
    );

    revalidatePath(RATES_PATH);
    return { success: true, data: { count: result.length } };
  } catch (error) {
    console.error('batchUpdateRates failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ═══════════════════════════════════════════
// SEASONS
// ═══════════════════════════════════════════

export async function createSeason(
  input: CreateSeasonInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createSeasonSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const season = await seasonRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: season.id } };
  } catch (error) {
    console.error('createSeason failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateSeason(
  input: UpdateSeasonInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = updateSeasonSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const season = await seasonRepo.update(session.user.organizationId, id, data);
    if (!season) return { success: false, error: 'Season not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: season.id } };
  } catch (error) {
    console.error('updateSeason failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteSeason(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const season = await seasonRepo.delete(session.user.organizationId, id);
    if (!season) return { success: false, error: 'Season not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteSeason failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ═══════════════════════════════════════════
// SUPPLEMENTS
// ═══════════════════════════════════════════

export async function createSupplement(
  input: CreateSupplementInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createSupplementSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supplement = await supplementRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: supplement.id } };
  } catch (error) {
    console.error('createSupplement failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateSupplement(
  input: UpdateSupplementInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = updateSupplementSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const supplement = await supplementRepo.update(session.user.organizationId, id, data);
    if (!supplement) return { success: false, error: 'Supplement not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: { id: supplement.id } };
  } catch (error) {
    console.error('updateSupplement failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteSupplement(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    requireRole(session.user.role, ['admin', 'manager']);

    const supplement = await supplementRepo.delete(session.user.organizationId, id);
    if (!supplement) return { success: false, error: 'Supplement not found' };

    revalidatePath(RATES_PATH);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteSupplement failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
