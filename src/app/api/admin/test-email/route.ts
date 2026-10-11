import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { sendTicketConfirmationEmail } from '@/lib/email/service';
import { checkRateLimit, getClientIp, safeCompare } from '@/lib/security/crypto';
import { Order, GatePass } from '@/lib/db/types';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`admin_email_test_${ip}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 });
    }

    const adminKey = req.headers.get('x-admin-key') || '';
    const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev_super_secret_admin_key_32_characters_minimum');

    if (!expectedKey || !safeCompare(adminKey, expectedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const recipientEmail = (body.recipientEmail || 'raasintaal@gmail.com').trim();

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const dummyOrder: Order = {
      id: 'test_email_' + Date.now(),
      orderReference: 'RNT-RESEND-TEST',
      categoryCode: 'stag_girls',
      quantity: 1,
      totalAttendees: 1,
      amountPaise: 49900,
      currency: 'INR',
      customerName: 'Resend Verification User',
      customerEmail: recipientEmail,
      customerPhone: '9876543210',
      attendeeDetails: [{ name: 'Resend Verification User' }],
      groupFemaleVerified: true,
      paymentStatus: 'SUCCESS',
      reservationExpiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dummyPass: GatePass = {
      id: 'pass_test_' + Date.now(),
      orderId: dummyOrder.id,
      bookingReference: dummyOrder.orderReference,
      qrToken: 'rnt_resend_verification_' + Date.now(),
      qrTokenHash: 'hash_' + Date.now(),
      categoryCode: 'stag_girls',
      totalAttendees: 1,
      admittedCount: 0,
      status: 'VALID',
      issuedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await sendTicketConfirmationEmail({
      order: dummyOrder,
      pass: dummyPass,
      event: db.getEventConfig(),
      appBaseUrl: baseUrl,
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      provider: result.provider,
      recipient: recipientEmail,
      error: result.error,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal test email error' }, { status: 500 });
  }
}
