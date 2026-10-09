import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token missing' }, { status: 400 });
    }

    const pass = db.getPassByToken(token);
    if (!pass) {
      return NextResponse.json({ error: 'Pass not found or invalid' }, { status: 404 });
    }

    const order = db.getOrderById(pass.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Associated order not found' }, { status: 404 });
    }

    const event = db.getEventConfig();

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
        customerPhone: order.customerPhone,
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
