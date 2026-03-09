'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import {
  createHousekeepingTaskSchema,
  updateHousekeepingTaskStatusSchema,
  assignHousekeepingTaskSchema,
  updateUnitHousekeepingStatusSchema,
} from '@/lib/validators/housekeeping';
import { housekeepingTaskRepo } from '@/server/repositories/housekeeping-task.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import type { ActionResult } from '@/types/actions';
import type {
  CreateHousekeepingTaskInput,
  UpdateHousekeepingTaskStatusInput,
  AssignHousekeepingTaskInput,
  UpdateUnitHousekeepingStatusInput,
} from '@/lib/validators/housekeeping';

export async function createHousekeepingTask(
  input: CreateHousekeepingTaskInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = createHousekeepingTaskSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const task = await housekeepingTaskRepo.create(
      session.user.organizationId,
      validated.data,
    );

    revalidatePath('/housekeeping');
    return { success: true, data: { id: task.id } };
  } catch (error) {
    console.error('createHousekeepingTask failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateHousekeepingTaskStatus(
  input: UpdateHousekeepingTaskStatusInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk', 'housekeeping']);

    const validated = updateHousekeepingTaskStatusSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const existing = await housekeepingTaskRepo.findById(
      session.user.organizationId,
      validated.data.id,
    );
    if (!existing) {
      return { success: false, error: 'Task not found' };
    }

    const updateData: Record<string, unknown> = { status: validated.data.status };

    if (validated.data.status === 'in_progress' && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (validated.data.status === 'completed') {
      updateData.completedAt = new Date();
    }

    const task = await housekeepingTaskRepo.update(
      session.user.organizationId,
      validated.data.id,
      updateData as { status: string; startedAt?: Date; completedAt?: Date },
    );

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // When a cleaning task is completed, update the unit's housekeeping status to 'clean'
    if (validated.data.status === 'completed') {
      if (existing.type === 'checkout_clean' || existing.type === 'stay_over' || existing.type === 'deep_clean') {
        await unitRepo.update(session.user.organizationId, existing.unitId, {
          housekeepingStatus: 'clean',
        });

        // Auto-create inspection task after checkout_clean or deep_clean
        if (existing.type === 'checkout_clean' || existing.type === 'deep_clean') {
          await housekeepingTaskRepo.create(session.user.organizationId, {
            propertyId: existing.propertyId,
            unitId: existing.unitId,
            type: 'inspection',
            priority: 'normal',
            scheduledDate: existing.scheduledDate,
            notes: `Auto-generated: inspection after ${existing.type.replace('_', ' ')}.`,
          });
        }
      }
      // When an inspection task is completed, set unit to 'inspected'
      if (existing.type === 'inspection') {
        await unitRepo.update(session.user.organizationId, existing.unitId, {
          housekeepingStatus: 'inspected',
        });
      }
    }

    // When task starts, set unit to 'cleaning'
    if (validated.data.status === 'in_progress' && existing.type !== 'inspection') {
      await unitRepo.update(session.user.organizationId, existing.unitId, {
        housekeepingStatus: 'cleaning',
      });
    }

    revalidatePath('/housekeeping');
    revalidatePath('/calendar');
    return { success: true, data: { id: task.id } };
  } catch (error) {
    console.error('updateHousekeepingTaskStatus failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function assignHousekeepingTask(
  input: AssignHousekeepingTaskInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    const validated = assignHousekeepingTaskSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const task = await housekeepingTaskRepo.update(
      session.user.organizationId,
      validated.data.id,
      { assignedTo: validated.data.assignedTo },
    );

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    revalidatePath('/housekeeping');
    return { success: true, data: { id: task.id } };
  } catch (error) {
    console.error('assignHousekeepingTask failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateUnitHousekeepingStatus(
  input: UpdateUnitHousekeepingStatusInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager', 'front_desk', 'housekeeping']);

    const validated = updateUnitHousekeepingStatusSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const unit = await unitRepo.update(
      session.user.organizationId,
      validated.data.unitId,
      { housekeepingStatus: validated.data.housekeepingStatus },
    );

    if (!unit) {
      return { success: false, error: 'Unit not found' };
    }

    revalidatePath('/housekeeping');
    revalidatePath('/calendar');
    return { success: true, data: { id: unit.id } };
  } catch (error) {
    console.error('updateUnitHousekeepingStatus failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
