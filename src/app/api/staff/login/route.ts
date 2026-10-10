import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import {
  createStaffSessionToken,
  checkRateLimit,
  getClientIp,
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  sanitizeInputString,
} from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`staff_login_${ip}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many staff login attempts. Please wait 1 minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { username, pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'Staff Gate PIN is required.' },
        { status: 400 }
      );
    }

    const cleanUsername = sanitizeInputString(username || 'gate1', 50).toLowerCase();
    const cleanPin = pin.trim();

    const lockoutKey = `staff_lockout_${ip}_${cleanUsername}`;
    const lockout = checkBruteForceLockout(lockoutKey, 5, 15 * 60 * 1000);
    if (lockout.locked) {
      return NextResponse.json(
        {
          error: `Staff login temporarily locked due to repeated invalid PIN attempts. Please wait ${lockout.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const authResult = db.verifyStaff(cleanUsername, cleanPin);
    if (!authResult.success || !authResult.staff) {
      recordFailedAttempt(lockoutKey, 5, 15 * 60 * 1000);
      return NextResponse.json(
        { error: authResult.error || 'Invalid staff credentials or PIN.' },
        { status: 401 }
      );
    }

    clearFailedAttempts(lockoutKey);

    const token = createStaffSessionToken({
      staffId: authResult.staff.id,
      username: authResult.staff.username,
      role: authResult.staff.role,
    });

    const response = NextResponse.json({
      success: true,
      token,
      staff: authResult.staff,
      message: `Welcome, ${authResult.staff.name}. Staff Gate Session authorized.`,
    });

    response.cookies.set('staff_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12-hour event shift
    });

    return response;
  } catch (err: any) {
    console.error('Staff login error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error processing staff authentication.' },
      { status: 500 }
    );
  }
}
