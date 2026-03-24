import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { triggerSyncSchema } from '@/lib/validators/integrations';
import { integrationRepo } from '@/server/repositories/integration.repo';
import { channelManagerSyncService } from '@/server/services/channel-manager-sync.service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const body = await request.json();
    const validated = triggerSyncSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Run sync after response is sent (keeps serverless function alive on Vercel)
    after(async () => {
      try {
        await channelManagerSyncService.fullSync(orgId, integration.propertyId);
      } catch (err) {
        console.error('[API:sync] Full sync failed:', err);
      }
    });

    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (error) {
    console.error('[API:sync] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
