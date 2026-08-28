import { NextRequest } from 'next/server';
import { ApiScope } from '@/lib/constants/api';
import { listUnitsQuerySchema } from '@/lib/validators/api-v1';
import { unitRepo } from '@/server/repositories/unit.repo';
import { apiInvalidRequest, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { resolvePropertyScope } from '@/server/api/scope';
import { toUnitDto } from '@/server/api/v1/dto/unit.dto';

/**
 * GET /api/v1/units
 *
 * The physical rooms/apartments, so an integration can mirror the inventory
 * instead of having someone retype it — a door lock is configured per unit,
 * and a name typed by hand in two systems drifts.
 *
 * Bounded list, not paginated: a property has tens of units, not thousands.
 * Ordered by the PMS's own display order.
 *
 * Query: propertyId
 */
export const GET = withApiKey(
  ApiScope.ROOM_TYPES_READ,
  async (request: NextRequest, context: ApiContext) => {
    const parsed = listUnitsQuerySchema.safeParse(
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

    const units = scope.propertyId
      ? await unitRepo.findByProperty(context.organizationId, scope.propertyId)
      : await unitRepo.findAll(context.organizationId);

    return apiSuccess(units.map(toUnitDto));
  },
);
