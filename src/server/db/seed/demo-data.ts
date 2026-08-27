/**
 * Demo dataset generator for ANY client property.
 *
 * Adds ONE property — with its room types, units, rate plans, per-date rates,
 * guests, reservations across past/present/future, folios, payments and
 * housekeeping tasks — to an organization that ALREADY EXISTS in the database.
 *
 * Nothing outside that property (and the guests it creates) is ever touched:
 * other organizations and other properties are left untouched.
 *
 * Idempotent per `--code`: re-running wipes only what a previous run with the
 * same property code created, and rebuilds it, so the dataset always stays
 * centred on "today". Two demo properties with different codes coexist fine.
 *
 *   npm run db:seed:demo -- --list
 *   npm run db:seed:demo -- --org=hotel-guardamar --code=HGU --name="Apartamentos Hotel Guardamar"
 *   npm run db:seed:demo -- --org=acme --code=ACM --preset=hotel --units=60
 *   npm run db:seed:demo -- --help
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  organizations,
  users,
  memberships,
  properties,
  roomTypes,
  roomTypeImages,
  units,
  guests,
  reservations,
  ratePlans,
  rates,
  seasons,
  supplements,
  folios,
  folioLineItems,
  payments,
  housekeepingTasks,
  roomBlocks,
  bookingEngineSettings,
  bookingEngineAddons,
  integrations,
} from '../schema';

// ─────────────────────────────────────────────────────────────────────────────
// Room type presets
// ─────────────────────────────────────────────────────────────────────────────

type RoomTypeKey = string;

type RoomTypeDef = {
  key: RoomTypeKey;
  name: string;
  description: string;
  baseOccupancy: number;
  maxOccupancy: number;
  /** Standard-plan price for a mid-season weekday night, in EUR. */
  basePrice: number;
  amenities: string[];
  /** Relative share of the property's units. */
  weight: number;
};

