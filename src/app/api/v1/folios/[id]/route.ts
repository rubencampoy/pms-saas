import { z } from 'zod';
import { ApiScope } from '@/lib/constants/api';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { folioRepo, folioLineItemRepo, paymentRepo } from '@/server/repositories/folio.repo';
import { apiInvalidRequest, apiNotFound, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { isPropertyVisible } from '@/server/api/scope';
import { toFolioDto } from '@/server/api/v1/dto/folio.dto';

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * GET /api/v1/folios/{id}
 *
 * The folio with its charges and payments.
 */
export const GET = withApiKey<{ id: string }>(
  ApiScope.FOLIOS_READ,
  async (_request, context: ApiContext, params) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) return apiInvalidRequest('Invalid folio ID');

    const folio = await folioRepo.findById(context.organizationId, parsed.data.id);
    if (!folio) return apiNotFound('Folio not found');

    // Folios carry no `propertyId` of their own, so a property-restricted key
    // is checked against the reservation the folio belongs to.
    if (context.propertyId) {
      const reservation = await reservationRepo.findById(
        context.organizationId,
        folio.reservationId,
      );
      if (!reservation || !isPropertyVisible(context, reservation.propertyId)) {
        return apiNotFound('Folio not found');
      }
    }

    const [lineItems, payments] = await Promise.all([
      folioLineItemRepo.findByFolio(context.organizationId, folio.id),
      paymentRepo.findByFolio(context.organizationId, folio.id),
    ]);

    return apiSuccess(toFolioDto(folio, { lineItems, payments }));
  },
);
