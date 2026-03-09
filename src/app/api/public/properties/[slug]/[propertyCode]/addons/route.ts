import { NextResponse } from 'next/server';
import { bookingEngineService } from '@/server/services/booking-engine.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; propertyCode: string }> },
) {
  try {
    const { slug, propertyCode } = await params;

    const { organization, property } = await bookingEngineService.resolveProperty(slug, propertyCode);
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const addons = await bookingEngineService.getAddons(organization.id, property.id);

    return NextResponse.json({ addons });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[BookingEngine] Addons error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
