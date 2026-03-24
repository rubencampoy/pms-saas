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

    // Await sync directly — after() has limited budget on Vercel Hobby
    await channelManagerSyncService.fullSync(orgId, integration.propertyId);

    return NextResponse.json({ status: 'completed' }, { status: 200 });
  } catch (error) {
    console.error('[API:sync] Full sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
