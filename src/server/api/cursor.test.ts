import { describe, it, expect } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';

const ID = '3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8';

describe('cursor', () => {
  it('round-trips a cursor', () => {
    const updatedAt = '2026-08-27T10:15:30.123456Z';
    const decoded = decodeCursor(encodeCursor({ updatedAt, id: ID }));

    expect(decoded?.updatedAt).toBe(updatedAt);
    expect(decoded?.id).toBe(ID);
  });

  it('preserves microsecond precision', () => {
    // A Date-based cursor would round this down to .674 and the next page
    // would re-serve rows the client already read.
    const updatedAt = '2026-05-18T15:51:34.674591Z';
    expect(decodeCursor(encodeCursor({ updatedAt, id: ID }))?.updatedAt).toBe(
      updatedAt,
    );
  });

  it('is opaque — the encoded form is not the raw values', () => {
    const encoded = encodeCursor({ updatedAt: '2026-05-18T15:51:34.674591Z', id: ID });
    expect(encoded).not.toContain(ID);
    expect(encoded).not.toContain('|');
  });

  it('rejects anything it did not produce', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('no-separator').toString('base64url'))).toBeNull();
    expect(
      decodeCursor(Buffer.from('2026-08-27T10:00:00Z|not-a-uuid').toString('base64url')),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from(`not-a-date|${ID}`).toString('base64url')),
    ).toBeNull();
    // Local time without a zone is ambiguous — reject rather than guess.
    expect(
      decodeCursor(Buffer.from(`2026-08-27T10:00:00|${ID}`).toString('base64url')),
    ).toBeNull();
  });
});
