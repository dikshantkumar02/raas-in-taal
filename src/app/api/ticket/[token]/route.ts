import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { checkRateLimit, getClientIp } from '@/lib/security/crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`ticket_view_${ip}`, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    const { token } = await params;
    if (!token || typeof token !== 'string' || token.length > 256 || !/^[a-zA-Z0-9_\-\.]+$/.test(token)) {
      return NextResponse.json({ error: 'Invalid or malformed pass token' }, { status: 400 });
    }

    const pass = await db.getPassByTokenAsync(token);
    if (!pass) {
      return NextResponse.json({ error: 'Pass not found or invalid' }, { status: 404 });
    }

    const order = await db.getOrderByIdAsync(pass.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Associated order not found' }, { status: 404 });
    }

    const event = db.getEventConfig();

    const rawPhone = String(order.customerPhone || '');
    const maskedPhone =
      rawPhone.length >= 10
        ? `${rawPhone.slice(0, 2)}******${rawPhone.slice(-2)}`
        : '**********';

    return NextResponse.json({
      pass: {
        id: pass.id,
        bookingReference: pass.bookingReference,
        qrToken: pass.qrToken,
        categoryCode: pass.categoryCode,
        totalAttendees: pass.totalAttendees,
        admittedCount: pass.admittedCount,
        status: pass.status,
        issuedAt: pass.issuedAt,
      },
      order: {
        customerName: order.customerName,
        customerPhone: maskedPhone,
        amountPaise: order.amountPaise,
        paidAt: order.paidAt,
        attendeeDetails: order.attendeeDetails,
      },
      event: {
        name: event.name,
        brand: event.brand,
        venue: event.venue,
        eventDate: event.eventDate,
        durgaPujaTime: event.durgaPujaTime,
        dandiyaNightTime: event.dandiyaNightTime,
        contactPhones: event.phones,
        instagramHandle: event.instagramHandle,
        instagramUrl: event.instagramUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error retrieving pass' }, { status: 500 });
  }
}
