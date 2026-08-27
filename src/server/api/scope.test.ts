import { describe, it, expect } from 'vitest';
import { isPropertyVisible, resolvePropertyScope } from './scope';
import { ApiScope } from '@/lib/constants/api';
import type { ApiContext } from './with-api-key';

const HGU = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';

const context = (propertyId: string | null): ApiContext => ({
  apiKeyId: '11111111-1111-1111-1111-111111111111',
  organizationId: '00000000-0000-0000-0000-000000000000',
  propertyId,
  scopes: [ApiScope.RESERVATIONS_READ],
});

describe('resolvePropertyScope', () => {
  it('lets an unrestricted key read every property', () => {
    expect(resolvePropertyScope(context(null))).toEqual({ propertyId: undefined });
  });

  it('lets an unrestricted key narrow itself', () => {
    expect(resolvePropertyScope(context(null), HGU)).toEqual({ propertyId: HGU });
  });

  it('pins a restricted key to its own property when none is requested', () => {
    expect(resolvePropertyScope(context(HGU))).toEqual({ propertyId: HGU });
  });

  it('rejects rather than ignores a mismatched request', () => {
    // Silently returning HGU data for a request that asked for OTHER would
    // hide the integration's bug behind plausible-looking results.
    expect(resolvePropertyScope(context(HGU), OTHER)).toEqual({ conflict: true });
  });

  it('accepts a request that matches the restriction', () => {
    expect(resolvePropertyScope(context(HGU), HGU)).toEqual({ propertyId: HGU });
  });
});

describe('isPropertyVisible', () => {
  it('shows everything to an unrestricted key', () => {
    expect(isPropertyVisible(context(null), OTHER)).toBe(true);
  });

  it('shows only its own property to a restricted key', () => {
    expect(isPropertyVisible(context(HGU), HGU)).toBe(true);
    expect(isPropertyVisible(context(HGU), OTHER)).toBe(false);
  });
});
