import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { zodomusWebhookSchema } from '@/lib/validators/integrations';
import { integrationRepo, channelManagerLogRepo } from '@/server/repositories/integration.repo';
import { channelManagerSyncService } from '@/server/services/channel-manager-sync.service';
import { zodomusProvider } from '@/lib/channel-manager/providers/zodomus';
import { SyncDirection, SyncAction, SyncStatus } from '@/lib/constants/channel-manager';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const webhookToken = request.headers.get('x-webhook-token');
  if (!webhookToken) {
    return NextResponse.json({ error: 'Missing webhook token' }, { status: 401 });
  }

  // Look up integration by webhook token
  const integration = await integrationRepo.findByWebhookToken(webhookToken);
  if (!integration || !integration.isActive) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  const orgId = integration.organizationId;

  try {
    const body = await request.json();

    // Validate payload structure
    const validated = zodomusWebhookSchema.safeParse(body);
    if (!validated.success) {
      await channelManagerLogRepo.create(orgId, {
        integrationId: integration.id,
        direction: SyncDirection.INBOUND,
        action: SyncAction.RECEIVE_RESERVATION,
        status: SyncStatus.ERROR,
        request: JSON.stringify(body),
        errorMessage: `Validation failed: ${validated.error.message}`,
      });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Parse using provider
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const parsed = zodomusProvider.parseWebhookPayload(headers, validated.data);

    // Run reservation processing after response is sent (keeps serverless function alive on Vercel)
    after(async () => {
      try {
        await channelManagerSyncService.handleIncomingReservation(orgId, integration.id, parsed);
      } catch (err) {
        console.error('[Webhook:Zodomus] Failed to process reservation:', err);
        await channelManagerLogRepo.create(orgId, {
          integrationId: integration.id,
          direction: SyncDirection.INBOUND,
          action: SyncAction.RECEIVE_RESERVATION,
          status: SyncStatus.ERROR,
          request: JSON.stringify(body),
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  } catch (error) {
    console.error('[Webhook:Zodomus] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
