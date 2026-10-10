import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken, checkRateLimit, getClientIp, sanitizeInputString } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`register_${ip}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many registration requests. Please wait a moment.' },
        { status: 429 }
      );
    }
    const { name, email, phone, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    const sanitizedName = sanitizeInputString(name, 100);
    if (!sanitizedName || sanitizedName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 6 and 128 characters long.' },
        { status: 400 }
      );
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 15) : '';

    const reg = await db.registerCustomer({
      name: sanitizedName,
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      password,
    });

    if (!reg.success || !reg.customer) {
      return NextResponse.json({ error: reg.error || 'Failed to create account.' }, { status: 400 });
    }

    const token = createSessionToken(reg.customer.email);
    const response = NextResponse.json({
      success: true,
      customer: reg.customer,
      message: 'Account created successfully!',
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
    return NextResponse.json({ error: 'Server error during registration.' }, { status: 500 });
  }
}
