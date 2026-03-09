'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { getStorageProvider } from '@/lib/storage';
import { roomTypeImageRepo } from '@/server/repositories/room-type-image.repo';
import {
  deleteRoomTypeImageSchema,
  reorderRoomTypeImagesSchema,
  setCoverImageSchema,
} from '@/lib/validators/room-type-image';
import type { ActionResult } from '@/types/actions';

export async function deleteRoomTypeImage(
  input: { imageId: string },
): Promise<ActionResult> {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    // 2. Authorize
    requireRole(session.user.role, ['admin', 'manager']);

    // 3. Validate
    const validated = deleteRoomTypeImageSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const organizationId = session.user.organizationId;

    // 4. Execute
    const image = await roomTypeImageRepo.findById(organizationId, validated.data.imageId);
    if (!image) return { success: false, error: 'Imagen no encontrada' };

    // Delete file from storage
    const storage = getStorageProvider();
    await storage.delete(image.url);

    // Delete DB record
    await roomTypeImageRepo.delete(organizationId, validated.data.imageId);

    // If deleted image was cover, promote the first remaining image
    if (image.isCover) {
      const remaining = await roomTypeImageRepo.findByRoomType(organizationId, image.roomTypeId);
      if (remaining.length > 0 && remaining[0]) {
        await roomTypeImageRepo.setCover(organizationId, remaining[0].id);
      }
    }

    // 5. Revalidate
    revalidatePath('/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteRoomTypeImage failed:', error);
    return { success: false, error: 'Error al eliminar la imagen' };
  }
}

export async function reorderRoomTypeImages(
  input: { roomTypeId: string; imageIds: string[] },
): Promise<ActionResult> {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    // 2. Authorize
    requireRole(session.user.role, ['admin', 'manager']);

    // 3. Validate
    const validated = reorderRoomTypeImagesSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const organizationId = session.user.organizationId;

    // 4. Execute — update sort order for each image
    const updates = validated.data.imageIds.map((imageId, index) =>
      roomTypeImageRepo.updateSortOrder(organizationId, imageId, index),
    );
    await Promise.all(updates);

    // 5. Revalidate
    revalidatePath('/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('reorderRoomTypeImages failed:', error);
    return { success: false, error: 'Error al reordenar las imágenes' };
  }
}

export async function setCoverImage(
  input: { imageId: string; roomTypeId: string },
): Promise<ActionResult> {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    // 2. Authorize
    requireRole(session.user.role, ['admin', 'manager']);

    // 3. Validate
    const validated = setCoverImageSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const organizationId = session.user.organizationId;

    // 4. Execute
    const image = await roomTypeImageRepo.findById(organizationId, validated.data.imageId);
    if (!image) return { success: false, error: 'Imagen no encontrada' };

    // Clear existing cover, then set the new one
    await roomTypeImageRepo.clearCover(organizationId, validated.data.roomTypeId);
    await roomTypeImageRepo.setCover(organizationId, validated.data.imageId);

    // 5. Revalidate
    revalidatePath('/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('setCoverImage failed:', error);
    return { success: false, error: 'Error al establecer la imagen de portada' };
  }
}
