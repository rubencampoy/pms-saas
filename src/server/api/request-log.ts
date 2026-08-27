import { db } from '@/server/db';
import { apiRequestLogs } from '@/server/db/schema';

/**
 * Record one `/api/v1` request.
 *
 * Fire-and-forget: never awaited on the response path, and a failure here is
 * swallowed. Observability must not be able to break the thing it observes.
 *
 * Only the path is stored, never the query string — `/reservations/lookup`
 * carries a guest's surname in one, and that does not belong in a log table.
 */
export function logApiRequest(entry: {
  organizationId: string;
  apiKeyId: string | null;
  method: string;
  path: string;
  status: number;
  errorCode?: string | null;
  durationMs: number;
}): void {
  void db
    .insert(apiRequestLogs)
    .values({
      organizationId: entry.organizationId,
      apiKeyId: entry.apiKeyId,
      method: entry.method,
      path: entry.path.slice(0, 255),
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      durationMs: entry.durationMs,
    })
    .catch((error: unknown) => {
      console.error('[API v1] Failed to write request log:', error);
    });
}

/**
 * Read the `error.code` out of a response we are about to return, so the log
 * records *why* a request failed and not just its status.
 *
 * Clones the response: reading a body consumes it, and the original still has
 * to reach the client.
 */
export async function readErrorCode(response: Response): Promise<string | null> {
  if (response.status < 400) return null;
  try {
    const body: unknown = await response.clone().json();
    const error = (body as { error?: { code?: unknown } }).error;
    return typeof error?.code === 'string' ? error.code : null;
  } catch {
    return null;
  }
}
