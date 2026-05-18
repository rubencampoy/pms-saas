import { createHash, randomBytes } from 'crypto';
import { cookies, headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { userTrustedDevices } from '@/server/db/schema';

export const TRUSTED_COOKIE_NAME = 'htos-td';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Build a short device label from the User-Agent header.
 * Examples: "Chrome on Windows", "Safari on iOS", "Unknown device".
 */
export async function buildDeviceLabel(): Promise<string> {
  const ua = (await headers()).get('user-agent') ?? '';
  if (!ua) return 'Unknown device';

  const parsed = UAParser(ua);
  const browser = parsed.browser.name ?? 'Browser';
  const os = parsed.os.name ?? 'Unknown OS';
  return `${browser} on ${os}`.slice(0, 255);
}

/** Best-effort client IP from common proxy headers. */
async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 45);
  return h.get('x-real-ip')?.slice(0, 45) ?? null;
}

/**
 * Issue a trusted-device cookie and persist its hash. Call this only after
 * the user has successfully completed 2FA (verification or initial setup).
 */
export async function issueTrustedDevice(userId: string): Promise<void> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000);

  await db.insert(userTrustedDevices).values({
    userId,
    tokenHash,
    deviceLabel: await buildDeviceLabel(),
    ipAddress: await getClientIp(),
    expiresAt,
  });

  (await cookies()).set({
    name: TRUSTED_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Check whether the request carries a valid trusted-device cookie for the
 * given user. Updates lastUsedAt on hit. Returns true if the 2FA step
 * may be skipped.
 */
export async function isTrustedDevice(userId: string): Promise<boolean> {
  const token = (await cookies()).get(TRUSTED_COOKIE_NAME)?.value;
  if (!token) return false;

  const tokenHash = hashToken(token);
  const now = new Date();

  const [device] = await db
    .select({ id: userTrustedDevices.id })
    .from(userTrustedDevices)
    .where(
      and(
        eq(userTrustedDevices.tokenHash, tokenHash),
        eq(userTrustedDevices.userId, userId),
        isNull(userTrustedDevices.revokedAt),
        gt(userTrustedDevices.expiresAt, now),
      ),
    )
    .limit(1);

  if (!device) return false;

  await db
    .update(userTrustedDevices)
    .set({ lastUsedAt: now })
    .where(eq(userTrustedDevices.id, device.id));

  return true;
}

/** Clear the trusted-device cookie from the user's browser. */
export async function clearTrustedDeviceCookie(): Promise<void> {
  (await cookies()).delete(TRUSTED_COOKIE_NAME);
}
