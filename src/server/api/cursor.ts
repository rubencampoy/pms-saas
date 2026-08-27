/**
 * Opaque cursors for `/api/v1` list endpoints.
 *
 * List endpoints walk `(updated_at, id)` ascending so that a client can resume
 * exactly where it stopped and, combined with `updatedSince`, poll for only
 * what changed. `id` is the tie-breaker: several rows can share a timestamp.
 *
 * The timestamp is carried as **text with microsecond precision**, not as a
 * `Date`. Postgres stores `timestamptz` to the microsecond while a JS `Date`
 * only holds milliseconds, so a Date-based cursor rounds *down* and the next
 * page re-serves rows the client already has. Keeping the raw value as text
 * makes the comparison exact.
 */

const MICROSECOND_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListCursor {
  /** Microsecond-precision UTC timestamp, e.g. `2026-05-18T15:51:34.674591Z`. */
  updatedAt: string;
  id: string;
}

export function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(`${cursor.updatedAt}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

/** Returns null for anything that is not a cursor we produced. */
export function decodeCursor(raw: string): ListCursor | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const separator = decoded.indexOf('|');
  if (separator === -1) return null;

  const updatedAt = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);

  if (!MICROSECOND_ISO.test(updatedAt) || !UUID.test(id)) return null;

  return { updatedAt, id };
}
