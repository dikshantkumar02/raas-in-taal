import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { sendTicketConfirmationEmail } from '@/lib/email/service';
import { sanitizeInputString } from '@/lib/security/crypto';
import { TicketCategoryCode } from '@/lib/db/types';

export async function POST(req: NextRequest) {
  // STRICT GUARD: Only allowed in development mode or localhost
  const host = req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  if (process.env.NODE_ENV === 'production' && !isLocal) {
    return NextResponse.json({ error: 'Simulation disabled in production' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      categoryCode,
      quantity = 1,
      customerName,
      customerEmail,
      customerPhone,
      attendeeDetails = [],
      groupFemaleVerified = false,
    } = body;

    if (!categoryCode || !customerName || !customerEmail) {
      return NextResponse.json({ error: 'Missing required customer details' }, { status: 400 });
    }

    const qty = Number(quantity);
    const sanitizedName = sanitizeInputString(customerName, 100);
    const cleanPhone = String(customerPhone || '').replace(/\D/g, '') || '9876543210';

    const cleanAttendees = Array.isArray(attendeeDetails)
      ? attendeeDetails.slice(0, 20).map((a: any) => ({
          name: sanitizeInputString(a?.name, 100),
        }))
      : [];

    // 1. Create reservation
    const reservation = await db.createReservation({
      categoryCode: categoryCode as TicketCategoryCode,
      quantity: qty,
      customerName: sanitizedName,
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: cleanPhone,
      attendeeDetails: cleanAttendees,
      groupFemaleVerified: Boolean(groupFemaleVerified),
      expiryMinutes: 10,
    });

    if (!reservation.success || !reservation.order) {
      return NextResponse.json({ error: reservation.error || 'Failed to reserve tickets' }, { status: 400 });
    }

    const simPaymentId = `pay_sim_${Date.now()}`;
    const simOrderId = `order_sim_${Date.now()}`;

    // 2. Confirm payment and issue gate pass
    const confirmation = await db.confirmPaymentAndIssuePass({
      orderId: reservation.order.id,
      razorpayOrderId: simOrderId,
      razorpayPaymentId: simPaymentId,
      razorpaySignature: 'simulated_signature_dev_mode',
    });

    if (!confirmation.success || !confirmation.order || !confirmation.pass) {
      return NextResponse.json({ error: 'Failed to issue gate pass' }, { status: 500 });
    }

    // 3. Dispatch ticket confirmation email
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const emailRes = await sendTicketConfirmationEmail({
      order: confirmation.order,
      pass: confirmation.pass,
      event: db.getEventConfig(),
      appBaseUrl: baseUrl,
    });

    return NextResponse.json({
      success: true,
      simulated: true,
      orderReference: confirmation.order.orderReference,
      token: confirmation.pass.qrToken,
      emailStatus: emailRes.status,
      emailProvider: emailRes.provider,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Simulation failed' }, { status: 500 });
  }
}
