import { describe, it, expect } from 'vitest';
import { isIpAllowed, isValidIpOrCidr, normalizeIp } from './ip';

describe('normalizeIp', () => {
  it('strips IPv4-mapped IPv6 prefix', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });
  it('strips IPv6 zone id and brackets', () => {
    expect(normalizeIp('[fe80::1%eth0]')).toBe('fe80::1');
  });
});

describe('isIpAllowed — IPv4 exact', () => {
  it('matches an exact IPv4', () => {
    expect(isIpAllowed('203.0.113.10', ['203.0.113.10'])).toBe(true);
  });
  it('rejects a different IPv4', () => {
    expect(isIpAllowed('203.0.113.11', ['203.0.113.10'])).toBe(false);
  });
  it('matches IPv4 reported as IPv4-mapped IPv6', () => {
    expect(isIpAllowed('::ffff:203.0.113.10', ['203.0.113.10'])).toBe(true);
  });
});

describe('isIpAllowed — IPv4 CIDR', () => {
  it('matches inside a /24', () => {
    expect(isIpAllowed('203.0.113.55', ['203.0.113.0/24'])).toBe(true);
  });
  it('rejects outside a /24', () => {
    expect(isIpAllowed('203.0.114.1', ['203.0.113.0/24'])).toBe(false);
  });
  it('matches the whole space with /0', () => {
    expect(isIpAllowed('8.8.8.8', ['0.0.0.0/0'])).toBe(true);
  });
  it('matches a single host /32', () => {
    expect(isIpAllowed('203.0.113.10', ['203.0.113.10/32'])).toBe(true);
    expect(isIpAllowed('203.0.113.11', ['203.0.113.10/32'])).toBe(false);
  });
});

describe('isIpAllowed — IPv6', () => {
  it('matches an exact IPv6 regardless of compression', () => {
    expect(isIpAllowed('2001:db8::1', ['2001:0db8:0000:0000:0000:0000:0000:0001'])).toBe(true);
  });
  it('matches inside an IPv6 CIDR', () => {
    expect(isIpAllowed('2001:db8:abcd:0012::1', ['2001:db8:abcd:0012::/64'])).toBe(true);
    expect(isIpAllowed('2001:db8:abcd:0013::1', ['2001:db8:abcd:0012::/64'])).toBe(false);
  });
});

describe('isIpAllowed — edge cases', () => {
  it('returns false for a null/empty client IP', () => {
    expect(isIpAllowed(null, ['203.0.113.0/24'])).toBe(false);
    expect(isIpAllowed('', ['203.0.113.0/24'])).toBe(false);
  });
  it('returns false against an empty allowlist', () => {
    expect(isIpAllowed('203.0.113.10', [])).toBe(false);
  });
});

describe('isValidIpOrCidr', () => {
  it('accepts valid IPv4, IPv6 and CIDR', () => {
    expect(isValidIpOrCidr('203.0.113.10')).toBe(true);
    expect(isValidIpOrCidr('203.0.113.0/24')).toBe(true);
    expect(isValidIpOrCidr('2001:db8::1')).toBe(true);
    expect(isValidIpOrCidr('2001:db8::/32')).toBe(true);
  });
  it('rejects malformed values and out-of-range prefixes', () => {
    expect(isValidIpOrCidr('999.0.0.1')).toBe(false);
    expect(isValidIpOrCidr('203.0.113.0/33')).toBe(false);
    expect(isValidIpOrCidr('not-an-ip')).toBe(false);
    expect(isValidIpOrCidr('')).toBe(false);
  });
});
