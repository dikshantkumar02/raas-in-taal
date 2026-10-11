import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db/store';
import { sendPasswordResetOtpEmail } from '@/lib/email/service';
import { checkRateLimit, getClientIp } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`forgot_pw_${ip}`, 10, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many recovery requests from this IP. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail) || normEmail.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // Rate limit per target email (max 5 requests per 10 mins)
    const emailRate = checkRateLimit(`forgot_pw_email_${normEmail}`, 5, 10 * 60 * 1000);
    if (!emailRate.allowed) {
      return NextResponse.json(
        { error: 'Too many recovery attempts for this email. Please wait a few minutes before requesting another code.' },
        { status: 429 }
      );
    }

    // Generic privacy-preserving message returned to caller
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email address, password recovery instructions with a verification code have been sent.',
    };

    await db.ensureInitialized();
    const customer = await db.getCustomerByEmailAsync(normEmail);
    if (!customer) {
      // Consistent timing / privacy: do not disclose account absence
      return NextResponse.json(genericResponse);
    }

    // Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Store challenge with 60-second cooldown & 5-minute expiry
    const challengeRes = db.createPasswordResetOtp(normEmail, otp);
    if (!challengeRes.success && challengeRes.cooldownRemaining) {
      return NextResponse.json(
        { error: `Please wait ${challengeRes.cooldownRemaining} seconds before requesting a new code.` },
        { status: 429 }
      );
    }

    // Dispatch OTP email
    await sendPasswordResetOtpEmail({
      email: normEmail,
      otp,
    });

    return NextResponse.json(genericResponse);
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error processing password recovery.' }, { status: 500 });
  }
}
