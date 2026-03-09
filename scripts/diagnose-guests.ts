import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL || '', { max: 1 });
const db = drizzle(client);

async function run() {
  // Total guests
  const guestCount = await db.execute(sql`SELECT count(*) as count FROM guests`);
  console.log('Total guests:', guestCount[0].count);

  // Total reservations
  const resCount = await db.execute(sql`SELECT count(*) as count FROM reservations`);
  console.log('Total reservations:', resCount[0].count);

  // Reservations where guest_id doesn't match any guest
  const orphans = await db.execute(sql`
    SELECT r.id, r.confirmation_code, r.guest_id, g.id as found_guest
    FROM reservations r
    LEFT JOIN guests g ON g.id = r.guest_id
    WHERE g.id IS NULL
    LIMIT 10
  `);
  console.log('\nOrphan reservations (no matching guest):', orphans.length);
  if (orphans.length > 0) console.log(JSON.stringify(orphans, null, 2));

  // Reservations where guest exists but name is empty
  const emptyNames = await db.execute(sql`
    SELECT r.confirmation_code, g.first_name, g.last_name, g.email
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE g.first_name = '' OR g.last_name = '' OR g.first_name IS NULL
    LIMIT 10
  `);
  console.log('\nReservations with empty guest names:', emptyNames.length);
  if (emptyNames.length > 0) console.log(JSON.stringify(emptyNames, null, 2));

  // Sample of reservations with their guests
  const sample = await db.execute(sql`
    SELECT r.confirmation_code, r.guest_id, g.first_name, g.last_name
    FROM reservations r
    LEFT JOIN guests g ON g.id = r.guest_id
    LIMIT 15
  `);
  console.log('\nSample reservations with guest data:');
  console.log(JSON.stringify(sample, null, 2));

  // Check guests org_id matches
  const wrongOrg = await db.execute(sql`
    SELECT r.confirmation_code, r.organization_id as res_org, g.organization_id as guest_org
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    WHERE r.organization_id != g.organization_id
    LIMIT 5
  `);
  console.log('\nGuests with wrong org:', wrongOrg.length);

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
