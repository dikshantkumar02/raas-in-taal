import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db/store';
import { sendTicketConfirmationEmail } from '@/lib/email/service';
import { hashToken } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 256 * 1024) {
      return NextResponse.json({ error: 'Payload exceeds limit' }, { status: 413 });
    }

    const signature = req.headers.get('x-razorpay-signature') || '';
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Server webhook secret not configured' }, { status: 500 });
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    let isValid = false;
    try {
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length === expBuf.length) {
        isValid = crypto.timingSafeEqual(sigBuf, expBuf);
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // Handle payment.captured or order.paid
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const paymentId = paymentEntity?.id;
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const orderReference =
        paymentEntity?.notes?.orderReference ||
        orderEntity?.notes?.orderReference ||
        paymentEntity?.receipt ||
        orderEntity?.receipt;

      if (!paymentId) {
        return NextResponse.json({ error: 'Missing payment entity id' }, { status: 400 });
      }

      // Idempotency check
      if (db.isPaymentProcessed(paymentId)) {
        return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
      }

      db.recordIdempotency({
        id: `idem_${Date.now()}`,
        transactionId: paymentId,
        provider: 'RAZORPAY_WEBHOOK',
        payloadHash: hashToken(rawBody),
        status: 'SUCCESS',
        createdAt: new Date(),
      });

      // Find order by orderReference or razorpay orderId
      let order = orderReference ? await db.getOrderByReferenceAsync(orderReference) : null;
      if (!order && orderId) {
        for (const o of db.getAllOrders()) {
          if (o.razorpayOrderId === orderId) {
            order = o;
            break;
          }
        }
      }

      if (order && order.paymentStatus !== 'SUCCESS') {
        const confirmation = await db.confirmPaymentAndIssuePass({
          orderId: order.id,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        });

        if (confirmation.success && confirmation.order && confirmation.pass) {
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

    return NextResponse.json({ success: true, received: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}
