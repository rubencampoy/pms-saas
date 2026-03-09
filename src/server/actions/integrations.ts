'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { getProvider } from '@/lib/channel-manager/providers';
import {
  createIntegrationSchema,
  updateIntegrationSchema,
  toggleIntegrationSchema,
  roomTypeMappingSchema,
  ratePlanMappingSchema,
  triggerSyncSchema,
  integrationLogsSchema,
} from '@/lib/validators/integrations';
import {
  integrationRepo,
  roomTypeMappingRepo,
  ratePlanMappingRepo,
  channelManagerLogRepo,
} from '@/server/repositories/integration.repo';
import { channelManagerSyncService } from '@/server/services/channel-manager-sync.service';
import type { ActionResult } from '@/types/actions';
import type { CreateIntegrationInput, UpdateIntegrationInput, ToggleIntegrationInput, RoomTypeMappingInput, RatePlanMappingInput, TriggerSyncInput, IntegrationLogsInput } from '@/lib/validators/integrations';
import type { CMConfig, ExternalRoomType, ExternalRatePlan, ProvisionResult } from '@/lib/channel-manager/types';

export async function getIntegrationConfig(propertyId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const integration = await integrationRepo.findByProperty(
    session.user.organizationId,
    propertyId,
  );

  if (!integration) return null;

  const rtMappings = await roomTypeMappingRepo.findByIntegration(
    session.user.organizationId,
    integration.id,
  );
  const rpMappings = await ratePlanMappingRepo.findByIntegration(
    session.user.organizationId,
    integration.id,
  );

  // Decrypt credentials for display (mask sensitive fields)
  let decryptedCreds: CMConfig | null = null;
  try {
    const json = decrypt(integration.credentials);
    decryptedCreds = JSON.parse(json) as CMConfig;
  } catch {
    decryptedCreds = null;
  }

  return {
    ...integration,
    decryptedCredentials: decryptedCreds,
    roomTypeMappings: rtMappings,
    ratePlanMappings: rpMappings,
  };
}

export async function saveIntegrationConfig(
  input: CreateIntegrationInput | UpdateIntegrationInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);
    const orgId = session.user.organizationId;

    // Try as create first
    const createResult = createIntegrationSchema.safeParse(input);
    if (createResult.success) {
      const data = createResult.data;
      const encryptedCreds = encrypt(JSON.stringify(data.credentials));
      const webhookToken = randomBytes(32).toString('hex');

      // Check if integration already exists for this property/provider
      const existing = await integrationRepo.findByProperty(orgId, data.propertyId);
      if (existing) {
        // Update existing
        const updated = await integrationRepo.update(orgId, existing.id, {
          credentials: encryptedCreds,
        });
        revalidatePath('/settings/channels');
        return { success: true, data: { id: updated!.id } };
      }

      const integration = await integrationRepo.create(orgId, {
        propertyId: data.propertyId,
        provider: data.provider,
        credentials: encryptedCreds,
        webhookToken,
      });

      revalidatePath('/settings/channels');
      return { success: true, data: { id: integration.id } };
    }

    // Try as update
    const updateResult = updateIntegrationSchema.safeParse(input);
    if (updateResult.success) {
      const data = updateResult.data;
      if (data.credentials) {
        const encryptedCreds = encrypt(JSON.stringify(data.credentials));
        await integrationRepo.update(orgId, data.integrationId, {
          credentials: encryptedCreds,
        });
      }
      revalidatePath('/settings/channels');
      return { success: true, data: { id: data.integrationId } };
    }

    return { success: false, error: 'Invalid input' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('saveIntegrationConfig failed:', error);
    return { success: false, error: message };
  }
}

export async function validateConnection(
  input: CreateIntegrationInput,
): Promise<ActionResult<{ hotelName?: string; roomTypes: ExternalRoomType[]; ratePlans: ExternalRatePlan[] }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = createIntegrationSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const provider = getProvider(validated.data.provider);
    const config: CMConfig = validated.data.credentials;

    const result = await provider.validateCredentials(config);
    if (!result.valid) {
      return { success: false, error: result.errorMessage ?? 'Connection failed' };
    }

    const [roomTypes, ratePlans] = await Promise.all([
      provider.fetchExternalRoomTypes(config),
      provider.fetchExternalRatePlans(config),
    ]);

    return {
      success: true,
      data: { hotelName: result.hotelName, roomTypes, ratePlans },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('validateConnection failed:', error);
    return { success: false, error: message };
  }
}

