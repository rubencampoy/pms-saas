/**
 * Issue an API key for the public integration API (`/api/v1`).
 *
 * The secret is printed exactly once — it is never recoverable afterwards.
 *
 *   npx tsx scripts/issue-api-key.ts --org=hotel-guardamar --name="Guest app"
 *   npx tsx scripts/issue-api-key.ts --org=hotel-guardamar --name="Guest app" \
 *     --property=HGU --scopes=reservations:read,guests:read --expires=2027-01-01
 *
 * Defaults to every read scope and no expiry.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';
import { generateApiKey } from '../src/lib/utils/api-key';
import { API_SCOPES, ApiScope } from '../src/lib/constants/api';

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match?.split('=').slice(1).join('=');
}

async function run() {
  const orgSlug = arg('org');
  const name = arg('name');
  const propertyCode = arg('property');
  const scopesArg = arg('scopes');
  const expiresArg = arg('expires');

  if (!orgSlug || !name) {
    console.error('Usage: --org=<slug> --name=<label> [--property=<code>] [--scopes=a,b] [--expires=YYYY-MM-DD]');
    process.exit(1);
  }

  const scopes = scopesArg
    ? scopesArg.split(',').map((s) => s.trim() as ApiScope)
    : [...API_SCOPES];

  const unknown = scopes.filter((s) => !API_SCOPES.includes(s));
  if (unknown.length > 0) {
    console.error(`Unknown scope(s): ${unknown.join(', ')}`);
    console.error(`Valid scopes: ${API_SCOPES.join(', ')}`);
    process.exit(1);
  }

  let expiresAt: Date | null = null;
  if (expiresArg) {
    expiresAt = new Date(expiresArg);
    if (Number.isNaN(expiresAt.getTime())) {
      console.error(`Invalid --expires date: ${expiresArg}`);
      process.exit(1);
    }
  }

  const client = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const organization = await db.query.organizations.findFirst({
      where: eq(schema.organizations.slug, orgSlug),
      columns: { id: true, name: true },
    });
    if (!organization) {
      console.error(`Organization '${orgSlug}' not found`);
      process.exit(1);
    }

    let propertyId: string | null = null;
    if (propertyCode) {
      const property = await db.query.properties.findFirst({
        where: and(
          eq(schema.properties.organizationId, organization.id),
          eq(schema.properties.code, propertyCode),
        ),
        columns: { id: true, name: true },
      });
      if (!property) {
        console.error(`Property '${propertyCode}' not found in ${orgSlug}`);
        process.exit(1);
      }
      propertyId = property.id;
    }

    const { key, keyPrefix, keyHash } = generateApiKey();

    await db.insert(schema.apiKeys).values({
      organizationId: organization.id,
      propertyId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt,
    });

    console.log('');
    console.log(`  Organization : ${organization.name} (${orgSlug})`);
    console.log(`  Property     : ${propertyCode ?? 'all properties'}`);
    console.log(`  Scopes       : ${scopes.join(', ')}`);
    console.log(`  Expires      : ${expiresAt ? expiresAt.toISOString() : 'never'}`);
    console.log('');
    console.log('  API key (shown once, store it now):');
    console.log('');
    console.log(`    ${key}`);
    console.log('');
    console.log('  Test it with:');
    console.log('');
    console.log(`    curl -H "Authorization: Bearer ${key}" http://localhost:3000/api/v1/reservations`);
    console.log('');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
