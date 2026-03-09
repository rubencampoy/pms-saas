import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bookingEngineService } from '@/server/services/booking-engine.service';

const querySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-in date'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date'),
  adults: z.coerce.number().int().min(1).max(20).default(2),
  children: z.coerce.number().int().min(0).max(20).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; propertyCode: string }> },
) {
  try {
    const { slug, propertyCode } = await params;

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { checkIn, checkOut, adults, children } = parsed.data;

    // Resolve org + property
    const { organization, property } = await bookingEngineService.resolveProperty(slug, propertyCode);
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const results = await bookingEngineService.searchAvailability(
      organization.id,
      property.id,
      checkIn,
      checkOut,
      adults,
      children,
    );

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[BookingEngine] Availability error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
