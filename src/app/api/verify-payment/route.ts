import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db/store';
import { sendTicketConfirmationEmail } from '@/lib/email/service';
import { checkRateLimit, getClientIp } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`payment_verify_${ip}`, 40, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many verification requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    // Support both standard field names and razorpay prefixed field names
    const orderId = body.order_id || body.razorpay_order_id;
    const paymentId = body.payment_id || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const orderReference = body.orderReference || body.receipt;

    // Validate missing fields (return 400)
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          error: 'Missing required fields: order_id, payment_id, and signature are required',
        },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Razorpay secret key not configured on server' },
        { status: 500 }
      );
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Constant-time comparison
    let signaturesMatch = false;
    try {
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expBuffer = Buffer.from(expectedSignature, 'utf8');
      if (sigBuffer.length === expBuffer.length) {
        signaturesMatch = crypto.timingSafeEqual(sigBuffer, expBuffer);
      }
    } catch {
      signaturesMatch = false;
    }

    // Signature mismatch: return 400, do NOT mark as paid
    if (!signaturesMatch) {
      return NextResponse.json(
        {
          error: 'Signature verification failed: generated signature does not match razorpay_signature',
        },
        { status: 400 }
      );
    }

    // Payment is valid and verified
    let orderDetails: any = null;
    let gatePassDetails: any = null;

    // Check if order exists in the booking database
    await db.ensureInitialized();
    let order = orderReference ? await db.getOrderByReferenceAsync(orderReference) : null;
    if (!order && orderId) {
      // Look up order in memory store if razorpayOrderId or receipt was recorded
      for (const o of db.getAllOrders()) {
        if (o.razorpayOrderId === orderId || o.orderReference === orderReference) {
          order = o;
          break;
        }
      }
    }

    if (order) {
      // Security Check: If internal order already has a registered razorpayOrderId, ensure strict binding
      if (order.razorpayOrderId && order.razorpayOrderId !== orderId) {
        return NextResponse.json(
          { error: 'Security violation: Razorpay order ID does not match internal booking reservation' },
          { status: 400 }
        );
      }

      if (order.paymentStatus === 'SUCCESS') {
        const pass = db.getPassByOrderId(order.id);
        orderDetails = order;
        gatePassDetails = pass;
      } else {
        const confirmation = await db.confirmPaymentAndIssuePass({
          orderId: order.id,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        });

        if (confirmation.success && confirmation.order && confirmation.pass) {
          orderDetails = confirmation.order;
          gatePassDetails = confirmation.pass;

          // Dispatch confirmation email
          const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
          const proto = req.headers.get('x-forwarded-proto') || 'http';
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

          sendTicketConfirmationEmail({
            order: confirmation.order,
            pass: confirmation.pass,
            event: db.getEventConfig(),
            appBaseUrl: baseUrl,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      order_id: orderId,
      payment_id: paymentId,
      ...(orderDetails ? { orderReference: orderDetails.orderReference } : {}),
      ...(gatePassDetails
        ? {
            pass: {
              qrToken: gatePassDetails.qrToken,
              categoryCode: gatePassDetails.categoryCode,
              totalAttendees: gatePassDetails.totalAttendees,
              admittedCount: gatePassDetails.admittedCount,
              status: gatePassDetails.status,
            },
          }
        : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error verifying payment' }, { status: 500 });
  }
}
