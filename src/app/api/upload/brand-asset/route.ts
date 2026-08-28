import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { getStorageProvider } from '@/lib/storage';
import { propertyRepo } from '@/server/repositories/property.repo';
import { ForbiddenError } from '@/lib/errors';
import { BRAND_ASSET_RULES, uploadBrandAssetSchema } from '@/lib/validators/brand-asset';

/**
 * Sube un asset de imagen corporativa (logo, favicon o portada) del motor de
 * reservas de una propiedad. Devuelve la URL pública; guardarla en los ajustes
 * es cosa de la Server Action de booking-engine-settings.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticar
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // 2. Autorizar
    try {
      requireRole(session.user.role, ['admin', 'manager']);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: 'Sin permisos para cambiar la imagen corporativa' },
          { status: 403 },
        );
      }
      throw error;
    }

    const organizationId = session.user.organizationId;

    // 3. Validar metadatos
    const formData = await request.formData();
    const file = formData.get('file');
    const validated = uploadBrandAssetSchema.safeParse({
      propertyId: formData.get('propertyId'),
      kind: formData.get('kind'),
    });
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
    const { propertyId, kind } = validated.data;

    // 4. La propiedad tiene que ser de la organización de quien sube
    const property = await propertyRepo.findById(organizationId, propertyId);
    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Propiedad no encontrada' },
        { status: 404 },
      );
    }

    // 5. Validar el fichero
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No se ha recibido ningún fichero' },
        { status: 422 },
      );
    }
    const rule = BRAND_ASSET_RULES[kind];
    if (!rule.types.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Formato no admitido para ${kind}: ${file.type}` },
        { status: 422 },
      );
    }
    if (file.size > rule.maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `El fichero supera el máximo de ${Math.round(rule.maxSize / 1024)} KB`,
        },
        { status: 422 },
      );
    }

    // 6. Subir
    const storage = getStorageProvider();
    const { url } = await storage.upload(file, `uploads/brand/${organizationId}/${propertyId}`);

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error('POST /api/upload/brand-asset failed:', error);
    return NextResponse.json(
      { success: false, error: 'Error inesperado al subir el fichero' },
      { status: 500 },
    );
  }
}
