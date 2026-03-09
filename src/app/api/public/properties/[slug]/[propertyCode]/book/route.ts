import { NextRequest, NextResponse } from 'next/server';
import { createBookingSchema } from '@/lib/validators/booking-checkout';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { AppError } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; propertyCode: string }> },
) {
  try {
    const { slug, propertyCode } = await params;

    const body: unknown = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking data', details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    // Resolve org + property
    const { organization, property } = await bookingEngineService.resolveProperty(slug, propertyCode);
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Load settings — if termsAndConditions required, validate acceptTerms
    const settings = await bookingEngineService.getSettings(organization.id, property.id);
    if (settings.fieldTermsAndConditions && !parsed.data.guest.acceptTerms) {
      return NextResponse.json(
        { error: 'You must accept the terms and conditions' },
        { status: 422 },
      );
    }

    // Create booking
    const confirmation = await bookingEngineService.createBooking(
      organization.id,
      property.id,
      parsed.data,
    );

    return NextResponse.json(confirmation);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[BookingEngine] Booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
