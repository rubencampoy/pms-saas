import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import {
  organizations,
  properties,
  roomTypes,
  units,
  guests,
  reservations,
  folios,
  folioLineItems,
  housekeepingTasks,
  users,
  memberships,
} from '../schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function addWeekReservations() {
  console.log('📋 Adding reservations for this week (Feb 16-22, 2026)...\n');

  // Get org
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error('No organization found. Run db:seed first.');
  const orgId = org.id;

  // Get properties
  const props = await db.select().from(properties).where(eq(properties.organizationId, orgId));
  const khe = props.find((p) => p.code === 'KHE')!;
  const khm = props.find((p) => p.code === 'KHM')!;

  // Get room types
  const rts = await db.select().from(roomTypes).where(eq(roomTypes.organizationId, orgId));
  const kheDbl = rts.find((rt) => rt.propertyId === khe.id && rt.code === 'DBL')!;
  const kheSgl = rts.find((rt) => rt.propertyId === khe.id && rt.code === 'SGL')!;
  const kheDrm = rts.find((rt) => rt.propertyId === khe.id && rt.code === 'DRM6')!;
  const khmDbl = rts.find((rt) => rt.propertyId === khm.id && rt.code === 'DBL')!;
  const khmSte = rts.find((rt) => rt.propertyId === khm.id && rt.code === 'STE')!;

  // Get units
  const allUnits = await db.select().from(units).where(eq(units.organizationId, orgId));
  const getUnit = (propId: string, name: string) => allUnits.find((u) => u.propertyId === propId && u.name === name)!;

  // Get existing guests
  const allGuests = await db.select().from(guests).where(eq(guests.organizationId, orgId));
  const g = (lastName: string) => allGuests.find((g) => g.lastName === lastName)!;

  // Get owner user (for folio line items createdBy)
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, 'owner')))
    .limit(1);

  // Add more guests for variety
  const newGuests = await db.insert(guests).values([
    {
      organizationId: orgId,
      firstName: 'Sofia',
      lastName: 'Rossi',
      email: 'sofia.rossi@libero.it',
      phone: '+39 333 1234567',
      documentType: 'passport',
      documentNumber: 'IT445566778',
      nationality: 'IT',
      dateOfBirth: '1994-05-12',
      vipStatus: 'none',
      totalStays: 0,
      totalRevenue: '0',
    },
    {
      organizationId: orgId,
      firstName: 'Jan',
      lastName: 'de Vries',
      email: 'jan.devries@gmail.com',
      phone: '+31 6 12345678',
      documentType: 'passport',
      documentNumber: 'NL998877665',
      nationality: 'NL',
      dateOfBirth: '1982-08-30',
      vipStatus: 'none',
      totalStays: 0,
      totalRevenue: '0',
    },
    {
      organizationId: orgId,
      firstName: 'Yuki',
      lastName: 'Tanaka',
      email: 'yuki.tanaka@yahoo.co.jp',
      phone: '+81 90 1234 5678',
      documentType: 'passport',
      documentNumber: 'JP112233445',
      nationality: 'JP',
      dateOfBirth: '1996-12-01',
      vipStatus: 'none',
      totalStays: 0,
      totalRevenue: '0',
    },
    {
      organizationId: orgId,
      firstName: 'Miguel',
      lastName: 'Santos',
      email: 'miguel.santos@hotmail.com',
      phone: '+351 912 345 678',
      documentType: 'passport',
      documentNumber: 'PT556677889',
      nationality: 'PT',
      dateOfBirth: '1989-04-18',
      vipStatus: 'none',
      totalStays: 0,
      totalRevenue: '0',
    },
  ]).returning();

  const sofia = newGuests[0]!;
  const jan = newGuests[1]!;
  const yuki = newGuests[2]!;
  const miguel = newGuests[3]!;

  console.log('👥 New guests added: Sofia Rossi, Jan de Vries, Yuki Tanaka, Miguel Santos\n');

  // ── Reservations for this week ──

  const newRes = await db.insert(reservations).values([
    // 1. CHECKED_IN — Carlos Fernández, KHE Doble 102, arrived Feb 16 → Feb 20
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00010',
      guestId: g('Fernández').id,
      roomTypeId: kheDbl.id,
      unitId: getUnit(khe.id, '102').id,
      status: 'checked_in',
      source: 'direct',
      checkInDate: '2026-02-16',
      checkOutDate: '2026-02-20',
      nights: 4,
      adults: 2,
      children: 0,
      totalAmount: '360.00',
      currency: 'EUR',
      specialRequests: 'Llegamos desde Madrid en AVE.',
    },
    // 2. CHECKED_IN — Sofia Rossi, KHE Doble 104, arrived Feb 17 → Feb 21
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00011',
      guestId: sofia.id,
      roomTypeId: kheDbl.id,
      unitId: getUnit(khe.id, '104').id,
      status: 'checked_in',
      source: 'booking_com',
      checkInDate: '2026-02-17',
      checkOutDate: '2026-02-21',
      nights: 4,
      adults: 2,
      children: 0,
      totalAmount: '360.00',
      currency: 'EUR',
    },
    // 3. CHECKED_IN — Jan de Vries, KHE Individual 107, arrived Feb 15 → Feb 19
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00012',
      guestId: jan.id,
      roomTypeId: kheSgl.id,
      unitId: getUnit(khe.id, '107').id,
      status: 'checked_in',
      source: 'expedia',
      checkInDate: '2026-02-15',
      checkOutDate: '2026-02-19',
      nights: 4,
      adults: 1,
      children: 0,
      totalAmount: '240.00',
      currency: 'EUR',
    },
    // 4. CHECKED_IN — Yuki Tanaka, KHE Dorm 202, arrived Feb 16 → Feb 22
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00013',
      guestId: yuki.id,
      roomTypeId: kheDrm.id,
      unitId: getUnit(khe.id, '202').id,
      status: 'checked_in',
      source: 'website',
      checkInDate: '2026-02-16',
      checkOutDate: '2026-02-22',
      nights: 6,
      adults: 1,
      children: 0,
      totalAmount: '150.00',
      currency: 'EUR',
    },
    // 5. CONFIRMED — Pierre Dupont, KHE Doble 105, arriving Feb 19 → Feb 22
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00014',
      guestId: g('Dupont').id,
      roomTypeId: kheDbl.id,
      unitId: getUnit(khe.id, '105').id,
      status: 'confirmed',
      source: 'direct',
      checkInDate: '2026-02-19',
      checkOutDate: '2026-02-22',
      nights: 3,
      adults: 2,
      children: 0,
      totalAmount: '270.00',
      currency: 'EUR',
      specialRequests: 'Vegetarian breakfast please.',
    },
    // 6. CONFIRMED — Lucía Martínez, KHE Individual 108, arriving Feb 20 → Feb 23
    {
      organizationId: orgId,
      propertyId: khe.id,
      confirmationCode: 'KHE-2026-00015',
      guestId: g('Martínez').id,
      roomTypeId: kheSgl.id,
      unitId: getUnit(khe.id, '108').id,
      status: 'confirmed',
      source: 'phone',
      checkInDate: '2026-02-20',
      checkOutDate: '2026-02-23',
      nights: 3,
      adults: 1,
      children: 0,
      totalAmount: '180.00',
      currency: 'EUR',
    },
    // 7. CHECKED_IN — Miguel Santos, KHM Doble 101, arrived Feb 17 → Feb 20
    {
      organizationId: orgId,
      propertyId: khm.id,
      confirmationCode: 'KHM-2026-00001',
      guestId: miguel.id,
      roomTypeId: khmDbl.id,
      unitId: getUnit(khm.id, '101').id,
      status: 'checked_in',
      source: 'airbnb',
      checkInDate: '2026-02-17',
      checkOutDate: '2026-02-20',
      nights: 3,
      adults: 2,
      children: 0,
      totalAmount: '300.00',
      currency: 'EUR',
    },
    // 8. CONFIRMED — Hans Müller, KHM Suite 201, arriving Feb 18 → Feb 22
    {
      organizationId: orgId,
      propertyId: khm.id,
      confirmationCode: 'KHM-2026-00002',
      guestId: g('Müller').id,
      roomTypeId: khmSte.id,
      unitId: getUnit(khm.id, '201').id,
      status: 'confirmed',
      source: 'direct',
      checkInDate: '2026-02-18',
      checkOutDate: '2026-02-22',
      nights: 4,
      adults: 2,
      children: 1,
      totalAmount: '600.00',
      currency: 'EUR',
      specialRequests: 'Cuna para bebé en la habitación.',
    },
    // 9. CANCELLED — Emma Johnson, KHM Doble 102 (cancelled yesterday)
    {
      organizationId: orgId,
      propertyId: khm.id,
      confirmationCode: 'KHM-2026-00003',
      guestId: g('Johnson').id,
      roomTypeId: khmDbl.id,
      unitId: null,
      status: 'cancelled',
      source: 'booking_com',
      checkInDate: '2026-02-19',
      checkOutDate: '2026-02-21',
      nights: 2,
      adults: 2,
      children: 0,
      totalAmount: '200.00',
      currency: 'EUR',
      cancelledAt: new Date('2026-02-17T14:30:00Z'),
      cancellationReason: 'Change of travel plans',
    },
  ]).returning();

  for (const r of newRes) {
    console.log(`   ✅ ${r.confirmationCode} — ${r.status.toUpperCase()} (${r.checkInDate} → ${r.checkOutDate})`);
  }

  // ── Create folios for checked_in reservations ──
  console.log('\n🧾 Creating folios for checked-in reservations...');

  const checkedInRes = newRes.filter((r) => r.status === 'checked_in');
  const adminId = adminUser?.id ?? null;

  for (const res of checkedInRes) {
    const folioNumber = `F-2026-${String(10 + checkedInRes.indexOf(res)).padStart(5, '0')}`;
    const nightlyRate = (parseFloat(res.totalAmount) / res.nights).toFixed(2);
    const taxRate = '10.00';

    // Count nights from check-in to today (Feb 18)
    const ciDate = new Date(res.checkInDate + 'T00:00:00Z');
    const today = new Date('2026-02-18T00:00:00Z');
    const nightsSoFar = Math.min(
      Math.floor((today.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24)),
      res.nights,
    );

    const subtotal = (parseFloat(nightlyRate) * nightsSoFar).toFixed(2);
    const taxTotal = (parseFloat(subtotal) * 0.10).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(taxTotal)).toFixed(2);

    const [folio] = await db.insert(folios).values({
      organizationId: orgId,
      reservationId: res.id,
      guestId: res.guestId,
      folioNumber,
      status: 'open',
      subtotal,
      taxTotal,
      total,
      paidAmount: '0.00',
      balance: total,
      currency: 'EUR',
    }).returning();

    // Create line items for each night so far
    if (nightsSoFar > 0) {
      const rtName = rts.find((rt) => rt.id === res.roomTypeId)?.name ?? 'Room';

      const lineItems = Array.from({ length: nightsSoFar }, (_, i) => {
        const d = new Date(ciDate);
        d.setUTCDate(d.getUTCDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const taxAmt = (parseFloat(nightlyRate) * 0.10).toFixed(2);
        return {
          organizationId: orgId,
          folioId: folio!.id,
          type: 'room_charge',
          description: `${rtName} — Noche ${i + 1}`,
          date: dateStr,
          quantity: 1,
          unitPrice: nightlyRate,
          amount: nightlyRate,
          taxRate,
          taxAmount: taxAmt,
          createdBy: adminId,
        };
      });

      await db.insert(folioLineItems).values(lineItems);
    }

    console.log(`   ✅ ${folio!.folioNumber} — ${res.confirmationCode} (${nightsSoFar} nights posted, balance: €${total})`);
  }

  // ── Update unit statuses ──
  console.log('\n🛏️  Updating unit statuses...');
  for (const res of checkedInRes) {
    if (res.unitId) {
      await db.update(units)
        .set({ housekeepingStatus: 'dirty' })
        .where(and(eq(units.organizationId, orgId), eq(units.id, res.unitId)));
    }
  }
  console.log('   ✅ Occupied rooms set to dirty');

  // ── Housekeeping tasks for today ──
  console.log('\n🧹 Creating housekeeping tasks for today (Feb 18)...');
  const hkTasks = checkedInRes
    .filter((r) => r.unitId)
    .map((r) => ({
      organizationId: orgId,
      propertyId: r.propertyId,
      unitId: r.unitId!,
      type: 'stay_over' as const,
      status: 'pending' as const,
      priority: 'normal' as const,
      scheduledDate: '2026-02-18',
      notes: `Stay-over clean — ${r.confirmationCode}`,
    }));

  if (hkTasks.length > 0) {
    await db.insert(housekeepingTasks).values(hkTasks);
    console.log(`   ✅ ${hkTasks.length} stay-over tasks created`);
  }

  // ── Summary ──
  console.log('\n============================================');
  console.log('🎉 Week reservations added successfully!');
  console.log('============================================');
  console.log(`  New guests:       4`);
  console.log(`  New reservations: ${newRes.length}`);
  console.log(`    - Checked in:   ${checkedInRes.length}`);
  console.log(`    - Confirmed:    ${newRes.filter((r) => r.status === 'confirmed').length}`);
  console.log(`    - Cancelled:    ${newRes.filter((r) => r.status === 'cancelled').length}`);
  console.log(`  Folios created:   ${checkedInRes.length}`);
  console.log(`  HK tasks:        ${hkTasks.length}`);

  await client.end();
}

addWeekReservations().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
