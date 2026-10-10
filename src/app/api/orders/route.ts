import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { TicketCategoryCode } from '@/lib/db/types';
import { initiatePhonePePayment } from '@/lib/payments/phonepe';
import { verifySessionToken, checkRateLimit, getClientIp, sanitizeInputString } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`order_create_${ip}`, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many order requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // Optional customer session for account linking
    const sessionCookie = req.cookies.get('customer_session')?.value;
    const sessionEmail = sessionCookie ? verifySessionToken(sessionCookie) : null;
    const sessionCustomer = sessionEmail ? db.getCustomerByEmail(sessionEmail) : null;

    const body = await req.json();
    const { categoryCode, quantity, customerName, customerEmail, customerPhone, attendeeDetails, groupFemaleVerified } = body;

    // Strict input validation
    if (!categoryCode || !['stag_girls', 'couple', 'group', 'family'].includes(categoryCode)) {
      return NextResponse.json({ error: 'Invalid or missing ticket category' }, { status: 400 });
    }

    const qty = Number(quantity);
    if (!qty || qty < 1 || !Number.isInteger(qty) || qty > 10) {
      return NextResponse.json({ error: 'Quantity must be an integer between 1 and 10' }, { status: 400 });
    }

    const sanitizedCustomerName = sanitizeInputString(customerName, 100);
    if (!sanitizedCustomerName || sanitizedCustomerName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name (maximum 100 characters)' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || typeof customerEmail !== 'string' || customerEmail.length > 254 || !emailRegex.test(customerEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const cleanPhone = String(customerPhone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json({ error: 'Please enter a valid mobile number (10 to 15 digits)' }, { status: 400 });
    }

    if (Array.isArray(attendeeDetails) && attendeeDetails.length > 20) {
      return NextResponse.json({ error: 'Attendee details list exceeds maximum allowed entries' }, { status: 400 });
    }

    if (categoryCode === 'group' && !groupFemaleVerified) {
      return NextResponse.json(
        { error: 'Group ticket requires confirmation that at least one attendee is female.' },
        { status: 400 }
      );
    }

    const cleanAttendees = Array.isArray(attendeeDetails)
      ? attendeeDetails.slice(0, 20).map((a: any) => ({
          name: sanitizeInputString(a?.name, 100),
        }))
      : [];

    // Atomic reservation in database against the 500-attendee limit
    const reservation = await db.createReservation({
      categoryCode: categoryCode as TicketCategoryCode,
      quantity: qty,
      customerName: sanitizedCustomerName,
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: cleanPhone,
      attendeeDetails: cleanAttendees,
      groupFemaleVerified: Boolean(groupFemaleVerified),
      expiryMinutes: 10,
    });

    if (!reservation.success || !reservation.order) {
      if (reservation.error === 'CAPACITY_EXCEEDED') {
        return NextResponse.json(
          { error: 'This ticket category cannot be booked because event capacity has been reached.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: reservation.error || 'Failed to create reservation' }, { status: 400 });
    }

    const order = reservation.order;
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // App base URL for callback and redirects
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const redirectUrl = `${baseUrl}/booking/${order.orderReference}?txn=${transactionId}`;
    const callbackUrl = `${baseUrl}/api/webhooks/phonepe`;

    // Initiate payment with PhonePe
    const paymentInit = await initiatePhonePePayment({
      transactionId,
      orderReference: order.orderReference,
      amountPaise: order.amountPaise,
      customerPhone: cleanPhone,
      customerUserId: `USR_${cleanPhone.slice(-6)}`,
      redirectUrl,
      callbackUrl,
    });

    if (!paymentInit.success) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Payment gateway communication failed. Please try again later.' },
          { status: 502 }
        );
      }
      // In sandbox/development when network or phonepe api is unavailable, supply fallback simulation redirect
      return NextResponse.json({
        success: true,
        orderReference: order.orderReference,
        transactionId,
        amountPaise: order.amountPaise,
        totalAttendees: order.totalAttendees,
        redirectUrl: `${baseUrl}/booking/${order.orderReference}?txn=${transactionId}&mode=sandbox`,
        note: 'PhonePe UAT Mode',
      });
    }

    return NextResponse.json({
      success: true,
      orderReference: order.orderReference,
      transactionId,
      amountPaise: order.amountPaise,
      totalAttendees: order.totalAttendees,
      redirectUrl: paymentInit.redirectUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error processing order' }, { status: 500 });
  }
}
