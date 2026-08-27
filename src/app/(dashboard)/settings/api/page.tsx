import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { apiKeyRepo, apiRequestLogRepo } from '@/server/repositories/api-key.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { ApiKeysClient } from '@/components/settings/api-keys-client';

const USAGE_WINDOW_HOURS = 24;

export default async function ApiSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  const [keys, properties, usage, recentLogs] = await Promise.all([
    apiKeyRepo.findAll(orgId),
    propertyRepo.findAll(orgId),
    apiKeyRepo.usageWithinHours(orgId, USAGE_WINDOW_HOURS),
    apiRequestLogRepo.findRecent(orgId, 25),
  ]);

  const usageByKey = new Map(usage.map((row) => [row.apiKeyId, row]));
  const keyNames = new Map(keys.map((key) => [key.id, key.name]));

  const canManage = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <ApiKeysClient
      canManage={canManage}
      usageWindowHours={USAGE_WINDOW_HOURS}
      apiKeys={keys.map((key) => {
        const stats = usageByKey.get(key.id);
        return {
          id: key.id,
          name: key.name,
          propertyId: key.propertyId,
          keyPrefix: key.keyPrefix,
          scopes: key.scopes,
          rateLimitPerMinute: key.rateLimitPerMinute,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          revokedAt: key.revokedAt?.toISOString() ?? null,
          isExpired: key.isExpired,
          createdAt: key.createdAt.toISOString(),
          requests: stats?.requests ?? 0,
          errors: stats?.errors ?? 0,
        };
      })}
      properties={properties.map((property) => ({
        id: property.id,
        name: property.name,
        code: property.code,
      }))}
      recentLogs={recentLogs.map((log) => ({
        id: log.id,
        keyName: log.apiKeyId ? (keyNames.get(log.apiKeyId) ?? null) : null,
        method: log.method,
        path: log.path,
        status: log.status,
        errorCode: log.errorCode,
        durationMs: log.durationMs,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  );
}
