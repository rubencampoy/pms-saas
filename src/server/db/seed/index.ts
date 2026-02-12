import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import {
  organizations,
  users,
  properties,
  roomTypes,
  units,
  guests,
  reservations,
  ratePlans,
  folios,
  folioLineItems,
  housekeepingTasks,
} from '../schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...');

  // ── Clean existing data (reverse FK order) ──
  console.log('🗑️  Cleaning existing data...');
  await db.delete(housekeepingTasks);
  await db.delete(folioLineItems);
  await db.delete(folios);
  await db.delete(reservations);
  await db.delete(units);
  await db.delete(roomTypes);
  await db.delete(ratePlans);
  await db.delete(guests);
  await db.delete(users);
  await db.delete(properties);
  await db.delete(organizations);

  // ── 1. Organization ──
  console.log('🏢 Creating organization...');
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Social Strategic Tourism SL',
      slug: 'koala-hostel',
      timezone: 'Europe/Madrid',
      defaultCurrency: 'EUR',
      locale: 'es-ES',
      plan: 'professional',
      settings: {
        brandName: 'Koala Hostel',
        invoicePrefix: 'F',
        confirmationPrefix: 'KH',
      },
    })
    .returning();

  const orgId = org!.id;
  console.log(`   ✓ Organization: ${org!.name} (${orgId})`);

  // ── 2. Users ──
  console.log('👤 Creating users...');
  const [adminUser] = await db
    .insert(users)
    .values([
      {
        organizationId: orgId,
        email: 'admin@koalahostel.com',
        name: 'Rubén Campoy',
        role: 'admin',
        passwordHash: '$2b$10$placeholder_hash_admin',
      },
      {
        organizationId: orgId,
        email: 'recepcion@koalahostel.com',
        name: 'María García',
        role: 'front_desk',
        passwordHash: '$2b$10$placeholder_hash_frontdesk',
      },
    ])
    .returning();

  console.log('   ✓ admin@koalahostel.com (Admin)');
  console.log('   ✓ recepcion@koalahostel.com (Front Desk)');

  // ── 3. Properties ──
  console.log('🏨 Creating properties...');
  const [propKHE, propKHM] = await db
    .insert(properties)
    .values([
      {
        organizationId: orgId,
        name: 'Koala Hostel Estación',
        code: 'KHE',
        address: {
          street: 'Av. Salamanca 12',
          city: 'Alicante',
          state: 'Alicante',
          postalCode: '03005',
          country: 'ES',
        },
        phone: '+34 965 123 456',
        email: 'estacion@koalahostel.com',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        timezone: 'Europe/Madrid',
      },
      {
        organizationId: orgId,
        name: 'Koala Hostel Mercado',
        code: 'KHM',
        address: {
          street: 'Calle Mayor 8',
          city: 'Alicante',
          state: 'Alicante',
          postalCode: '03002',
          country: 'ES',
        },
        phone: '+34 965 789 012',
        email: 'mercado@koalahostel.com',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        timezone: 'Europe/Madrid',
      },
    ])
    .returning();

  const kheId = propKHE!.id;
  const khmId = propKHM!.id;
  console.log(`   ✓ ${propKHE!.name} (${kheId})`);
  console.log(`   ✓ ${propKHM!.name} (${khmId})`);

  // ── 4. Room Types ──
  console.log('🛏️  Creating room types...');

  // KHE room types
  const [kheDbl, kheSgl, kheDrm6] = await db
    .insert(roomTypes)
    .values([
      {
        organizationId: orgId,
        propertyId: kheId,
        name: 'Habitación Doble',
        code: 'DBL',
        description: 'Habitación doble con baño privado, aire acondicionado y wifi.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        amenities: ['wifi', 'ac', 'private_bathroom', 'towels', 'locker'],
        sortOrder: 1,
      },
      {
        organizationId: orgId,
        propertyId: kheId,
        name: 'Habitación Individual',
        code: 'SGL',
        description: 'Habitación individual con baño privado, aire acondicionado y wifi.',
        baseOccupancy: 1,
        maxOccupancy: 1,
        amenities: ['wifi', 'ac', 'private_bathroom', 'towels', 'locker'],
        sortOrder: 2,
      },
      {
        organizationId: orgId,
        propertyId: kheId,
        name: 'Dormitorio 6 camas',
        code: 'DRM6',
        description: 'Dormitorio compartido con 6 literas, taquillas individuales y baño compartido.',
        baseOccupancy: 1,
        maxOccupancy: 6,
        amenities: ['wifi', 'ac', 'shared_bathroom', 'locker', 'reading_light'],
        sortOrder: 3,
      },
    ])
    .returning();

  // KHM room types
  const [khmDbl, khmSte] = await db
    .insert(roomTypes)
    .values([
      {
        organizationId: orgId,
        propertyId: khmId,
        name: 'Habitación Doble',
        code: 'DBL',
        description: 'Habitación doble superior con vistas al Mercado Central.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        amenities: ['wifi', 'ac', 'private_bathroom', 'towels', 'minibar'],
        sortOrder: 1,
      },
      {
        organizationId: orgId,
        propertyId: khmId,
        name: 'Suite',
        code: 'STE',
        description: 'Suite con salón independiente, bañera de hidromasaje y terraza privada.',
        baseOccupancy: 2,
        maxOccupancy: 3,
        amenities: ['wifi', 'ac', 'private_bathroom', 'towels', 'minibar', 'jacuzzi', 'terrace'],
        sortOrder: 2,
      },
    ])
    .returning();

  console.log(`   ✓ KHE: ${kheDbl!.name}, ${kheSgl!.name}, ${kheDrm6!.name}`);
  console.log(`   ✓ KHM: ${khmDbl!.name}, ${khmSte!.name}`);

  // ── 5. Units ──
  console.log('🚪 Creating units...');

  // KHE - Doble: 101-106
  const kheUnitsData = [
    ...Array.from({ length: 6 }, (_, i) => ({
      organizationId: orgId,
      propertyId: kheId,
      roomTypeId: kheDbl!.id,
      name: `${101 + i}`,
      floor: '1',
      status: 'available' as const,
      housekeepingStatus: 'clean' as const,
      sortOrder: 101 + i,
    })),
    // KHE - Individual: 107-110
    ...Array.from({ length: 4 }, (_, i) => ({
      organizationId: orgId,
      propertyId: kheId,
      roomTypeId: kheSgl!.id,
      name: `${107 + i}`,
      floor: '1',
      status: 'available' as const,
      housekeepingStatus: 'clean' as const,
      sortOrder: 107 + i,
    })),
    // KHE - Dormitorio: 201-203
    ...Array.from({ length: 3 }, (_, i) => ({
      organizationId: orgId,
      propertyId: kheId,
      roomTypeId: kheDrm6!.id,
      name: `${201 + i}`,
      floor: '2',
      status: 'available' as const,
      housekeepingStatus: 'clean' as const,
      sortOrder: 201 + i,
    })),
  ];

  const kheUnits = await db.insert(units).values(kheUnitsData).returning();

  // KHM - Doble: 101-104
  const khmUnitsData = [
    ...Array.from({ length: 4 }, (_, i) => ({
      organizationId: orgId,
      propertyId: khmId,
      roomTypeId: khmDbl!.id,
      name: `${101 + i}`,
      floor: '1',
      status: 'available' as const,
      housekeepingStatus: 'clean' as const,
      sortOrder: 101 + i,
    })),
    // KHM - Suite: 201-202
    ...Array.from({ length: 2 }, (_, i) => ({
      organizationId: orgId,
      propertyId: khmId,
      roomTypeId: khmSte!.id,
      name: `${201 + i}`,
      floor: '2',
      status: 'available' as const,
      housekeepingStatus: 'clean' as const,
      sortOrder: 201 + i,
    })),
  ];

  const khmUnits = await db.insert(units).values(khmUnitsData).returning();

  console.log(`   ✓ KHE: ${kheUnits.length} units (101-110, 201-203)`);
  console.log(`   ✓ KHM: ${khmUnits.length} units (101-104, 201-202)`);

  // ── 6. Guests ──
  console.log('🧑 Creating guests...');
  const [guest1, guest2, guest3, guest4, guest5] = await db
    .insert(guests)
    .values([
      {
        organizationId: orgId,
        firstName: 'Carlos',
        lastName: 'Fernández',
        email: 'carlos.fernandez@gmail.com',
        phone: '+34 612 345 678',
        documentType: 'national_id',
        documentNumber: '12345678A',
        nationality: 'ES',
        dateOfBirth: '1985-03-15',
        vipStatus: 'gold',
        totalStays: '12',
        totalRevenue: '2450.00',
      },
      {
        organizationId: orgId,
        firstName: 'Emma',
        lastName: 'Johnson',
        email: 'emma.j@outlook.com',
        phone: '+44 7700 900123',
        documentType: 'passport',
        documentNumber: 'GB123456789',
        nationality: 'GB',
        dateOfBirth: '1992-07-22',
        vipStatus: 'none',
        totalStays: '2',
        totalRevenue: '380.00',
      },
      {
        organizationId: orgId,
        firstName: 'Hans',
        lastName: 'Müller',
        email: 'hans.mueller@web.de',
        phone: '+49 170 1234567',
        documentType: 'passport',
        documentNumber: 'DE987654321',
        nationality: 'DE',
        dateOfBirth: '1978-11-03',
        vipStatus: 'silver',
        totalStays: '5',
        totalRevenue: '1200.00',
      },
      {
        organizationId: orgId,
        firstName: 'Lucía',
        lastName: 'Martínez',
        email: 'lucia.mtz@yahoo.es',
        phone: '+34 698 765 432',
        documentType: 'national_id',
        documentNumber: '87654321B',
        nationality: 'ES',
        dateOfBirth: '1990-01-28',
        vipStatus: 'none',
        totalStays: '1',
        totalRevenue: '95.00',
      },
      {
        organizationId: orgId,
        firstName: 'Pierre',
        lastName: 'Dupont',
        email: 'pierre.dupont@free.fr',
        phone: '+33 6 12 34 56 78',
        documentType: 'passport',
        documentNumber: 'FR112233445',
        nationality: 'FR',
        dateOfBirth: '1988-09-10',
        vipStatus: 'none',
        totalStays: '3',
        totalRevenue: '540.00',
      },
    ])
    .returning();

  console.log(`   ✓ ${guest1!.firstName} ${guest1!.lastName} (VIP Gold)`);
  console.log(`   ✓ ${guest2!.firstName} ${guest2!.lastName}`);
  console.log(`   ✓ ${guest3!.firstName} ${guest3!.lastName} (VIP Silver)`);
  console.log(`   ✓ ${guest4!.firstName} ${guest4!.lastName}`);
  console.log(`   ✓ ${guest5!.firstName} ${guest5!.lastName}`);

  // ── 7. Rate Plans ──
  console.log('💰 Creating rate plans...');
  const [stdRate] = await db
    .insert(ratePlans)
    .values([
      {
        organizationId: orgId,
        propertyId: kheId,
        name: 'Tarifa Estándar',
        code: 'STD',
        description: 'Tarifa flexible con cancelación gratuita hasta 24h antes.',
        cancellationPolicy: 'free',
        cancellationHours: 24,
        priority: 1,
      },
      {
        organizationId: orgId,
        propertyId: kheId,
        name: 'No Reembolsable',
        code: 'NR',
        description: 'Mejor precio garantizado. Sin cancelación ni modificación.',
        cancellationPolicy: 'non_refundable',
        cancellationHours: 0,
        priority: 2,
      },
      {
        organizationId: orgId,
        propertyId: khmId,
        name: 'Tarifa Estándar',
        code: 'STD',
        description: 'Tarifa flexible con cancelación gratuita hasta 48h antes.',
        cancellationPolicy: 'free',
        cancellationHours: 48,
        priority: 1,
      },
    ])
    .returning();

  console.log('   ✓ Rate plans created');

  // ── 8. Reservations ──
  console.log('📋 Creating reservations...');

  // Reservation 1: Confirmed (future) — Carlos in KHE Doble 101
  const kheUnit101 = kheUnits.find((u) => u.name === '101')!;
  const kheUnit103 = kheUnits.find((u) => u.name === '103')!;
  const kheUnit201 = kheUnits.find((u) => u.name === '201')!;

  const [res1, res2, res3] = await db
    .insert(reservations)
    .values([
      {
        organizationId: orgId,
        propertyId: kheId,
        confirmationCode: 'KHE-2026-00001',
        guestId: guest1!.id,
        roomTypeId: kheDbl!.id,
        unitId: kheUnit101.id,
        status: 'confirmed',
        source: 'direct',
        checkInDate: '2026-02-20',
        checkOutDate: '2026-02-23',
        nights: 3,
        adults: 2,
        children: 0,
        totalAmount: '270.00',
        currency: 'EUR',
        specialRequests: 'Habitación alta si es posible. Llegamos tarde, sobre las 22h.',
      },
      // Reservation 2: Checked In (current) — Emma in KHE Doble 103
      {
        organizationId: orgId,
        propertyId: kheId,
        confirmationCode: 'KHE-2026-00002',
        guestId: guest2!.id,
        roomTypeId: kheDbl!.id,
        unitId: kheUnit103.id,
        status: 'checked_in',
        source: 'booking_com',
        checkInDate: '2026-02-10',
        checkOutDate: '2026-02-14',
        nights: 4,
        adults: 2,
        children: 0,
        totalAmount: '360.00',
        currency: 'EUR',
        specialRequests: 'Extra pillows please.',
      },
      // Reservation 3: Checked Out (past) — Hans in KHE Dorm 201
      {
        organizationId: orgId,
        propertyId: kheId,
        confirmationCode: 'KHE-2026-00003',
        guestId: guest3!.id,
        roomTypeId: kheDrm6!.id,
        unitId: kheUnit201.id,
        status: 'checked_out',
        source: 'website',
        checkInDate: '2026-02-05',
        checkOutDate: '2026-02-08',
        nights: 3,
        adults: 1,
        children: 0,
        totalAmount: '75.00',
        currency: 'EUR',
      },
    ])
    .returning();

  console.log(`   ✓ ${res1!.confirmationCode} — Confirmed (${guest1!.lastName}, Feb 20-23)`);
  console.log(`   ✓ ${res2!.confirmationCode} — Checked In (${guest2!.lastName}, Feb 10-14)`);
  console.log(`   ✓ ${res3!.confirmationCode} — Checked Out (${guest3!.lastName}, Feb 05-08)`);

  // ── 9. Folios (for checked_in and checked_out reservations) ──
  console.log('🧾 Creating folios...');

  const [folio2, folio3] = await db
    .insert(folios)
    .values([
      {
        organizationId: orgId,
        reservationId: res2!.id,
        guestId: guest2!.id,
        folioNumber: 'F-2026-00001',
        status: 'open',
        subtotal: '360.00',
        taxTotal: '36.00',
        total: '396.00',
        paidAmount: '0.00',
        balance: '396.00',
        currency: 'EUR',
      },
      {
        organizationId: orgId,
        reservationId: res3!.id,
        guestId: guest3!.id,
        folioNumber: 'F-2026-00002',
        status: 'closed',
        subtotal: '75.00',
        taxTotal: '7.50',
        total: '82.50',
        paidAmount: '82.50',
        balance: '0.00',
        currency: 'EUR',
        closedAt: new Date('2026-02-08T10:30:00Z'),
      },
    ])
    .returning();

  // Folio line items for checked_in reservation (room charges)
  await db.insert(folioLineItems).values(
    Array.from({ length: 4 }, (_, i) => ({
      organizationId: orgId,
      folioId: folio2!.id,
      type: 'room_charge',
      description: `Habitación Doble — Noche ${i + 1}`,
      date: `2026-02-${10 + i}`,
      quantity: 1,
      unitPrice: '90.00',
      amount: '90.00',
      taxRate: '10.00',
      taxAmount: '9.00',
      createdBy: adminUser!.id,
    })),
  );

  // Folio line items for checked_out reservation
  await db.insert(folioLineItems).values(
    Array.from({ length: 3 }, (_, i) => ({
      organizationId: orgId,
      folioId: folio3!.id,
      type: 'room_charge',
      description: `Dormitorio 6 camas — Noche ${i + 1}`,
      date: `2026-02-0${5 + i}`,
      quantity: 1,
      unitPrice: '25.00',
      amount: '25.00',
      taxRate: '10.00',
      taxAmount: '2.50',
      createdBy: adminUser!.id,
    })),
  );

  console.log(`   ✓ ${folio2!.folioNumber} — Open (balance: €396.00)`);
  console.log(`   ✓ ${folio3!.folioNumber} — Closed (paid: €82.50)`);

  // ── 10. Update unit statuses for active reservations ──
  // Room 103 is occupied (checked_in guest)
  await db
    .update(units)
    .set({ housekeepingStatus: 'dirty' })
    .where(sql`${units.id} = ${kheUnit103.id}`);

  // Room 201 was checked out — dirty, needs cleaning
  await db
    .update(units)
    .set({ housekeepingStatus: 'dirty' })
    .where(sql`${units.id} = ${kheUnit201.id}`);

  // ── 11. Housekeeping tasks ──
  console.log('🧹 Creating housekeeping tasks...');
  await db.insert(housekeepingTasks).values([
    {
      organizationId: orgId,
      propertyId: kheId,
      unitId: kheUnit201.id,
      type: 'checkout_clean',
      status: 'pending',
      priority: 'high',
      scheduledDate: '2026-02-12',
      notes: 'Checkout clean — guest checked out this morning.',
    },
    {
      organizationId: orgId,
      propertyId: kheId,
      unitId: kheUnit103.id,
      type: 'stay_over',
      status: 'pending',
      priority: 'normal',
      scheduledDate: '2026-02-12',
      notes: 'Stay-over clean — guest staying until Feb 14.',
    },
  ]);

  console.log('   ✓ Checkout clean for room 201');
  console.log('   ✓ Stay-over clean for room 103');

  // ── Done ──
  console.log('');
  console.log('============================================');
  console.log('🎉 Seed completed successfully!');
  console.log('============================================');
  console.log('');
  console.log('Summary:');
  console.log(`  Organization: ${org!.name}`);
  console.log(`  Properties:   2 (KHE, KHM)`);
  console.log(`  Room Types:   5 (3 KHE + 2 KHM)`);
  console.log(`  Units:        ${kheUnits.length + khmUnits.length} (${kheUnits.length} KHE + ${khmUnits.length} KHM)`);
  console.log(`  Users:        2 (admin + front_desk)`);
  console.log(`  Guests:       5`);
  console.log(`  Reservations: 3 (confirmed, checked_in, checked_out)`);
  console.log(`  Folios:       2 (1 open, 1 closed)`);
  console.log(`  HK Tasks:     2`);

  await client.end();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
