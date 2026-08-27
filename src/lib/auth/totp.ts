import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '@/lib/utils/encryption';

const ISSUER = 'Chamelio PMS';
const PERIOD = 30;
const DIGITS = 6;
const ALGORITHM = 'SHA1'; // RFC 6238 default — most authenticator apps assume this
const VERIFY_WINDOW = 1; // accept current ± 1 step (~30s of clock skew either side)

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars → formatted as "xxxxx-xxxxx"

/** Build a TOTP instance for a given user. */
function buildTotp(secret: Secret, accountLabel: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret,
  });
}

/** Generate a fresh TOTP secret (160 bits, base32-encoded). */
export function generateTotpSecret(): Secret {
  return new Secret({ size: 20 });
}

/**
 * Build an otpauth:// URI suitable for QR codes.
 * Account label is shown in the user's authenticator app.
 */
export function buildOtpauthUri(secret: Secret, accountLabel: string): string {
  return buildTotp(secret, accountLabel).toString();
}

/** Render an otpauth URI as a PNG data URL. */
export async function renderQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}

/** Verify a 6-digit token against a secret. Strips whitespace. */
export function verifyTotpCode(secret: Secret, token: string, accountLabel = ''): boolean {
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;

  const delta = buildTotp(secret, accountLabel).validate({
    token: clean,
    window: VERIFY_WINDOW,
  });
  return delta !== null;
}

/** Encrypt a TOTP secret (base32) for storage. */
export function encryptTotpSecret(secret: Secret): string {
  return encrypt(secret.base32);
}

/** Decrypt a stored TOTP secret back into a Secret instance. */
export function decryptTotpSecret(encrypted: string): Secret {
  return Secret.fromBase32(decrypt(encrypted));
}

/** Generate N plaintext recovery codes formatted as "xxxxx-xxxxx" (10 hex chars). */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = randomBytes(RECOVERY_CODE_BYTES).toString('hex');
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5)}`);
  }
  return codes;
}

/** Normalize a recovery code for comparison (lowercase, no dashes/whitespace). */
export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, '');
}

/** Hash a recovery code for storage. */
export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

/** Constant-time comparison of an input recovery code against a stored hash. */
export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(normalizeRecoveryCode(code), hash);
}
