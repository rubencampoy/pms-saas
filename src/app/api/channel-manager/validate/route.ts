import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { createIntegrationSchema } from '@/lib/validators/integrations';
import { getProvider } from '@/lib/channel-manager/providers';
import type { CMConfig } from '@/lib/channel-manager/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    requireRole(session.user.role, ['admin', 'manager']);

    const body = await request.json();
    const validated = createIntegrationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validated.error.flatten() },
        { status: 400 },
      );
    }

    const provider = getProvider(validated.data.provider);
    const config: CMConfig = validated.data.credentials;

    const result = await provider.validateCredentials(config);
    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.errorMessage },
        { status: 200 },
      );
    }

    const [roomTypes, ratePlans] = await Promise.all([
      provider.fetchExternalRoomTypes(config),
      provider.fetchExternalRatePlans(config),
    ]);

    return NextResponse.json({
      valid: true,
      hotelName: result.hotelName,
      roomTypes,
      ratePlans,
    });
  } catch (error) {
    console.error('[API:validate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
