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

    const settings = await bookingEngineService.getSettings(organization.id, property.id);

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[BookingEngine] Settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
