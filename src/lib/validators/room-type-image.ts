import { z } from 'zod';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGES_PER_ROOM_TYPE = 10;

export const uploadRoomTypeImageSchema = z.object({
  roomTypeId: z.string().uuid('ID de tipo de habitación inválido'),
  alt: z.string().max(255).optional(),
});

export const reorderRoomTypeImagesSchema = z.object({
  roomTypeId: z.string().uuid('ID de tipo de habitación inválido'),
  imageIds: z.array(z.string().uuid()).min(1, 'Se requiere al menos un ID de imagen'),
});

export const setCoverImageSchema = z.object({
  imageId: z.string().uuid('ID de imagen inválido'),
  roomTypeId: z.string().uuid('ID de tipo de habitación inválido'),
});

export const deleteRoomTypeImageSchema = z.object({
  imageId: z.string().uuid('ID de imagen inválido'),
});

export type UploadRoomTypeImageInput = z.infer<typeof uploadRoomTypeImageSchema>;
export type ReorderRoomTypeImagesInput = z.infer<typeof reorderRoomTypeImagesSchema>;
export type SetCoverImageInput = z.infer<typeof setCoverImageSchema>;
export type DeleteRoomTypeImageInput = z.infer<typeof deleteRoomTypeImageSchema>;
