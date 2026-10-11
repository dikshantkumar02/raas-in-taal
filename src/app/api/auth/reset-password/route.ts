import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { checkRateLimit, getClientIp } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`reset_pw_${ip}`, 15, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts from this IP. Please wait before trying again.' },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { email, otp, newPassword } = body;
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit verification code.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return NextResponse.json(
        { error: 'New password must be between 6 and 128 characters long.' },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // Verify customer exists
    const customer = db.getCustomerByEmail(normEmail);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid verification request.' }, { status: 400 });
    }

    // Atomically verify and consume OTP challenge
    const verification = db.verifyAndConsumePasswordResetOtp(normEmail, otp.trim());
    if (!verification.success) {
      return NextResponse.json({ error: verification.error || 'Verification failed.' }, { status: 400 });
    }

    // Update password securely in database (hashes with salt + scrypt/argon/sha256)
    const updated = db.updateCustomerPassword(normEmail, newPassword);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });

    // Invalidate any existing customer session cookie
    response.cookies.set('customer_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error resetting password.' }, { status: 500 });
  }
}
