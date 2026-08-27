import { NextRequest } from 'next/server';
import { ApiScope } from '@/lib/constants/api';
import { listReservationsQuerySchema } from '@/lib/validators/api-v1';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { decodeCursor, encodeCursor } from '@/server/api/cursor';
import { apiInvalidRequest, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { toReservationDto } from '@/server/api/v1/dto/reservation.dto';

/**
 * GET /api/v1/reservations
 *
 * Keyset-paginated list ordered by `(updatedAt, id)` ascending. Combine
 * `updatedSince` with the returned `nextCursor` to poll for changes only.
 *
 * Query: propertyId, status (csv), updatedSince (RFC 3339), checkInFrom,
 *        checkInTo, cursor, limit
 */
export const GET = withApiKey(
  ApiScope.RESERVATIONS_READ,
  async (request: NextRequest, context: ApiContext) => {
    const parsed = listReservationsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (!parsed.success) {
      return apiInvalidRequest(
        'Invalid query parameters',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const { propertyId, status, updatedSince, checkInFrom, checkInTo, cursor, limit } =
      parsed.data;

    // A key scoped to one property may never widen its own scope.
    if (context.propertyId && propertyId && propertyId !== context.propertyId) {
      return apiInvalidRequest(
        'This API key is restricted to a different property',
      );
    }
    const effectivePropertyId = context.propertyId ?? propertyId;

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
      return apiInvalidRequest('Invalid cursor');
    }

    // Fetch one extra row to learn whether another page exists, without a count.
    const rows = await reservationRepo.findPageByUpdatedAt(context.organizationId, {
      propertyId: effectivePropertyId,
      status,
      updatedSince: updatedSince ? new Date(updatedSince) : undefined,
      checkInFrom,
      checkInTo,
      cursor: decodedCursor,
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return apiSuccess(page.map(toReservationDto), {
      nextCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.cursorUpdatedAt, id: last.id })
          : null,
      hasMore,
    });
  },
);
