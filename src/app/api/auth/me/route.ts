import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db/store';
import { verifySessionToken } from '@/lib/security/crypto';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('customer_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const email = verifySessionToken(sessionCookie);
    if (!email) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await db.ensureInitialized();
    const customer = await db.getCustomerByEmailAsync(email);
    if (!customer) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await db.linkCustomerBookings(customer.id, customer.email);
    const bookings = await db.getCustomerBookingsAsync(customer.id);

    return NextResponse.json({
      authenticated: true,
      customer,
      bookings: bookings.map((b) => ({
        id: b.id,
        orderReference: b.orderReference,
        categoryCode: b.categoryCode,
        quantity: b.quantity,
        totalAttendees: b.totalAttendees,
        amountPaise: b.amountPaise,
        paymentStatus: b.paymentStatus,
        passQrToken: b.passQrToken,
        reservationExpiresAt: b.reservationExpiresAt,
        createdAt: b.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve customer data' }, { status: 500 });
  }
}
