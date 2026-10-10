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

/**
 * Standard scrypt password hashing (zero dependencies).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeCompare(hash, key);
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY CONFIGURATION ERROR: ADMIN_SECRET_KEY must be set in production mode.');
    }
    return 'raas_in_taal_customer_auth_fallback_secret_32';
  }
  return secret;
}

export function createSessionToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const secret = getSessionSecret();
  const hmac = crypto.createHmac('sha256', secret).update(normalized).digest('hex');
  return `${Buffer.from(normalized).toString('base64url')}.${hmac}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    const [b64Email, hmac] = token.split('.');
    if (!b64Email || !hmac) return null;
    const email = Buffer.from(b64Email, 'base64url').toString('utf8');
    const secret = getSessionSecret();
    const expected = crypto.createHmac('sha256', secret).update(email).digest('hex');
    if (safeCompare(hmac, expected)) {
      return email;
    }
    return null;
  } catch {
    return null;
  }
}

export interface StaffSessionPayload {
  staffId: string;
  username: string;
  role: 'staff' | 'gate_supervisor';
  exp: number;
}

/**
 * Creates a cryptographically signed HMAC staff session token with 12-hour expiration.
 */
export function createStaffSessionToken(
  payload: Omit<StaffSessionPayload, 'exp'>,
  expiresInHours = 12
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = JSON.stringify({ ...payload, exp });
  const b64Data = Buffer.from(data).toString('base64url');
  const secret = getSessionSecret();
  const hmac = crypto.createHmac('sha256', secret).update(b64Data).digest('hex');
  return `${b64Data}.${hmac}`;
}

/**
 * Verifies the HMAC signature, role, and expiration of a staff session token.
 */
export function verifyStaffSessionToken(token: string): StaffSessionPayload | null {
  try {
    const [b64Data, hmac] = token.split('.');
    if (!b64Data || !hmac) return null;
    const secret = getSessionSecret();
    const expected = crypto.createHmac('sha256', secret).update(b64Data).digest('hex');
    if (!safeCompare(hmac, expected)) return null;

    const payload: StaffSessionPayload = JSON.parse(Buffer.from(b64Data, 'base64url').toString('utf8'));
    if (payload.role !== 'staff' && payload.role !== 'gate_supervisor') return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null; // Expired

    return payload;
  } catch {
    return null;
  }
}


const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

export function checkRateLimit(key: string, maxRequests = 25, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Protect memory against unbounded growth
  if (rateLimitMap.size > 2000) {
    pruneExpiredRateLimits();
    if (rateLimitMap.size > 5000) {
      const keys = Array.from(rateLimitMap.keys()).slice(0, 1000);
      for (const k of keys) rateLimitMap.delete(k);
    }
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

const failedAttemptMap = new Map<string, { failures: number; lockedUntil: number }>();

/**
 * Checks whether an IP or identity key is currently locked out due to excessive failed attempts.
 */
export function checkBruteForceLockout(
  key: string,
  maxFailures = 5,
  lockoutDurationMs = 900000
): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = failedAttemptMap.get(key);
  if (!record) return { locked: false, retryAfterSeconds: 0 };
  if (record.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttemptMap.delete(key);
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Records a failed authentication or authorization attempt and applies a lockout if threshold is exceeded.
 */
export function recordFailedAttempt(
  key: string,
  maxFailures = 5,
  lockoutDurationMs = 900000
): { locked: boolean; failures: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = failedAttemptMap.get(key) || { failures: 0, lockedUntil: 0 };
  record.failures += 1;
  if (record.failures >= maxFailures) {
    record.lockedUntil = now + lockoutDurationMs;
    failedAttemptMap.set(key, record);
    return { locked: true, failures: record.failures, retryAfterSeconds: Math.ceil(lockoutDurationMs / 1000) };
  }
  failedAttemptMap.set(key, record);
  return { locked: false, failures: record.failures, retryAfterSeconds: 0 };
}

/**
 * Clears failed attempts upon a successful authentication.
 */
export function clearFailedAttempts(key: string): void {
  failedAttemptMap.delete(key);
}

/**
 * Neutralizes dangerous characters and control codes from user input strings.
 * Strips HTML angle brackets (<, >) and non-printable control characters (\x00-\x1F, \x7F).
 */
export function sanitizeInputString(input: unknown, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

/**
 * Extracts true client IP address safely from forwarded headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}