const PRESETS: Record<string, { unitNoun: string; types: RoomTypeDef[] }> = {
  apartments: {
    unitNoun: 'apartamentos',
    types: [
      {
        key: 'EST',
        name: 'Estudio',
        description:
          'Estudio de 32 m² con cama de matrimonio, cocina americana totalmente equipada, baño completo y terraza.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        basePrice: 75,
        amenities: ['wifi', 'ac', 'kitchen', 'private_bathroom', 'terrace', 'tv', 'safe'],
        weight: 12,
      },
      {
        key: 'A1D',
        name: 'Apartamento 1 dormitorio',
        description:
          'Apartamento de 55 m² con dormitorio independiente, salón con sofá cama, cocina equipada, baño completo y terraza.',
        baseOccupancy: 2,
        maxOccupancy: 4,
        basePrice: 110,
        amenities: ['wifi', 'ac', 'kitchen', 'private_bathroom', 'terrace', 'tv', 'safe', 'washing_machine'],
        weight: 16,
      },
      {
        key: 'A2D',
        name: 'Apartamento 2 dormitorios',
        description:
          'Apartamento de 80 m² con dos dormitorios, dos baños, salón-comedor, cocina equipada y terraza.',
        baseOccupancy: 4,
        maxOccupancy: 6,
        basePrice: 165,
        amenities: [
          'wifi', 'ac', 'kitchen', 'private_bathroom', 'terrace', 'tv', 'safe', 'washing_machine', 'dishwasher',
        ],
        weight: 8,
      },
    ],
  },
  hotel: {
    unitNoun: 'habitaciones',
    types: [
      {
        key: 'SGL',
        name: 'Habitación Individual',
        description: 'Habitación individual con cama de 105 cm, baño completo, escritorio y aire acondicionado.',
        baseOccupancy: 1,
        maxOccupancy: 1,
        basePrice: 65,
        amenities: ['wifi', 'ac', 'private_bathroom', 'tv', 'safe', 'desk'],
        weight: 4,
      },
      {
        key: 'DBL',
        name: 'Habitación Doble',
        description: 'Habitación doble con cama de matrimonio o dos camas individuales y baño completo.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        basePrice: 95,
        amenities: ['wifi', 'ac', 'private_bathroom', 'tv', 'safe', 'minibar'],
        weight: 14,
      },
      {
        key: 'DBS',
        name: 'Doble Superior',
        description: 'Habitación doble superior, más amplia, con zona de estar y terraza privada.',
        baseOccupancy: 2,
        maxOccupancy: 3,
        basePrice: 125,
        amenities: ['wifi', 'ac', 'private_bathroom', 'tv', 'safe', 'minibar', 'terrace'],
        weight: 10,
      },
      {
        key: 'STE',
        name: 'Suite',
        description: 'Suite con salón independiente, bañera de hidromasaje y terraza amplia.',
        baseOccupancy: 2,
        maxOccupancy: 4,
        basePrice: 190,
        amenities: ['wifi', 'ac', 'private_bathroom', 'tv', 'safe', 'minibar', 'terrace', 'jacuzzi'],
        weight: 4,
      },
    ],
  },
  hostel: {
    unitNoun: 'habitaciones',
    types: [
      {
        key: 'DRM6',
        name: 'Dormitorio 6 camas',
        description: 'Dormitorio compartido de 6 literas con taquilla individual, luz de lectura y baño compartido.',
        baseOccupancy: 1,
        maxOccupancy: 6,
        basePrice: 22,
        amenities: ['wifi', 'ac', 'shared_bathroom', 'locker', 'reading_light'],
        weight: 6,
      },
      {
        key: 'DRM4',
        name: 'Dormitorio 4 camas',
        description: 'Dormitorio compartido de 4 camas con baño privado en la habitación.',
        baseOccupancy: 1,
        maxOccupancy: 4,
        basePrice: 28,
        amenities: ['wifi', 'ac', 'private_bathroom', 'locker', 'reading_light'],
        weight: 4,
      },
      {
        key: 'DBL',
        name: 'Habitación Doble Privada',
        description: 'Habitación doble privada con baño propio y aire acondicionado.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        basePrice: 70,
        amenities: ['wifi', 'ac', 'private_bathroom', 'towels', 'locker'],
        weight: 6,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

type ArgMap = {
  list: boolean;
  help: boolean;
  org?: string;
  code: string;
  name?: string;
  city: string;
  preset: string;
  units: number;
  perFloor: number;
  guests: number;
  daysPast: number;
  daysFuture: number;
  occupancy: number;
  seed: number;
};

const USAGE = `
Genera datos de demo para una propiedad dentro de una organización existente.

  npm run db:seed:demo -- [opciones]

Opciones:
  --list                  Lista las organizaciones de la base de datos y sale.
  --org=<slug>            Organización destino. Obligatorio si hay más de una.
  --code=<COD>            Código de la propiedad (máx. 10). Clave de idempotencia. Por defecto: HGU
  --name="<nombre>"       Nombre de la propiedad. Por defecto: el nombre de la organización.
  --city="<ciudad>"       Ciudad de la dirección. Por defecto: Guardamar del Segura
  --preset=<tipo>         Catálogo de tipologías: ${Object.keys(PRESETS).join(' | ')}. Por defecto: apartments
  --units=<n>             Nº de unidades. Por defecto: 36
  --per-floor=<n>         Unidades por planta. Por defecto: 9
  --guests=<n>            Nº de huéspedes ficticios. Por defecto: 80
  --days-past=<n>         Días de histórico de reservas. Por defecto: 45
  --days-future=<n>       Días de reservas futuras. Por defecto: 120
  --occupancy=<0-1>       Ocupación objetivo. Por defecto: 0.72
  --seed=<n>              Semilla aleatoria (misma semilla = mismos datos). Por defecto: 20260827
  --help                  Muestra esta ayuda.

Volver a ejecutarlo con el mismo --code borra solo esos datos y los regenera con
fechas actualizadas. Nunca toca otras propiedades ni otras organizaciones.
`;

function parseArgs(): ArgMap {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (hit === undefined) return undefined;
    return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
  };
  const num = (name: string, fallback: number): number => {
    const raw = flag(name);
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      console.error(`❌ --${name} debe ser un número (recibido: "${raw}").`);
      process.exit(1);
    }
    return parsed;
  };

  const args: ArgMap = {
    list: flag('list') !== undefined,
    help: flag('help') !== undefined,
    org: flag('org') || undefined,
    code: (flag('code') || 'HGU').toUpperCase(),
    name: flag('name') || undefined,
    city: flag('city') || 'Guardamar del Segura',
    preset: flag('preset') || 'apartments',
    units: Math.max(1, Math.round(num('units', 36))),
    perFloor: Math.max(1, Math.round(num('per-floor', 9))),
    guests: Math.max(5, Math.round(num('guests', 80))),
    daysPast: Math.max(0, Math.round(num('days-past', 45))),
    daysFuture: Math.max(7, Math.round(num('days-future', 120))),
    occupancy: Math.min(0.95, Math.max(0.1, num('occupancy', 0.72))),
    seed: Math.round(num('seed', 20260827)),
  };

  if (!PRESETS[args.preset]) {
    console.error(`❌ Preset desconocido: "${args.preset}". Disponibles: ${Object.keys(PRESETS).join(', ')}.`);
    process.exit(1);
  }
  if (args.code.length > 10) {
    console.error(`❌ --code no puede pasar de 10 caracteres (recibido: "${args.code}").`);
    process.exit(1);
  }
  return args;
}

const ARGS = parseArgs();

// ─────────────────────────────────────────────────────────────────────────────
// Config (derived from the CLI)
// ─────────────────────────────────────────────────────────────────────────────

/** Property code — the idempotency key for this dataset. */
const PROPERTY_CODE = ARGS.code;
/** Marker written to `guests.notes` so re-runs can find and remove them. */
const DEMO_TAG = `[seed:demo:${PROPERTY_CODE}]`;

const ROOM_TYPE_DEFS: ReadonlyArray<RoomTypeDef> = PRESETS[ARGS.preset]!.types;
const UNIT_NOUN = PRESETS[ARGS.preset]!.unitNoun;

/** Reservation window, in days relative to today. */
const DAYS_PAST = ARGS.daysPast;
const DAYS_FUTURE = ARGS.daysFuture;
/** Rate calendar window, in days relative to today — always covers the reservations. */
const RATES_PAST = DAYS_PAST;
const RATES_FUTURE = DAYS_FUTURE + 60;
/** Share of nights that should end up sold. */
const TARGET_OCCUPANCY = ARGS.occupancy;
/** Fixed seed → identical dataset on every run. */
const RANDOM_SEED = ARGS.seed;

const IVA_ALOJAMIENTO = 10; // %

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so the demo data never shifts between runs. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makeRandom(RANDOM_SEED);
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
/** Weighted pick: `[value, weight]` pairs. */
function pickWeighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rnd() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const DAY_MS = 86_400_000;

/** Today at UTC midnight — every date in this dataset is relative to it. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
const dayOffset = (base: Date, n: number): string => toDateStr(addDays(base, n));
/** Whole days between two YYYY-MM-DD strings. */
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Insert in chunks — Postgres caps bind parameters per statement. */
async function insertChunked<T>(
  label: string,
  rows: T[],
  run: (chunk: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size));
  }
  console.log(`   ✓ ${rows.length} ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing model
// ─────────────────────────────────────────────────────────────────────────────

/** Unit layout derived from --units / --per-floor. */
const FLOORS = Math.ceil(ARGS.units / ARGS.perFloor);
const TOTAL_WEIGHT = ROOM_TYPE_DEFS.reduce((sum, d) => sum + d.weight, 0);

/**
 * Which room type a given slot on a floor gets. Splitting the mix *within* each
 * floor (rather than one type per floor) is what makes the tape chart look real.
 */
function unitTypeFor(indexInFloor: number): RoomTypeKey {
  let acc = 0;
  for (const def of ROOM_TYPE_DEFS) {
    acc += (def.weight / TOTAL_WEIGHT) * ARGS.perFloor;
    if (indexInFloor < Math.round(acc)) return def.key;
  }
  return ROOM_TYPE_DEFS[ROOM_TYPE_DEFS.length - 1]!.key;
}

type SeasonKey = 'alta' | 'media' | 'baja' | 'navidad';

const SEASON_MULTIPLIER: Record<SeasonKey, number> = {
  alta: 1.45,
  media: 1.1,
  baja: 0.8,
  navidad: 1.3,
};

/** Costa-Blanca style seasonality keyed on month/day. */
function seasonFor(dateStr: string): SeasonKey {
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  if (month === 12 && day >= 20) return 'navidad';
  if (month === 1 && day <= 6) return 'navidad';
  if (month === 7 || month === 8) return 'alta';
  if (month === 6 || month === 9) return 'media';
  if (month === 4 || month === 5 || month === 10) return 'media';
  return 'baja';
}

const RATE_PLAN_DEFS = [
  { code: 'STD', factor: 1, minStay: 1 },
  { code: 'NR', factor: 0.88, minStay: 1 },
  { code: 'LARGA', factor: 0.82, minStay: 7 },
] as const;

/** Nightly price for a room type on a date under the standard plan. */
function nightlyPrice(base: number, dateStr: string): number {
  const seasonMult = SEASON_MULTIPLIER[seasonFor(dateStr)];
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const weekendMult = weekday === 5 || weekday === 6 ? 1.15 : 1;
  return Math.round(base * seasonMult * weekendMult);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest name pools
// ─────────────────────────────────────────────────────────────────────────────

const GUEST_POOL: ReadonlyArray<{
  first: string[];
  last: string[];
  nationality: string;
  phonePrefix: string;
  domains: string[];
  weight: number;
}> = [
  {
    nationality: 'ES',
    phonePrefix: '+34 6',
    domains: ['gmail.com', 'hotmail.es', 'yahoo.es', 'telefonica.net'],
    weight: 34,
    first: ['Carmen', 'Javier', 'Lucía', 'Antonio', 'Marta', 'Sergio', 'Elena', 'Rubén', 'Nuria', 'Álvaro', 'Paula', 'Iván'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Navarro', 'Ruiz', 'Ortega', 'Serrano', 'Molina', 'Castillo'],
  },
  {
    nationality: 'GB',
    phonePrefix: '+44 77',
    domains: ['gmail.com', 'outlook.com', 'btinternet.com'],
    weight: 22,
    first: ['Oliver', 'Emily', 'Jack', 'Sophie', 'Harry', 'Chloe', 'George', 'Amelia', 'Thomas', 'Grace'],
    last: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thompson', 'Walker', 'Wright', 'Hughes'],
  },
  {
    nationality: 'DE',
    phonePrefix: '+49 17',
    domains: ['web.de', 'gmx.de', 'gmail.com'],
    weight: 14,
    first: ['Lukas', 'Anna', 'Felix', 'Laura', 'Jonas', 'Sarah', 'Maximilian', 'Julia', 'Niklas', 'Lena'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter'],
  },
  {
    nationality: 'FR',
    phonePrefix: '+33 6',
    domains: ['free.fr', 'orange.fr', 'gmail.com'],
    weight: 12,
    first: ['Julien', 'Camille', 'Nicolas', 'Manon', 'Antoine', 'Chloé', 'Maxime', 'Léa', 'Hugo', 'Sarah'],
    last: ['Dubois', 'Bernard', 'Moreau', 'Laurent', 'Girard', 'Petit', 'Roux', 'Fournier', 'Lambert', 'Mercier'],
  },
  {
    nationality: 'NL',
    phonePrefix: '+31 6',
    domains: ['gmail.com', 'ziggo.nl', 'kpnmail.nl'],
    weight: 10,
    first: ['Daan', 'Sanne', 'Bram', 'Fenna', 'Lars', 'Anouk', 'Sven', 'Iris'],
    last: ['de Jong', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'Bos'],
  },
  {
    nationality: 'BE',
    phonePrefix: '+32 4',
    domains: ['telenet.be', 'skynet.be', 'gmail.com'],
    weight: 8,
    first: ['Wout', 'Lotte', 'Arne', 'Marie', 'Seppe', 'Noor'],
    last: ['Peeters', 'Janssens', 'Maes', 'Willems', 'Claes', 'Goossens'],
  },
];

const stripAccents = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL no está definida.');
  console.error('   Añádela a .env.local (o ejecuta `vercel env pull .env.local`) y reintenta.');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function resolveOrganization(args: ArgMap) {
  const all = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations);

  if (args.list) {
    console.log('Organizaciones en la base de datos:');
    for (const o of all) console.log(`  • ${o.name}  —  slug: ${o.slug}`);
    return null;
  }

  if (args.org) {
    const match = all.find((o) => o.slug === args.org);
    if (!match) {
      console.error(`❌ No existe ninguna organización con slug "${args.org}".`);
      console.error(`   Disponibles: ${all.map((o) => o.slug).join(', ') || '(ninguna)'}`);
      process.exit(1);
    }
    return match;
  }

  // No --org: only safe to guess when the database holds exactly one organization.
  if (all.length === 1) return all[0]!;
  if (all.length === 0) {
    console.error('❌ No hay ninguna organización en la base de datos.');
    process.exit(1);
  }
  console.error('❌ Hay varias organizaciones; indica cuál con --org=<slug>:');
  for (const o of all) console.error(`   • ${o.name} (slug: ${o.slug})`);
  process.exit(1);
}

/** Remove everything a previous run of THIS script left behind. */
async function cleanPreviousRun(orgId: string): Promise<void> {
  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.organizationId, orgId), eq(properties.code, PROPERTY_CODE)));

  if (existing) {
    const propId = existing.id;
    console.log(`🗑️  Borrando datos de una ejecución anterior (propiedad ${PROPERTY_CODE})...`);

    const rtIds = (
      await db.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.propertyId, propId))
    ).map((r) => r.id);
    const rpIds = (
      await db.select({ id: ratePlans.id }).from(ratePlans).where(eq(ratePlans.propertyId, propId))
    ).map((r) => r.id);
    const resIds = (
      await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.propertyId, propId))
    ).map((r) => r.id);
    const folioIds = resIds.length
      ? (await db.select({ id: folios.id }).from(folios).where(inArray(folios.reservationId, resIds))).map(
          (r) => r.id,
        )
      : [];

    await db.delete(housekeepingTasks).where(eq(housekeepingTasks.propertyId, propId));
    await db.delete(roomBlocks).where(eq(roomBlocks.propertyId, propId));
    if (folioIds.length) {
      await db.delete(payments).where(inArray(payments.folioId, folioIds));
      await db.delete(folioLineItems).where(inArray(folioLineItems.folioId, folioIds));
      await db.delete(folios).where(inArray(folios.id, folioIds));
    }
    if (resIds.length) await db.delete(reservations).where(inArray(reservations.id, resIds));
    if (rpIds.length) await db.delete(rates).where(inArray(rates.ratePlanId, rpIds));
    if (rtIds.length) {
      await db.delete(rates).where(inArray(rates.roomTypeId, rtIds));
      await db.delete(roomTypeImages).where(inArray(roomTypeImages.roomTypeId, rtIds));
    }
    await db.delete(supplements).where(eq(supplements.propertyId, propId));
    await db.delete(seasons).where(eq(seasons.propertyId, propId));
    await db.delete(bookingEngineAddons).where(eq(bookingEngineAddons.propertyId, propId));
    await db.delete(bookingEngineSettings).where(eq(bookingEngineSettings.propertyId, propId));
    await db.delete(integrations).where(eq(integrations.propertyId, propId));
    await db.delete(units).where(eq(units.propertyId, propId));
    await db.delete(roomTypes).where(eq(roomTypes.propertyId, propId));
    await db.delete(ratePlans).where(eq(ratePlans.propertyId, propId));
    await db.delete(properties).where(eq(properties.id, propId));
  }

  // Guests are org-scoped, not property-scoped — only remove the tagged ones.
  const deletedGuests = await db
    .delete(guests)
    .where(and(eq(guests.organizationId, orgId), sql`${guests.notes} LIKE ${'%' + DEMO_TAG + '%'}`))
    .returning({ id: guests.id });
  if (deletedGuests.length) console.log(`   ✓ ${deletedGuests.length} huéspedes de demo borrados`);
}

async function run(): Promise<void> {
  if (ARGS.help) {
    console.log(USAGE);
    return;
  }
  const org = await resolveOrganization(ARGS);
  if (!org) return; // --list

  const propertyName = ARGS.name ?? org.name;
  console.log('');
  console.log('============================================');
  console.log(`🌴 Datos de demo → ${org.name} (${org.slug})`);
  console.log(`   Propiedad "${propertyName}" [${PROPERTY_CODE}] · preset ${ARGS.preset} · ${ARGS.units} uds`);
  console.log('============================================');
  const orgId = org.id;

  await cleanPreviousRun(orgId);

  // Owner user of the org — used as `createdBy` on charges and tasks.
  const [ownerUser] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(memberships.organizationId, orgId), eq(memberships.isActive, true)))
    .orderBy(sql`CASE ${memberships.role} WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END`)
    .limit(1);
  const createdBy = ownerUser?.id ?? null;

  const base = todayUtc();
  const today = toDateStr(base);

  // ── 1. Property ──
  console.log('🏨 Creando propiedad...');
  const [property] = await db
    .insert(properties)
    .values({
      organizationId: orgId,
      name: propertyName,
      code: PROPERTY_CODE,
      address: {
        street: 'Av. de Europa 45',
        city: ARGS.city,
        state: 'Alicante',
        postalCode: '03140',
        country: 'ES',
      },
      phone: '+34 966 728 100',
      email: `reservas@${org.slug}.com`,
      checkInTime: '16:00',
      checkOutTime: '11:00',
      timezone: 'Europe/Madrid',
      plan: 'professional',
      maxUnits: 50,
    })
    .returning();
  const propertyId = property!.id;
  console.log(`   ✓ ${property!.name} (${PROPERTY_CODE})`);

  // ── 2. Room types ──
  console.log('🛏️  Creando tipologías...');
  const insertedRoomTypes = await db
    .insert(roomTypes)
    .values(
      ROOM_TYPE_DEFS.map((rt, i) => ({
        organizationId: orgId,
        propertyId,
        name: rt.name,
        code: rt.key,
        description: rt.description,
        baseOccupancy: rt.baseOccupancy,
        maxOccupancy: rt.maxOccupancy,
        amenities: rt.amenities,
        sortOrder: i + 1,
      })),
    )
    .returning();

  const roomTypeIdByKey = new Map<RoomTypeKey, string>();
  for (const rt of insertedRoomTypes) roomTypeIdByKey.set(rt.code, rt.id);
  const defByKey = new Map(ROOM_TYPE_DEFS.map((d) => [d.key, d] as const));
  console.log(`   ✓ ${insertedRoomTypes.length} tipologías (Estudio, 1 dorm, 2 dorm)`);

  // ── 3. Units ──
  console.log(`🚪 Creando ${ARGS.units} ${UNIT_NOUN}...`);
  const unitRows: Array<typeof units.$inferInsert> = [];
  for (let floor = 1; floor <= FLOORS; floor++) {
    for (let i = 0; i < ARGS.perFloor; i++) {
      if (unitRows.length >= ARGS.units) break; // last floor may be partial
      const key = unitTypeFor(i);
      const name = `${floor}${String(i + 1).padStart(2, '0')}`;
      unitRows.push({
        organizationId: orgId,
        propertyId,
        roomTypeId: roomTypeIdByKey.get(key)!,
        name,
        floor: String(floor),
        status: 'available',
        housekeepingStatus: 'clean',
        sortOrder: floor * 100 + i + 1,
      });
    }
  }
  const insertedUnits = await db.insert(units).values(unitRows).returning();
  console.log(`   ✓ ${insertedUnits.length} ${UNIT_NOUN} en ${FLOORS} plantas`);

  // One unit out of service, so the tape chart shows the maintenance state.
  const maintenanceUnit = insertedUnits[Math.min(insertedUnits.length - 1, ARGS.perFloor * 2 - 1)]!;
  await db
    .update(units)
    .set({ status: 'maintenance', housekeepingStatus: 'dirty', notes: 'Fuga en el baño principal — fontanero programado.' })
    .where(eq(units.id, maintenanceUnit.id));
  await db.insert(roomBlocks).values({
    organizationId: orgId,
    propertyId,
    unitId: maintenanceUnit.id,
    type: 'maintenance',
    startDate: dayOffset(base, -2),
    endDate: dayOffset(base, 5),
    reason: 'Reparación de fontanería y repintado del baño.',
    createdBy,
  });

  // ── 4. Seasons ──
  console.log('🗓️  Creando temporadas...');
  const year = base.getUTCFullYear();
  await db.insert(seasons).values([
    { organizationId: orgId, propertyId, name: 'Temporada baja', startDate: `${year}-01-07`, endDate: `${year}-03-31`, color: '#64748B' },
    { organizationId: orgId, propertyId, name: 'Temporada media (primavera)', startDate: `${year}-04-01`, endDate: `${year}-06-30`, color: '#0EA5E9' },
    { organizationId: orgId, propertyId, name: 'Temporada alta (verano)', startDate: `${year}-07-01`, endDate: `${year}-08-31`, color: '#F97316' },
    { organizationId: orgId, propertyId, name: 'Temporada media (otoño)', startDate: `${year}-09-01`, endDate: `${year}-10-31`, color: '#0EA5E9' },
    { organizationId: orgId, propertyId, name: 'Temporada baja (invierno)', startDate: `${year}-11-01`, endDate: `${year}-12-19`, color: '#64748B' },
    { organizationId: orgId, propertyId, name: 'Navidad y Reyes', startDate: `${year}-12-20`, endDate: `${year + 1}-01-06`, color: '#DC2626' },
  ]);
  console.log('   ✓ 6 temporadas');

  // ── 5. Rate plans ──
  console.log('💰 Creando planes de tarifa...');
  const insertedRatePlans = await db
    .insert(ratePlans)
    .values([
      {
        organizationId: orgId,
        propertyId,
        name: 'Tarifa Flexible',
        code: 'STD',
        description: 'Cancelación gratuita hasta 48 h antes de la llegada. Pago a la entrada.',
        cancellationPolicy: 'free',
        cancellationHours: 48,
        priority: 1,
      },
      {
        organizationId: orgId,
        propertyId,
        name: 'No Reembolsable',
        code: 'NR',
        description: 'Un 12 % de descuento. Pago íntegro en el momento de reservar, sin cancelación ni cambios.',
        cancellationPolicy: 'non_refundable',
        cancellationHours: 0,
        priority: 2,
      },
      {
        organizationId: orgId,
        propertyId,
        name: 'Larga Estancia (7+ noches)',
        code: 'LARGA',
        description: 'Un 18 % de descuento a partir de 7 noches. Limpieza semanal incluida.',
        cancellationPolicy: 'partial',
        cancellationHours: 168,
        priority: 3,
      },
    ])
    .returning();
  const ratePlanIdByCode = new Map(insertedRatePlans.map((rp) => [rp.code, rp.id] as const));
  console.log(`   ✓ ${insertedRatePlans.length} planes (STD, NR, LARGA)`);

  // ── 6. Rates ──
  console.log('💶 Creando calendario de tarifas...');
  const rateRows: Array<typeof rates.$inferInsert> = [];
  for (let d = -RATES_PAST; d <= RATES_FUTURE; d++) {
    const dateStr = dayOffset(base, d);
    const season = seasonFor(dateStr);
    for (const def of ROOM_TYPE_DEFS) {
      const std = nightlyPrice(def.basePrice, dateStr);
      for (const plan of RATE_PLAN_DEFS) {
        rateRows.push({
          organizationId: orgId,
          ratePlanId: ratePlanIdByCode.get(plan.code)!,
          roomTypeId: roomTypeIdByKey.get(def.key)!,
          date: dateStr,
          amount: (Math.round(std * plan.factor * 100) / 100).toFixed(2),
          currency: 'EUR',
          // High season asks for a 3-night floor on the standard plan.
          minStay: plan.minStay > 1 ? plan.minStay : season === 'alta' ? 3 : 1,
          closedToArrival: false,
          closedToDeparture: false,
        });
      }
    }
  }
  await insertChunked('tarifas diarias', rateRows, (chunk) => db.insert(rates).values(chunk));

  // ── 7. Supplements ──
  console.log('➕ Creando suplementos...');
  await db.insert(supplements).values([
    { organizationId: orgId, propertyId, name: 'Limpieza final', type: 'per_stay', amount: '45.00', taxRate: '21.00' },
    { organizationId: orgId, propertyId, name: 'Cuna de viaje', type: 'per_stay', amount: '12.00', taxRate: '21.00' },
    { organizationId: orgId, propertyId, name: 'Plaza de garaje', type: 'per_night', amount: '10.00', taxRate: '21.00' },
    { organizationId: orgId, propertyId, name: 'Mascota', type: 'per_stay', amount: '35.00', taxRate: '21.00' },
    { organizationId: orgId, propertyId, name: 'Persona adicional', type: 'per_person_night', amount: '18.00', taxRate: '10.00' },
  ]);
  console.log('   ✓ 5 suplementos');

  // ── 8. Booking engine ──
  console.log('⚙️  Configurando motor de reservas...');
  await db.insert(bookingEngineSettings).values({
    organizationId: orgId,
    propertyId,
    availabilityView: 'expanded',
    priceFormat: 'total_stay',
    specificRoom: false,
    addonsDisplay: 'before',
    guestFilter: 'full',
    defaultAdults: 2,
    showUnavailable: true,
    autoAssign: true,
    fieldPostalAddress: true,
    fieldNationality: true,
    fieldGender: false,
    fieldIdDocument: true,
    fieldCompany: false,
    fieldPhone: true,
    fieldArrivalTime: true,
    fieldTermsAndConditions: true,
    autoConfirmEmail: true,
    redirectConfirmation: false,
    language: 'es',
  });
  await db.insert(bookingEngineAddons).values([
    { organizationId: orgId, propertyId, name: 'Limpieza final', description: 'Limpieza a fondo del apartamento tras la salida.', price: '45.00', currency: 'EUR', addonType: 'per_stay', icon: 'cleaning_services', sortOrder: 1, isActive: true },
    { organizationId: orgId, propertyId, name: 'Plaza de garaje', description: 'Parking cubierto en el propio edificio.', price: '10.00', currency: 'EUR', addonType: 'per_night', icon: 'local_parking', sortOrder: 2, isActive: true },
    { organizationId: orgId, propertyId, name: 'Pack Bienvenida', description: 'Cesta con productos locales, una botella de vino y agua fría a la llegada.', price: '28.00', currency: 'EUR', addonType: 'per_stay', icon: 'card_giftcard', sortOrder: 3, isActive: true },
    { organizationId: orgId, propertyId, name: 'Alquiler de bicicletas', description: 'Bicicleta por persona y día para moverse por la zona.', price: '9.00', currency: 'EUR', addonType: 'per_person', icon: 'pedal_bike', sortOrder: 4, isActive: true },
    { organizationId: orgId, propertyId, name: 'Late check-out (14:00)', description: 'Sal a las 14:00 en vez de a las 11:00. Sujeto a disponibilidad.', price: '30.00', currency: 'EUR', addonType: 'per_stay', icon: 'schedule', sortOrder: 5, isActive: true },
  ]);
  console.log('   ✓ Ajustes + 5 extras');

  // ── 9. Guests ──
  console.log('🧑 Creando huéspedes...');
  const GUEST_COUNT = ARGS.guests;
  const usedEmails = new Set<string>();
  const guestRows: Array<typeof guests.$inferInsert> = [];
  for (let i = 0; i < GUEST_COUNT; i++) {
    const pool = pickWeighted(GUEST_POOL.map((p) => [p, p.weight] as const));
    const firstName = pick(pool.first);
    const lastName = pick(pool.last);
    let email = `${stripAccents(firstName)}.${stripAccents(lastName)}@${pick(pool.domains)}`;
    if (usedEmails.has(email)) email = `${stripAccents(firstName)}.${stripAccents(lastName)}${i}@${pick(pool.domains)}`;
    usedEmails.add(email);

    const isSpanish = pool.nationality === 'ES';
    guestRows.push({
      organizationId: orgId,
      firstName,
      lastName,
      email,
      phone: `${pool.phonePrefix}${randInt(10, 99)} ${randInt(100, 999)} ${randInt(100, 999)}`,
      documentType: isSpanish ? 'national_id' : 'passport',
      documentNumber: isSpanish
        ? `${randInt(10_000_000, 99_999_999)}${'TRWAGMYFPDXBNJZSQVHLCKE'[randInt(0, 22)]}`
        : `${pool.nationality}${randInt(100_000_000, 999_999_999)}`,
      nationality: pool.nationality,
      dateOfBirth: `${randInt(1955, 2004)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
      vipStatus: pickWeighted([['none', 82], ['silver', 11], ['gold', 5], ['platinum', 2]] as const),
      notes: DEMO_TAG,
    });
  }
  const insertedGuests = await db.insert(guests).values(guestRows).returning();
  console.log(`   ✓ ${insertedGuests.length} huéspedes`);

  // ── 10. Reservations ──
  // Walk each unit's calendar forward, dropping stays with gaps in between.
  // Per-unit allocation is what guarantees there are no overlapping bookings.
  console.log('📋 Generando reservas...');

  const SOURCES = [
    ['booking_com', 34],
    ['direct', 22],
    ['airbnb', 16],
    ['website', 12],
    ['expedia', 8],
    ['phone', 5],
    ['walkin', 3],
  ] as const;

  const SPECIAL_REQUESTS = [
    'Llegamos sobre las 22:00, ¿podéis dejar las llaves en recepción?',
    'Si es posible, planta alta y con vistas al mar.',
    'Viajamos con un bebé, necesitaríamos cuna.',
    'Preferimos apartamento tranquilo, lejos del ascensor.',
    'Celebramos nuestro aniversario, cualquier detalle es bienvenido.',
    'Necesitamos plaza de garaje para un coche grande (SUV).',
    'Late check-out si hay disponibilidad, el vuelo sale por la tarde.',
    null,
    null,
    null,
  ] as const;

  type PlannedRes = {
    unitId: string | null;
    roomTypeKey: RoomTypeKey;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    status: string;
    source: string;
    planCode: 'STD' | 'NR' | 'LARGA';
    guestIndex: number;
    adults: number;
    children: number;
    nightlyAmounts: number[];
    totalAmount: number;
  };

  const planned: PlannedRes[] = [];

  const stayLengthFor = (dateStr: string): number => {
    const season = seasonFor(dateStr);
    if (season === 'alta') return pickWeighted([[7, 40], [5, 15], [10, 15], [14, 15], [4, 10], [3, 5]] as const);
    if (season === 'navidad') return pickWeighted([[4, 35], [7, 30], [3, 20], [5, 15]] as const);
    if (season === 'media') return pickWeighted([[4, 30], [3, 25], [7, 20], [5, 15], [2, 10]] as const);
    return pickWeighted([[3, 30], [2, 30], [4, 20], [7, 15], [14, 5]] as const);
  };

  for (const unit of insertedUnits) {
    if (unit.id === maintenanceUnit.id) continue; // out of service
    const rtKey = ROOM_TYPE_DEFS.find((d) => roomTypeIdByKey.get(d.key) === unit.roomTypeId)!.key;
    const def = defByKey.get(rtKey)!;

    let cursor = -DAYS_PAST;
    // Random head start so not every apartment starts a stay on the same day.
    cursor += randInt(0, 4);

    while (cursor < DAYS_FUTURE) {
      const checkInStr = dayOffset(base, cursor);
      let nights = stayLengthFor(checkInStr);
      if (cursor + nights > DAYS_FUTURE) nights = DAYS_FUTURE - cursor;
      if (nights < 1) break;

      const checkOutStr = dayOffset(base, cursor + nights);
      const planCode: 'STD' | 'NR' | 'LARGA' =
        nights >= 7 ? pickWeighted([['LARGA', 55], ['STD', 30], ['NR', 15]] as const)
                    : pickWeighted([['STD', 45], ['NR', 55]] as const);
      const planFactor = RATE_PLAN_DEFS.find((p) => p.code === planCode)!.factor;

      const nightlyAmounts: number[] = [];
      for (let n = 0; n < nights; n++) {
        const nightDate = dayOffset(base, cursor + n);
        nightlyAmounts.push(Math.round(nightlyPrice(def.basePrice, nightDate) * planFactor * 100) / 100);
      }
      const totalAmount = Math.round(nightlyAmounts.reduce((a, b) => a + b, 0) * 100) / 100;

      // Status is derived from where the stay sits relative to today.
      let status: string;
      if (cursor + nights <= 0) status = 'checked_out';
      else if (cursor <= 0) status = 'checked_in';
      else status = 'confirmed';
      // A handful of past bookings never showed up.
      if (status === 'checked_out' && rnd() < 0.04) status = 'no_show';

      const maxOcc = def.maxOccupancy;
      const adults = randInt(Math.min(2, maxOcc), Math.max(2, Math.min(maxOcc, def.baseOccupancy + 1)));
      const children = maxOcc - adults >= 2 && rnd() < 0.35 ? randInt(1, Math.min(2, maxOcc - adults)) : 0;

      planned.push({
        unitId: unit.id,
        roomTypeKey: rtKey,
        roomTypeId: unit.roomTypeId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        nights,
        status,
        source: pickWeighted(SOURCES),
        planCode,
        guestIndex: randInt(0, insertedGuests.length - 1),
        adults,
        children,
        nightlyAmounts,
        totalAmount,
      });

      // Gap until the next stay — tuned to land near TARGET_OCCUPANCY.
      const avgGap = Math.max(1, Math.round((nights * (1 - TARGET_OCCUPANCY)) / TARGET_OCCUPANCY));
      cursor += nights + randInt(0, avgGap * 2);
    }
  }

  // Nudge a handful of stays so the dashboard always has a lively "today":
  // otherwise the arrivals/departures cards can land on a quiet day by chance.
  // Only shrinks or extends stays into gaps, so per-unit non-overlap still holds.
  const TODAY_TARGET = 6;
  const plannedByUnit = new Map<string, PlannedRes[]>();
  for (const p of planned) {
    if (!p.unitId) continue;
    const list = plannedByUnit.get(p.unitId) ?? [];
    list.push(p);
    plannedByUnit.set(p.unitId, list);
  }

  const repriceStay = (p: PlannedRes): void => {
    const def = defByKey.get(p.roomTypeKey)!;
    const factor = RATE_PLAN_DEFS.find((rp) => rp.code === p.planCode)!.factor;
    const start = new Date(`${p.checkIn}T00:00:00Z`);
    p.nights = daysBetween(p.checkIn, p.checkOut);
    p.nightlyAmounts = Array.from({ length: p.nights }, (_, n) =>
      Math.round(nightlyPrice(def.basePrice, dayOffset(start, n)) * factor * 100) / 100,
    );
    p.totalAmount = Math.round(p.nightlyAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
  };

  // Departures: pull forward a stay that was ending in the next few days.
  let departuresToday = planned.filter((p) => p.checkOut === today && p.status !== 'confirmed').length;
  for (const [, list] of plannedByUnit) {
    if (departuresToday >= TODAY_TARGET) break;
    const stay = list.find(
      (p) => p.status === 'checked_in' && p.checkIn < today && p.checkOut > today && daysBetween(today, p.checkOut) <= 3,
    );
    if (!stay) continue;
    stay.checkOut = today;
    repriceStay(stay);
    // Mid-morning: some have already settled and left, others are still in the room.
    stay.status = rnd() < 0.5 ? 'checked_out' : 'checked_in';
    departuresToday += 1;
  }

  // Arrivals: pull forward a stay starting in the next few days, if the apartment is free today.
  let arrivalsToday = planned.filter((p) => p.checkIn === today && p.status !== 'cancelled').length;
  for (const [, list] of plannedByUnit) {
    if (arrivalsToday >= TODAY_TARGET) break;
    const idx = list.findIndex(
      (p) => p.status === 'confirmed' && p.checkIn > today && daysBetween(today, p.checkIn) <= 5,
    );
    if (idx === -1) continue;
    const stay = list[idx]!;
    const previous = list[idx - 1];
    if (previous && previous.checkOut > today) continue; // apartment still occupied
    stay.checkIn = today;
    repriceStay(stay);
    // Check-in opens at 16:00, so part of today's arrivals are still pending.
    stay.status = rnd() < 0.55 ? 'checked_in' : 'confirmed';
    arrivalsToday += 1;
  }

  // A few cancellations and some unassigned (not-yet-allocated) future requests.
  const cancelCount = Math.round(planned.length * 0.05);
  const futureIdx = planned.map((p, i) => ({ p, i })).filter(({ p }) => p.status === 'confirmed');
  for (let i = 0; i < cancelCount && i < futureIdx.length; i++) {
    const target = futureIdx[randInt(0, futureIdx.length - 1)]!;
    target.p.status = 'cancelled';
  }

  for (let i = 0; i < 6; i++) {
    const def = pick(ROOM_TYPE_DEFS);
    const startOffset = randInt(10, DAYS_FUTURE - 10);
    const nights = randInt(3, 8);
    const nightlyAmounts = Array.from({ length: nights }, (_, n) =>
      nightlyPrice(def.basePrice, dayOffset(base, startOffset + n)),
    );
    planned.push({
      unitId: null,
      roomTypeKey: def.key,
      roomTypeId: roomTypeIdByKey.get(def.key)!,
      checkIn: dayOffset(base, startOffset),
      checkOut: dayOffset(base, startOffset + nights),
      nights,
      status: 'confirmed',
      source: pickWeighted(SOURCES),
      planCode: 'STD',
      guestIndex: randInt(0, insertedGuests.length - 1),
      adults: def.baseOccupancy,
      children: 0,
      nightlyAmounts,
      totalAmount: Math.round(nightlyAmounts.reduce((a, b) => a + b, 0) * 100) / 100,
    });
  }

  planned.sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const yy = String(base.getUTCFullYear()).slice(2);
  const reservationRows: Array<typeof reservations.$inferInsert> = planned.map((p, i) => ({
    organizationId: orgId,
    propertyId,
    confirmationCode: `${PROPERTY_CODE}-${yy}-${String(i + 1).padStart(5, '0')}`,
    guestId: insertedGuests[p.guestIndex]!.id,
    roomTypeId: p.roomTypeId,
    unitId: p.unitId,
    status: p.status,
    source: p.source,
    checkInDate: p.checkIn,
    checkOutDate: p.checkOut,
    nights: p.nights,
    adults: p.adults,
    children: p.children,
    totalAmount: p.totalAmount.toFixed(2),
    currency: 'EUR',
    specialRequests: pick(SPECIAL_REQUESTS),
    cancelledAt: p.status === 'cancelled' ? addDays(base, -randInt(1, 20)) : null,
    cancellationReason:
      p.status === 'cancelled'
        ? pick(['Cambio de planes del cliente', 'Cancelada por el canal', 'Duplicada', 'Motivos personales'] as const)
        : null,
  }));

  const reservationIdByCode = new Map<string, string>();
  for (let i = 0; i < reservationRows.length; i += 500) {
    const chunk = await db
      .insert(reservations)
      .values(reservationRows.slice(i, i + 500))
      .returning({ id: reservations.id, confirmationCode: reservations.confirmationCode });
    for (const row of chunk) reservationIdByCode.set(row.confirmationCode, row.id);
  }
  console.log(`   ✓ ${reservationIdByCode.size} reservas (${dayOffset(base, -DAYS_PAST)} → ${dayOffset(base, DAYS_FUTURE)})`);

  // ── 11. Folios, charges and payments ──
  console.log('🧾 Creando facturas y cargos...');
  const EXTRAS: ReadonlyArray<{ type: string; description: string; unitPrice: number; taxRate: number }> = [
    { type: 'supplement', description: 'Limpieza final', unitPrice: 45, taxRate: 21 },
    { type: 'supplement', description: 'Plaza de garaje', unitPrice: 10, taxRate: 21 },
    { type: 'supplement', description: 'Pack Bienvenida', unitPrice: 28, taxRate: 21 },
    { type: 'minibar', description: 'Consumo minibar', unitPrice: 14.5, taxRate: 21 },
    { type: 'restaurant', description: 'Desayunos en cafetería', unitPrice: 9.5, taxRate: 10 },
  ];

  const folioRows: Array<typeof folios.$inferInsert> = [];
  const lineItemsByFolioNumber = new Map<string, Array<Omit<typeof folioLineItems.$inferInsert, 'folioId'>>>();
  const paymentsByFolioNumber = new Map<string, { amount: number; method: string; processedAt: Date }>();

  let folioSeq = 0;
  planned.forEach((p, i) => {
    if (p.status === 'cancelled' || p.status === 'no_show') return;
    const reservationId = reservationIdByCode.get(reservationRows[i]!.confirmationCode)!;
    folioSeq += 1;
    const folioNumber = `F-${PROPERTY_CODE}-${yy}-${String(folioSeq).padStart(5, '0')}`;

    const lines: Array<Omit<typeof folioLineItems.$inferInsert, 'folioId'>> = [];
    const roomTypeName = defByKey.get(p.roomTypeKey)!.name;

    p.nightlyAmounts.forEach((amount, n) => {
      lines.push({
        organizationId: orgId,
        type: 'room_charge',
        description: `${roomTypeName} — noche ${n + 1}/${p.nights}`,
        date: dayOffset(new Date(`${p.checkIn}T00:00:00Z`), n),
        quantity: 1,
        unitPrice: amount.toFixed(2),
        amount: amount.toFixed(2),
        taxRate: IVA_ALOJAMIENTO.toFixed(2),
        taxAmount: (Math.round(amount * (IVA_ALOJAMIENTO / 100) * 100) / 100).toFixed(2),
        createdBy,
      });
    });

    // Extras only on stays that have already started.
    if (p.status !== 'confirmed') {
      const extrasCount = pickWeighted([[0, 35], [1, 35], [2, 20], [3, 10]] as const);
      for (let e = 0; e < extrasCount; e++) {
        const extra = pick(EXTRAS);
        const quantity = extra.type === 'supplement' && extra.description === 'Plaza de garaje' ? p.nights : randInt(1, 3);
        const amount = Math.round(extra.unitPrice * quantity * 100) / 100;
        lines.push({
          organizationId: orgId,
          type: extra.type,
          description: extra.description,
          date: dayOffset(new Date(`${p.checkIn}T00:00:00Z`), randInt(0, Math.max(0, p.nights - 1))),
          quantity,
          unitPrice: extra.unitPrice.toFixed(2),
          amount: amount.toFixed(2),
          taxRate: extra.taxRate.toFixed(2),
          taxAmount: (Math.round(amount * (extra.taxRate / 100) * 100) / 100).toFixed(2),
          createdBy,
        });
      }
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;
    const taxTotal = Math.round(lines.reduce((s, l) => s + Number(l.taxAmount ?? 0), 0) * 100) / 100;
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    // Non-refundable stays are prepaid; checked-out stays are settled on departure.
    let paidAmount = 0;
    let status: string = 'open';
    let closedAt: Date | null = null;
    if (p.status === 'checked_out') {
      paidAmount = total;
      status = 'closed';
      closedAt = new Date(`${p.checkOut}T09:30:00Z`);
      paymentsByFolioNumber.set(folioNumber, {
        amount: total,
        method: pickWeighted([['credit_card', 55], ['cash', 20], ['bank_transfer', 15], ['online', 10]] as const),
        processedAt: closedAt,
      });
    } else if (p.planCode === 'NR') {
      paidAmount = Math.round(Number(p.totalAmount) * 1.1 * 100) / 100;
      if (paidAmount > total) paidAmount = total;
      paymentsByFolioNumber.set(folioNumber, {
        amount: paidAmount,
        method: 'online',
        processedAt: addDays(new Date(`${p.checkIn}T10:00:00Z`), -randInt(5, 40)),
      });
    } else if (p.status === 'checked_in' && rnd() < 0.4) {
      paidAmount = Math.round(total * 0.3 * 100) / 100;
      paymentsByFolioNumber.set(folioNumber, {
        amount: paidAmount,
        method: 'credit_card',
        processedAt: new Date(`${p.checkIn}T17:00:00Z`),
      });
    }

    folioRows.push({
      organizationId: orgId,
      reservationId,
      guestId: insertedGuests[p.guestIndex]!.id,
      folioNumber,
      status,
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balance: (Math.round((total - paidAmount) * 100) / 100).toFixed(2),
      currency: 'EUR',
      closedAt,
    });
    lineItemsByFolioNumber.set(folioNumber, lines);
  });

  const insertedFolios: Array<{ id: string; folioNumber: string }> = [];
  for (let i = 0; i < folioRows.length; i += 300) {
    const chunk = await db
      .insert(folios)
      .values(folioRows.slice(i, i + 300))
      .returning({ id: folios.id, folioNumber: folios.folioNumber });
    insertedFolios.push(...chunk);
  }
  console.log(`   ✓ ${insertedFolios.length} facturas`);

  const allLineItems: Array<typeof folioLineItems.$inferInsert> = [];
  const allPayments: Array<typeof payments.$inferInsert> = [];
  for (const folio of insertedFolios) {
    for (const line of lineItemsByFolioNumber.get(folio.folioNumber) ?? []) {
      allLineItems.push({ ...line, folioId: folio.id });
    }
    const pay = paymentsByFolioNumber.get(folio.folioNumber);
    if (pay && pay.amount > 0) {
      allPayments.push({
        organizationId: orgId,
        folioId: folio.id,
        method: pay.method,
        amount: pay.amount.toFixed(2),
        reference: `${folio.folioNumber}-P1`,
        processedAt: pay.processedAt,
        processedBy: createdBy,
      });
    }
  }
  await insertChunked('líneas de cargo', allLineItems, (chunk) => db.insert(folioLineItems).values(chunk));
  await insertChunked('pagos', allPayments, (chunk) => db.insert(payments).values(chunk));

  // ── 12. Guest stay history ──
  console.log('📈 Actualizando histórico de huéspedes...');
  const statsByGuest = new Map<string, { stays: number; revenue: number }>();
  planned.forEach((p) => {
    if (p.status !== 'checked_out') return;
    const guestId = insertedGuests[p.guestIndex]!.id;
    const current = statsByGuest.get(guestId) ?? { stays: 0, revenue: 0 };
    current.stays += 1;
    current.revenue += p.totalAmount;
    statsByGuest.set(guestId, current);
  });
  for (const [guestId, stats] of statsByGuest) {
    await db
      .update(guests)
      .set({ totalStays: stats.stays, totalRevenue: (Math.round(stats.revenue * 100) / 100).toFixed(2) })
      .where(and(eq(guests.id, guestId), eq(guests.organizationId, orgId)));
  }
  console.log(`   ✓ ${statsByGuest.size} huéspedes con histórico`);

  // ── 13. Housekeeping — today's board ──
  console.log('🧹 Creando tareas de limpieza para hoy...');
  const hkRows: Array<typeof housekeepingTasks.$inferInsert> = [];
  const dirtyUnits: string[] = [];
  const inspectedUnits: string[] = [];

  planned.forEach((p) => {
    if (!p.unitId) return;
    if (p.checkOut === today && (p.status === 'checked_in' || p.status === 'checked_out')) {
      // Departure today → checkout clean.
      const done = rnd() < 0.45;
      hkRows.push({
        organizationId: orgId,
        propertyId,
        unitId: p.unitId,
        type: 'checkout_clean',
        status: done ? 'completed' : rnd() < 0.4 ? 'in_progress' : 'pending',
        priority: 'high',
        scheduledDate: today,
        startedAt: done ? new Date(`${today}T09:15:00Z`) : null,
        completedAt: done ? new Date(`${today}T10:40:00Z`) : null,
        notes: 'Salida de hoy — limpieza completa y reposición de amenities.',
      });
      if (done) inspectedUnits.push(p.unitId);
      else dirtyUnits.push(p.unitId);
    } else if (p.status === 'checked_in' && p.checkIn < today && p.checkOut > today) {
      // In-house → stay-over clean every third day of the stay.
      const nightsSoFar = daysBetween(p.checkIn, today);
      if (nightsSoFar % 3 === 0) {
        hkRows.push({
          organizationId: orgId,
          propertyId,
          unitId: p.unitId,
          type: 'stay_over',
          status: rnd() < 0.5 ? 'completed' : 'pending',
          priority: 'normal',
          scheduledDate: today,
          notes: `Cliente alojado hasta el ${p.checkOut}.`,
        });
      }
    }
  });

  hkRows.push({
    organizationId: orgId,
    propertyId,
    unitId: maintenanceUnit.id,
    type: 'deep_clean',
    status: 'pending',
    priority: 'low',
    scheduledDate: dayOffset(base, 5),
    notes: 'Limpieza a fondo tras la reparación de fontanería.',
  });

  if (hkRows.length) await db.insert(housekeepingTasks).values(hkRows);
  console.log(`   ✓ ${hkRows.length} tareas`);

  // ── 14. Unit housekeeping status snapshot ──
  const occupiedUnits = planned
    .filter((p) => p.unitId && p.status === 'checked_in' && p.checkIn <= today && p.checkOut > today)
    .map((p) => p.unitId!);
  if (occupiedUnits.length) {
    await db.update(units).set({ housekeepingStatus: 'dirty' }).where(inArray(units.id, occupiedUnits));
  }
  if (dirtyUnits.length) {
    await db.update(units).set({ housekeepingStatus: 'dirty' }).where(inArray(units.id, dirtyUnits));
  }
  if (inspectedUnits.length) {
    await db.update(units).set({ housekeepingStatus: 'inspected' }).where(inArray(units.id, inspectedUnits));
  }

  // ── Summary ──
  const byStatus = planned.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const soldNights = planned
    .filter((p) => p.unitId && p.status !== 'cancelled' && p.status !== 'no_show')
    .reduce((s, p) => s + p.nights, 0);
  const availableNights = (insertedUnits.length - 1) * (DAYS_PAST + DAYS_FUTURE);

  console.log('');
  console.log('============================================');
  console.log('🎉 Datos de demo creados');
  console.log('============================================');
  console.log(`  Organización:   ${org.name} (${org.slug})`);
  console.log(`  Propiedad:      ${property!.name} [${PROPERTY_CODE}]`);
  const unitsByType = ROOM_TYPE_DEFS.map((def) => {
    const n = insertedUnits.filter((u) => u.roomTypeId === roomTypeIdByKey.get(def.key)).length;
    return `${n} × ${def.name}`;
  }).join(' · ');
  console.log(`  Unidades:       ${insertedUnits.length} ${UNIT_NOUN} (1 en mantenimiento)`);
  console.log(`                    ${unitsByType}`);
  console.log(`  Tarifas:        ${rateRows.length} filas · ${insertedRatePlans.length} planes · ${RATES_PAST + RATES_FUTURE + 1} días`);
  console.log(`  Huéspedes:      ${insertedGuests.length}`);
  console.log(`  Reservas:       ${planned.length}`);
  for (const [status, n] of Object.entries(byStatus).sort()) {
    console.log(`                    · ${status}: ${n}`);
  }
  console.log(`  Ocupación:      ~${Math.round((soldNights / availableNights) * 100)}% del periodo`);
  console.log(`  Facturas:       ${insertedFolios.length} (${allLineItems.length} cargos, ${allPayments.length} pagos)`);
  console.log(`  Limpieza:       ${hkRows.length} tareas para hoy`);
  console.log('');
  console.log('  Vuelve a ejecutarlo cuando quieras: borra solo estos datos y los regenera con fechas actualizadas.');
  console.log('');
}

run()
  .then(async () => {
    await client.end();
  })
  .catch(async (error) => {
    console.error('❌ Falló la carga de datos:', error);
    await client.end();
    process.exit(1);
  });
