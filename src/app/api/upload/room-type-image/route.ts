import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { getStorageProvider } from '@/lib/storage';
import { roomTypeImageRepo } from '@/server/repositories/room-type-image.repo';
import { ForbiddenError } from '@/lib/errors';
import {
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_ROOM_TYPE,
  uploadRoomTypeImageSchema,
} from '@/lib/validators/room-type-image';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 },
      );
    }

    // 2. Authorize
    try {
      requireRole(session.user.role, ['admin', 'manager']);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: 'Sin permisos para subir imágenes' },
          { status: 403 },
        );
      }
      throw error;
    }

    const organizationId = session.user.organizationId;

    // 3. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const roomTypeId = formData.get('roomTypeId') as string | null;
    const alt = (formData.get('alt') as string | null) ?? undefined;

    // 4. Validate metadata
    const validated = uploadRoomTypeImageSchema.safeParse({ roomTypeId, alt });
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
        },
        { status: 422 },
      );
    }

    // 5. Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el límite de 5MB' },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no permitido. Permitidos: JPEG, PNG, WebP' },
        { status: 400 },
      );
    }

    // 6. Check max image count
    const count = await roomTypeImageRepo.countByRoomType(
      organizationId,
      validated.data.roomTypeId,
    );
    if (count >= MAX_IMAGES_PER_ROOM_TYPE) {
      return NextResponse.json(
        { success: false, error: `Máximo ${MAX_IMAGES_PER_ROOM_TYPE} imágenes por tipo de habitación` },
        { status: 400 },
      );
    }

    // 7. Upload file
    const storage = getStorageProvider();
    const storagePath = `uploads/room-types/${organizationId}/${validated.data.roomTypeId}`;
    const uploadResult = await storage.upload(file, storagePath);

    // 8. Save metadata to DB
    const isFirstImage = count === 0;
    const image = await roomTypeImageRepo.create({
      organizationId,
      roomTypeId: validated.data.roomTypeId,
      url: uploadResult.url,
      alt: validated.data.alt,
      sortOrder: count,
      isCover: isFirstImage,
    });

    return NextResponse.json({ success: true, data: image }, { status: 201 });
  } catch (error) {
    console.error('Upload room type image failed:', error);
    return NextResponse.json(
      { success: false, error: 'Error al subir la imagen' },
      { status: 500 },
    );
  }
}
