import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { sendTicketConfirmationEmail } from '@/lib/email/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingReference, email } = body;

    if (!bookingReference || !email) {
      return NextResponse.json({ error: 'Booking reference and email are required.' }, { status: 400 });
    }

    const order = db.getOrderByReference(bookingReference);
    if (!order) {
      return NextResponse.json({ error: 'No booking found matching this reference.' }, { status: 404 });
    }

    // Match email
    if (order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Email address does not match this booking record.' }, { status: 403 });
    }

    if (order.paymentStatus !== 'SUCCESS') {
      return NextResponse.json({ error: 'Booking payment is not confirmed.' }, { status: 400 });
    }

    const pass = db.getPassByOrderId(order.id);
    if (!pass) {
      return NextResponse.json({ error: 'Gate pass has not been issued yet.' }, { status: 404 });
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const emailRes = await sendTicketConfirmationEmail({
      order,
      pass,
      event: db.getEventConfig(),
      appBaseUrl: baseUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Gate pass has been resent to your registered email address.',
      deliveryStatus: emailRes.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to resend pass email.' }, { status: 500 });
  }
}
