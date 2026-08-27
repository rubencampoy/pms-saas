import { z } from 'zod';
import { ApiScope } from '@/lib/constants/api';
import { propertyRepo } from '@/server/repositories/property.repo';
import { apiInvalidRequest, apiNotFound, apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { isPropertyVisible } from '@/server/api/scope';
import { toPropertyDto } from '@/server/api/v1/dto/property.dto';

const paramsSchema = z.object({ id: z.string().uuid() });

/** GET /api/v1/properties/{id} */
export const GET = withApiKey<{ id: string }>(
  ApiScope.PROPERTIES_READ,
  async (_request, context: ApiContext, params) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) return apiInvalidRequest('Invalid property ID');

    const property = await propertyRepo.findById(
      context.organizationId,
      parsed.data.id,
    );

    // A property outside the key's scope is reported as missing, not as
    // forbidden — otherwise the 403/404 split confirms it exists.
    if (!property || !isPropertyVisible(context, property.id)) {
      return apiNotFound('Property not found');
    }

    return apiSuccess(toPropertyDto(property));
  },
);