export async function fetchExternalEntities(
  integrationId: string,
): Promise<ActionResult<{ roomTypes: ExternalRoomType[]; ratePlans: ExternalRatePlan[] }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);
    const orgId = session.user.organizationId;

    const integration = await integrationRepo.findById(orgId, integrationId);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const provider = getProvider(integration.provider);
    const config = JSON.parse(decrypt(integration.credentials)) as CMConfig;

    const [roomTypes, ratePlans] = await Promise.all([
      provider.fetchExternalRoomTypes(config),
      provider.fetchExternalRatePlans(config),
    ]);

    return { success: true, data: { roomTypes, ratePlans } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('fetchExternalEntities failed:', error);
    return { success: false, error: message };
  }
}

export async function saveRoomTypeMappings(
  input: RoomTypeMappingInput,
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = roomTypeMappingSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    await roomTypeMappingRepo.upsertBatch(
      orgId,
      validated.data.integrationId,
      validated.data.mappings,
    );

    revalidatePath('/settings/channels');
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('saveRoomTypeMappings failed:', error);
    return { success: false, error: message };
  }
}

export async function saveRatePlanMappings(
  input: RatePlanMappingInput,
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = ratePlanMappingSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    await ratePlanMappingRepo.upsertBatch(
      orgId,
      validated.data.integrationId,
      validated.data.mappings,
    );

    revalidatePath('/settings/channels');
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('saveRatePlanMappings failed:', error);
    return { success: false, error: message };
  }
}

export async function toggleIntegration(
  input: ToggleIntegrationInput,
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = toggleIntegrationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    await integrationRepo.update(orgId, validated.data.integrationId, {
      isActive: validated.data.isActive,
    });

    revalidatePath('/settings/channels');
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('toggleIntegration failed:', error);
    return { success: false, error: message };
  }
}

export async function triggerFullSync(
  input: TriggerSyncInput,
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = triggerSyncSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    // Fire-and-forget the full sync
    channelManagerSyncService
      .fullSync(orgId, integration.propertyId)
      .catch((err) => console.error('[ChannelManager] Full sync failed:', err));

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('triggerFullSync failed:', error);
    return { success: false, error: message };
  }
}

export async function getIntegrationLogs(
  input: IntegrationLogsInput,
): Promise<ActionResult<{ logs: Awaited<ReturnType<typeof channelManagerLogRepo.findByIntegration>>; total: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const validated = integrationLogsSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const { integrationId, ...filters } = validated.data;

    const [logs, total] = await Promise.all([
      channelManagerLogRepo.findByIntegration(orgId, integrationId, filters),
      channelManagerLogRepo.count(orgId, integrationId, filters),
    ]);

    return { success: true, data: { logs, total } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('getIntegrationLogs failed:', error);
    return { success: false, error: message };
  }
}

export async function provisionChannelContent(
  integrationId: string,
  rooms: { name: string; code: string }[],
  rates: { name: string; code: string }[],
): Promise<ActionResult<ProvisionResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['admin', 'manager']);
    const orgId = session.user.organizationId;

    const integration = await integrationRepo.findById(orgId, integrationId);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const provider = getProvider(integration.provider);

    if (!provider.provisionContent) {
      return { success: false, error: 'This provider does not support content provisioning' };
    }

    const config = JSON.parse(decrypt(integration.credentials)) as CMConfig;

    const result = await provider.provisionContent(config, rooms, rates);

    // After provisioning, log the result
    await channelManagerLogRepo.create(orgId, {
      integrationId,
      direction: 'outbound',
      action: 'provision_content',
      status: result.success ? 'success' : 'error',
      request: JSON.stringify({ rooms: rooms.length, rates: rates.length }),
      response: JSON.stringify(result),
      errorMessage: result.errorMessage,
    });

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('provisionChannelContent failed:', error);
    return { success: false, error: message };
  }
}
