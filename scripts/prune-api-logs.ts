/**
 * Delete `/api/v1` request logs older than a retention window.
 *
 * `api_request_logs` grows with every API call and nothing prunes it on the
 * request path, so this is meant to run on a schedule (cron / Vercel cron).
 *
 *   npx tsx scripts/prune-api-logs.ts              # keep 30 days
 *   npx tsx scripts/prune-api-logs.ts --days=90
 *   npx tsx scripts/prune-api-logs.ts --days=30 --dry-run
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const DEFAULT_RETENTION_DAYS = 30;

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match?.split('=').slice(1).join('=');
}

async function run() {
  const daysArg = arg('days');
  const days = daysArg ? Number(daysArg) : DEFAULT_RETENTION_DAYS;
  const dryRun = process.argv.includes('--dry-run');

  if (!Number.isInteger(days) || days < 1) {
    console.error(`Invalid --days value: ${daysArg}`);
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL || '', { max: 1 });

  try {
    const [counts] = await client`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (
          WHERE created_at < now() - make_interval(days => ${days})
        )::int AS stale
      FROM api_request_logs
    `;

    console.log(`Retention   : ${days} days`);
    console.log(`Total rows  : ${counts?.total ?? 0}`);
    console.log(`Older rows  : ${counts?.stale ?? 0}`);

    if (dryRun) {
      console.log('Dry run — nothing deleted.');
      return;
    }

    const deleted = await client`
      DELETE FROM api_request_logs
      WHERE created_at < now() - make_interval(days => ${days})
      RETURNING id
    `;

    console.log(`Deleted     : ${deleted.length}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
