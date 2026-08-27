import { NextRequest } from 'next/server';
import { ApiScope, RateLimitBucket } from '@/lib/constants/api';
import { lookupReservationQuerySchema } from '@/lib/validators/api-v1';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { apiInvalidRequest, apiNotFound, apiSuccess } from '@/server/api/response';
import { withApiKey, requireScope, type ApiContext } from '@/server/api/with-api-key';
import { isPropertyVisible } from '@/server/api/scope';
import { toReservationDto } from '@/server/api/v1/dto/reservation.dto';
import { toGuestDto } from '@/server/api/v1/dto/guest.dto';

/**
 * GET /api/v1/reservations/lookup?confirmationCode=…&lastName=…
 *
 * Guest identification: the two factors a guest can supply from their booking
 * email. Returns the reservation together with the matching guest, so the
 * caller can greet them and decide what to show — which is why this endpoint
 * requires `guests:read` on top of `reservations:read`.
 *
 * Both factors must match. Every failure — unknown code, wrong surname, other
 * property — returns the same 404, so the endpoint cannot be used to confirm
 * that a confirmation code exists.
 *
 * Draws on its own tight rate-limit bucket rather than the shared one, so a
 * brute-force loop here cannot hide inside a normal volume of reads — and
 * cannot exhaust the budget the rest of the integration depends on.
 */
export const GET = withApiKey(
  ApiScope.RESERVATIONS_READ,
  async (request: NextRequest, context: ApiContext) => {
    const denied = requireScope(context, ApiScope.GUESTS_READ);
    if (denied) return denied;

    const parsed = lookupReservationQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return apiInvalidRequest(
        'Both confirmationCode and lastName are required',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const { confirmationCode, lastName } = parsed.data;

    const match = await reservationRepo.findByConfirmationCodeAndLastName(
      context.organizationId,
      confirmationCode,
      lastName,
    );

    if (!match || !isPropertyVisible(context, match.reservation.propertyId)) {
      return apiNotFound('No reservation matches that confirmation code and surname');
    }

    return apiSuccess({
      ...toReservationDto(match.reservation),
      guest: toGuestDto(match.guest),
    });
  },
  { bucket: RateLimitBucket.LOOKUP },
);
