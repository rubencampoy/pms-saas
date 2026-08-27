import { NextRequest } from 'next/server';
import { ApiScope } from '@/lib/constants/api';
import { availabilityQuerySchema } from '@/lib/validators/api-v1';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { apiInvalidRequest, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { resolvePropertyScope } from '@/server/api/scope';
import { toAvailabilityDto } from '@/server/api/v1/dto/availability.dto';

/**
 * GET /api/v1/availability
 *
 * Query: propertyId (required unless the key is restricted to one),
 *        checkIn, checkOut, adults, children
 *
 * Reuses the booking engine's availability search, so the prices and
 * restrictions here are the same ones the public booking site applies.
 */
export const GET = withApiKey(
  ApiScope.AVAILABILITY_READ,
  async (request: NextRequest, context: ApiContext) => {
    const parsed = availabilityQuerySchema.safeParse(
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
    if (!scope.propertyId) {
      return apiInvalidRequest(
        'propertyId is required — availability is always searched per property',
      );
    }

    const { checkIn, checkOut, adults, children } = parsed.data;

    const results = await bookingEngineService.searchAvailability(
      context.organizationId,
      scope.propertyId,
      checkIn,
      checkOut,
      adults,
      children,
    );

    return apiSuccess(results.map(toAvailabilityDto));
  },
);
