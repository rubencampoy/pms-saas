import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiScope } from '@/lib/constants/api';
import { reservationIncludeSchema } from '@/lib/validators/api-v1';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { folioRepo, folioLineItemRepo, paymentRepo } from '@/server/repositories/folio.repo';
import { apiInvalidRequest, apiNotFound, apiSuccess } from '@/server/api/response';
import { withApiKey, requireScope, type ApiContext } from '@/server/api/with-api-key';
import { isPropertyVisible } from '@/server/api/scope';
import { toReservationDto, type ReservationDto } from '@/server/api/v1/dto/reservation.dto';
import { toGuestDto, type GuestDto } from '@/server/api/v1/dto/guest.dto';
import { toUnitDto, type UnitDto } from '@/server/api/v1/dto/unit.dto';
import { toFolioDto, type FolioDto } from '@/server/api/v1/dto/folio.dto';

const paramsSchema = z.object({ id: z.string().uuid() });

interface ReservationDetailDto extends ReservationDto {
  guest?: GuestDto;
  unit?: UnitDto | null;
  folio?: FolioDto | null;
}

/**
 * GET /api/v1/reservations/{id}
 *
 * Query: include — csv of `guest`, `unit`, `folio`. Expanding `guest`
 * additionally requires the `guests:read` scope, `folio` requires
 * `folios:read`; `unit` needs nothing beyond the scope of this route.
 */
export const GET = withApiKey<{ id: string }>(
  ApiScope.RESERVATIONS_READ,
  async (request: NextRequest, context: ApiContext, params) => {
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) return apiInvalidRequest('Invalid reservation ID');

    const parsedQuery = reservationIncludeSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsedQuery.success) {
      return apiInvalidRequest(
        'Invalid query parameters',
        parsedQuery.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }
    const { include } = parsedQuery.data;

    const wantsGuest = include.includes('guest');
    const wantsUnit = include.includes('unit');
    const wantsFolio = include.includes('folio');

    // Check the expansion scopes before touching the database, so a key
    // without them cannot use timing to tell a real id from a made-up one.
    if (wantsGuest) {
      const denied = requireScope(context, ApiScope.GUESTS_READ);
      if (denied) return denied;
    }
    if (wantsFolio) {
      const denied = requireScope(context, ApiScope.FOLIOS_READ);
      if (denied) return denied;
    }

    const reservation = await reservationRepo.findById(
      context.organizationId,
      parsedParams.data.id,
    );
    if (!reservation || !isPropertyVisible(context, reservation.propertyId)) {
      return apiNotFound('Reservation not found');
    }

    const detail: ReservationDetailDto = toReservationDto(reservation);

    if (wantsGuest) {
      const guest = await guestRepo.findById(
        context.organizationId,
        reservation.guestId,
      );
      if (guest) detail.guest = toGuestDto(guest);
    }

    if (wantsUnit) {
      // An explicit null says "no room assigned yet"; the field being absent
      // would mean the expansion was never requested.
      const unit = reservation.unitId
        ? await unitRepo.findById(context.organizationId, reservation.unitId)
        : null;
      detail.unit = unit ? toUnitDto(unit) : null;
    }

    if (wantsFolio) {
      const folio = await folioRepo.findByReservation(
        context.organizationId,
        reservation.id,
      );
      if (folio) {
        const [lineItems, payments] = await Promise.all([
          folioLineItemRepo.findByFolio(context.organizationId, folio.id),
          paymentRepo.findByFolio(context.organizationId, folio.id),
        ]);
        detail.folio = toFolioDto(folio, { lineItems, payments });
      } else {
        // An explicit null distinguishes "no folio yet" from "not requested".
        detail.folio = null;
      }
    }

    return apiSuccess(detail);
  },
);
