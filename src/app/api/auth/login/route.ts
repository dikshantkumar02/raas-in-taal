import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import {
  createSessionToken,
  checkRateLimit,
  getClientIp,
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`login_${ip}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 1 minute before trying again.' },
        { status: 429 }
      );
    }
    const { email, password } = await req.json();

    if (!email?.trim() || !password || typeof password !== 'string' || password.length > 128) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();
    const lockoutKey = `login_fail_${ip}_${normEmail}`;
    const lockout = checkBruteForceLockout(lockoutKey, 5, 10 * 60 * 1000);
    if (lockout.locked) {
      return NextResponse.json(
        { error: `Account login temporarily locked due to multiple failed attempts. Please wait ${lockout.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const verification = db.verifyCustomer(normEmail, password);
    if (!verification.success || !verification.customer) {
      recordFailedAttempt(lockoutKey, 5, 10 * 60 * 1000);
      return NextResponse.json(
        { error: verification.error || 'Invalid email or password.' },
        { status: 401 }
      );
    }

    clearFailedAttempts(lockoutKey);
    db.linkCustomerBookings(verification.customer.id, verification.customer.email);
    const token = createSessionToken(verification.customer.email);
    const response = NextResponse.json({
      success: true,
      customer: verification.customer,
      message: 'Logged in successfully!',
    });

    response.cookies.set('customer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error during login.' }, { status: 500 });
  }
}
