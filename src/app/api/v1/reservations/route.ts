import { NextRequest } from 'next/server';
import { ApiScope } from '@/lib/constants/api';
import { listReservationsQuerySchema } from '@/lib/validators/api-v1';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { decodeCursor, encodeCursor } from '@/server/api/cursor';
import { apiInvalidRequest, apiSuccess } from '@/server/api/response';
import {
  withApiKey,
  requireScope,
  type ApiContext,
} from '@/server/api/with-api-key';
import {
  toReservationDto,
  type ReservationDto,
} from '@/server/api/v1/dto/reservation.dto';
import { toGuestDto, type GuestDto } from '@/server/api/v1/dto/guest.dto';
import { toUnitDto, type UnitDto } from '@/server/api/v1/dto/unit.dto';

interface ReservationListItemDto extends ReservationDto {
  guest?: GuestDto;
  unit?: UnitDto | null;
}

/**
 * GET /api/v1/reservations
 *
 * Keyset-paginated list ordered by `(updatedAt, id)` ascending. Combine
 * `updatedSince` with the returned `nextCursor` to poll for changes only.
 *
 * Query: propertyId, status (csv), updatedSince (RFC 3339), checkInFrom,
 *        checkInTo, cursor, limit, include (csv of `guest`, `unit`)
 *
 * Expansions are resolved with one batched query each, not one per row: a
 * 200-row page costs three queries whatever is included.
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

    const {
      propertyId,
      status,
      updatedSince,
      checkInFrom,
      checkInTo,
      cursor,
      limit,
      include,
    } = parsed.data;

    const wantsGuest = include.includes('guest');
    const wantsUnit = include.includes('unit');

    // Guest data is the one expansion that reads another resource's personal
    // data, so its scope is checked before anything is fetched.
    if (wantsGuest) {
      const denied = requireScope(context, ApiScope.GUESTS_READ);
      if (denied) return denied;
    }

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

    const data: ReservationListItemDto[] = page.map(toReservationDto);

    if (wantsGuest) {
      const guests = await guestRepo.findManyByIds(context.organizationId, [
        ...new Set(page.map((row) => row.guestId)),
      ]);
      const byId = new Map(guests.map((guest) => [guest.id, toGuestDto(guest)]));
      for (const item of data) {
        const guest = byId.get(item.guestId);
        if (guest) item.guest = guest;
      }
    }

    if (wantsUnit) {
      const units = await unitRepo.findManyByIds(context.organizationId, [
        ...new Set(
          page
            .map((row) => row.unitId)
            .filter((id): id is string => id !== null),
        ),
      ]);
      const byId = new Map(units.map((unit) => [unit.id, toUnitDto(unit)]));
      // An explicit null says "no room assigned yet"; the field being absent
      // would mean the expansion was never requested.
      for (const item of data) {
        item.unit = item.unitId ? (byId.get(item.unitId) ?? null) : null;
      }
    }

    return apiSuccess(data, {
      nextCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.cursorUpdatedAt, id: last.id })
          : null,
      hasMore,
    });
  },
);
