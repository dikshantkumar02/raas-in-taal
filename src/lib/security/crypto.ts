import crypto from 'node:crypto';

/**
 * Generates a cryptographically unpredictable token for QR Gate Pass.
 * Uses 256 bits of CSPRNG entropy encoded in base64url.
 */
export function generateSecureToken(prefix = 'RIT'): string {
  const randomBytes = crypto.randomBytes(32).toString('base64url');
  return `${prefix}_${randomBytes}`;
}

/**
 * Computes SHA-256 hash in hex for token storage and lookup.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates an human-readable yet unique order reference.
 * Format: RIT-2026-XXXXXX
 */
export function generateOrderReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  return `RIT-2026-${rand}`;
}
