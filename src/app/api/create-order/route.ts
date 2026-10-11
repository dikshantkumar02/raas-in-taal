import { NextRequest, NextResponse } from 'next/server';
import { getRazorpayClient, getRazorpayConfig } from '@/lib/payments/razorpay';
import { db } from '@/lib/db/store';
import { TicketCategoryCode } from '@/lib/db/types';
import { checkRateLimit, getClientIp, sanitizeInputString } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`order_create_${ip}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    const config = getRazorpayConfig();
    if (!config.keyId || !config.keySecret) {
      return NextResponse.json(
        { error: 'Razorpay credentials not configured or unauthorized' },
        { status: 401 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const {
      amount,
      currency = 'INR',
      receipt,
      notes,
      categoryCode,
      quantity,
      customerName,
      customerEmail,
      customerPhone,
      attendeeDetails,
      groupFemaleVerified,
    } = body;

    // Validate amount (in paise, minimum 100 paise = 1 INR)
    const numericAmount = Number(amount);
    if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount < 100) {
      return NextResponse.json(
        { error: 'Amount is required and must be at least 100 paise' },
        { status: 400 }
      );
    }

    let bookingOrderReference: string | undefined = undefined;

    // If checkout attendee / category information is provided, create reservation in database
    if (categoryCode && customerName && customerEmail) {
      if (!['stag_girls', 'couple', 'group', 'family'].includes(categoryCode)) {
        return NextResponse.json({ error: 'Invalid ticket category' }, { status: 400 });
      }

      const qty = Number(quantity || 1);
      if (!qty || qty < 1 || !Number.isInteger(qty) || qty > 10) {
        return NextResponse.json({ error: 'Quantity must be between 1 and 10' }, { status: 400 });
      }

      const sanitizedCustomerName = sanitizeInputString(customerName, 100);
      const cleanPhone = String(customerPhone || '').replace(/\D/g, '');

      const cleanAttendees = Array.isArray(attendeeDetails)
        ? attendeeDetails.slice(0, 20).map((a: any) => ({
            name: sanitizeInputString(a?.name, 100),
          }))
        : [];

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

      bookingOrderReference = reservation.order.orderReference;
    }

    // Call Razorpay API to create order
    try {
      const razorpay = getRazorpayClient();
      const generatedReceipt = receipt || bookingOrderReference || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const orderOptions: any = {
        amount: Math.round(numericAmount),
        currency: currency || 'INR',
        receipt: generatedReceipt,
        notes: {
          ...(notes || {}),
          ...(bookingOrderReference ? { orderReference: bookingOrderReference } : {}),
        },
      };

      const razorpayOrder = await razorpay.orders.create(orderOptions);

      return NextResponse.json({
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        key_id: config.keyId,
        ...(bookingOrderReference ? { orderReference: bookingOrderReference } : {}),
      });
    } catch (razorpayErr: any) {
      // Handle authentication failures (401)
      if (
        razorpayErr?.statusCode === 401 ||
        razorpayErr?.status === 401 ||
        razorpayErr?.error?.code === 'BAD_REQUEST_ERROR' &&
          (razorpayErr?.error?.description?.toLowerCase().includes('auth') ||
            razorpayErr?.error?.description?.toLowerCase().includes('key'))
      ) {
        return NextResponse.json(
          { error: 'Razorpay authentication failed. Invalid key or secret.' },
          { status: 401 }
        );
      }

      // Handle Razorpay API errors (500)
      return NextResponse.json(
        {
          error:
            razorpayErr?.error?.description ||
            razorpayErr?.message ||
            'Razorpay API error while creating order',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error creating order' }, { status: 500 });
  }
}
