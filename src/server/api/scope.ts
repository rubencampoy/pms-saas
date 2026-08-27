import type { ApiContext } from './with-api-key';

/**
 * Resolve which property a request may read.
 *
 * A key restricted to one property can never widen its own scope: asking for a
 * different `propertyId` is rejected rather than silently ignored, so an
 * integration notices its mistake instead of quietly getting the wrong data.
 * An unrestricted key may narrow itself to any property in its organization.
 *
 * Returns `undefined` when no restriction applies — meaning "all properties in
 * this organization".
 */
export function resolvePropertyScope(
  context: ApiContext,
  requested?: string,
): { propertyId: string | undefined } | { conflict: true } {
  if (context.propertyId && requested && requested !== context.propertyId) {
    return { conflict: true };
  }
  return { propertyId: context.propertyId ?? requested };
}

/**
 * Whether a row belonging to `propertyId` is visible to this key.
 *
 * Used after fetching a single resource by id: the organization filter already
 * ran in the repository, this adds the per-property narrowing.
 */
export function isPropertyVisible(
  context: ApiContext,
  propertyId: string,
): boolean {
  return !context.propertyId || context.propertyId === propertyId;
}
