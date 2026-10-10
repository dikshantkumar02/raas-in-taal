import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import {
  safeCompare,
  checkRateLimit,
  getClientIp,
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  sanitizeInputString,
  verifyStaffSessionToken,
} from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`scanner_${ip}`, 120, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'RATE_LIMITED', message: 'Too many scan requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const pinLockoutKey = `staff_pin_fail_${ip}`;
    const pinLockout = checkBruteForceLockout(pinLockoutKey, 5, 15 * 60 * 1000);
    if (pinLockout.locked) {
      return NextResponse.json(
        {
          success: false,
          error: 'STAFF_PIN_LOCKED',
          message: `Scanner access temporarily locked due to repeated invalid PIN attempts. Try again in ${pinLockout.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    // Authenticate staff via session token (cookie or header) or fallback PIN
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieToken = req.cookies.get('staff_session')?.value;
    const customToken = req.headers.get('x-staff-token');
    const sessionToken = headerToken || cookieToken || customToken;

    let authenticatedStaff: { id: string; name: string } | null = null;

    if (sessionToken) {
      const payload = verifyStaffSessionToken(sessionToken);
      if (payload) {
        const staff = db.getStaffById(payload.staffId);
        if (staff && staff.isActive) {
          authenticatedStaff = { id: staff.id, name: staff.name };
        } else if (staff && !staff.isActive) {
          return NextResponse.json(
            { success: false, error: 'STAFF_REVOKED', message: 'Staff access has been revoked.' },
            { status: 403 }
          );
        }
      }
    }

    if (!authenticatedStaff) {
      const authPin = req.headers.get('x-staff-pin') || '';
      const expectedPin = process.env.STAFF_PIN || '202618';

      // Fallback PIN authorization check using constant-time comparison
      if (!authPin || !safeCompare(authPin, expectedPin)) {
        recordFailedAttempt(pinLockoutKey, 5, 15 * 60 * 1000);
        return NextResponse.json(
          { success: false, error: 'UNAUTHORIZED_STAFF', message: 'Unauthorized staff access. Please enter valid Staff PIN or sign in.' },
          { status: 403 }
        );
      }
      authenticatedStaff = { id: 'STAFF_GATE_1', name: 'Gate Officer' };
    }

    clearFailedAttempts(pinLockoutKey);

    const body = await req.json();
    const { token, staffId, staffName, admitCount } = body;

    if (!token || typeof token !== 'string' || token.trim().length > 256) {
      return NextResponse.json(
        { success: false, error: 'MISSING_TOKEN', message: 'No valid QR pass token provided.' },
        { status: 400 }
      );
    }

    const count = Number(admitCount) || 1;
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      return NextResponse.json(
        { success: false, error: 'INVALID_COUNT', message: 'Admit count must be an integer between 1 and 20.' },
        { status: 400 }
      );
    }

    let cleanToken = token.trim();
    if (cleanToken.includes('/ticket/')) {
      cleanToken = cleanToken.split('/ticket/').pop() || cleanToken;
    }
    cleanToken = decodeURIComponent(cleanToken.split('?')[0]).trim();

    // Whitelist token characters to prevent malformed injections
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanToken)) {
      return NextResponse.json(
        { success: false, error: 'MALFORMED_TOKEN', message: 'Pass token format is invalid.' },
        { status: 400 }
      );
    }

    const safeStaffId = sanitizeInputString(authenticatedStaff.id || staffId || 'GATE_STAFF_1', 50);
    const safeStaffName = sanitizeInputString(authenticatedStaff.name || staffName || 'Gate Officer', 100);

    const checkInResult = await db.recordCheckIn({
      tokenOrHash: cleanToken,
      staffId: safeStaffId,
      staffName: safeStaffName,
      admitCount: count,
    });

    if (!checkInResult.success) {
      return NextResponse.json(checkInResult, { status: 400 });
    }

    return NextResponse.json(checkInResult, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Check-in server verification failed. Fail closed.' },
      { status: 500 }
    );
  }
}
