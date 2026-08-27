import { describe, it, expect } from 'vitest';
import {
  apiKeyHashEquals,
  extractBearerToken,
  generateApiKey,
  hashApiKey,
} from './api-key';
import { API_KEY_PREFIX } from '@/lib/constants/api';

describe('generateApiKey', () => {
  it('issues a prefixed key whose stored prefix is a head of the secret', () => {
    const { key, keyPrefix, keyHash } = generateApiKey();

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.startsWith(keyPrefix)).toBe(true);
    expect(keyPrefix.length).toBeLessThan(key.length);
    expect(keyHash).toBe(hashApiKey(key));
  });

  it('never stores the secret itself', () => {
    const { key, keyPrefix, keyHash } = generateApiKey();

    expect(keyHash).not.toContain(key);
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    // The displayed prefix must not be enough to reconstruct the key.
    expect(key.slice(keyPrefix.length).length).toBeGreaterThan(30);
  });

  it('does not repeat itself', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey().key));
    expect(keys.size).toBe(100);
  });
});

describe('apiKeyHashEquals', () => {
  it('matches a digest against itself', () => {
    const { keyHash } = generateApiKey();
    expect(apiKeyHashEquals(keyHash, keyHash)).toBe(true);
  });

  it('rejects a different digest', () => {
    expect(
      apiKeyHashEquals(generateApiKey().keyHash, generateApiKey().keyHash),
    ).toBe(false);
  });

  it('rejects empty and malformed input rather than treating it as a match', () => {
    expect(apiKeyHashEquals('', '')).toBe(false);
    expect(apiKeyHashEquals('abcd', '')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('reads a well-formed bearer header, case-insensitively', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
    expect(extractBearerToken('  Bearer   abc123  ')).toBe('abc123');
  });

  it('returns null for anything else', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('abc123')).toBeNull();
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });
});
