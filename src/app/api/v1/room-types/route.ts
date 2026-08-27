import { NextRequest } from 'next/server';
import { ApiScope } from '@/lib/constants/api';
import { listRoomTypesQuerySchema } from '@/lib/validators/api-v1';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { roomTypeImageRepo } from '@/server/repositories/room-type-image.repo';
import { apiInvalidRequest, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { resolvePropertyScope } from '@/server/api/scope';
import { toRoomTypeDto } from '@/server/api/v1/dto/room-type.dto';

/**
 * GET /api/v1/room-types
 *
 * Query: propertyId
 */
export const GET = withApiKey(
  ApiScope.ROOM_TYPES_READ,
  async (request: NextRequest, context: ApiContext) => {
    const parsed = listRoomTypesQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return apiInvalidRequest(
        'Invalid query parameters',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const scope = resolvePropertyScope(context, parsed.data.propertyId);
    if ('conflict' in scope) {
      return apiInvalidRequest('This API key is restricted to a different property');
    }

    const [roomTypes, images] = await Promise.all([
      scope.propertyId
        ? roomTypeRepo.findByProperty(context.organizationId, scope.propertyId)
        : roomTypeRepo.findAll(context.organizationId),
      roomTypeImageRepo.findAll(context.organizationId),
    ]);

    return apiSuccess(roomTypes.map((roomType) => toRoomTypeDto(roomType, images)));
  },
);
