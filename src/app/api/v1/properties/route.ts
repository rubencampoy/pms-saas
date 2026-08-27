import { ApiScope } from '@/lib/constants/api';
import { propertyRepo } from '@/server/repositories/property.repo';
import { apiSuccess } from '@/server/api/response';
import { withApiKey, type ApiContext } from '@/server/api/with-api-key';
import { toPropertyDto } from '@/server/api/v1/dto/property.dto';

/**
 * GET /api/v1/properties
 *
 * Every property in the caller's organization, or just the one its key is
 * restricted to. Small, bounded list — not paginated.
 */
export const GET = withApiKey(
  ApiScope.PROPERTIES_READ,
  async (_request, context: ApiContext) => {
    const properties = await propertyRepo.findAll(context.organizationId);
    const visible = context.propertyId
      ? properties.filter((property) => property.id === context.propertyId)
      : properties;

    return apiSuccess(visible.map(toPropertyDto));
  },
);
