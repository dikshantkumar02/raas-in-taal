import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { getPhonePeConfig, verifyCallbackSignature } from '@/lib/payments/phonepe';
import { hashToken } from '@/lib/security/crypto';
import { sendTicketConfirmationEmail } from '@/lib/email/service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const xVerify = req.headers.get('x-verify') || '';

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const responseBase64 = parsedBody.response;
    if (!responseBase64) {
      return NextResponse.json({ error: 'Missing response payload' }, { status: 400 });
    }

    const config = getPhonePeConfig();

    // Verify cryptographic signature
    const isValidSignature = verifyCallbackSignature(
      responseBase64,
      xVerify,
      config.saltKey,
      config.saltIndex
    );

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid callback signature' }, { status: 401 });
    }

    // Decode base64 payload
    const decodedJsonString = Buffer.from(responseBase64, 'base64').toString('utf-8');
    const paymentData = JSON.parse(decodedJsonString);

    const transactionId = paymentData.data?.merchantTransactionId;
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing merchantTransactionId' }, { status: 400 });
    }

    // Check Idempotency: has this transaction payload already been processed?
    const payloadHash = hashToken(rawBody);
    if (db.isPaymentProcessed(transactionId)) {
      // Return 200 OK without re-processing
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    // Record idempotency
    db.recordIdempotency({
      id: `idem_${Date.now()}`,
      transactionId,
      provider: 'PHONEPE',
      payloadHash,
      status: paymentData.code || 'UNKNOWN',
      createdAt: new Date(),
    });

    if (paymentData.code === 'PAYMENT_SUCCESS') {
      const allOrders = db.getAllOrders();
      // Match order by transaction ID or order reference
      const order = allOrders.find(
        (o) => o.phonepeTransactionId === transactionId || transactionId.includes(o.orderReference)
      );

      if (order) {
        // Validate amount matches expected order total
        const receivedAmount = paymentData.data?.amount;
        if (receivedAmount && receivedAmount !== order.amountPaise) {
          return NextResponse.json(
            { error: 'Amount mismatch between webhook and internal order' },
            { status: 400 }
          );
        }

        const confirmRes = await db.confirmPaymentAndIssuePass({
          orderId: order.id,
          phonepeTransactionId: transactionId,
          phonepeProviderReference: paymentData.data?.transactionId,
        });

        if (confirmRes.success && confirmRes.pass) {
          const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
          const proto = req.headers.get('x-forwarded-proto') || 'http';
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

          sendTicketConfirmationEmail({
            order,
            pass: confirmRes.pass,
            event: db.getEventConfig(),
            appBaseUrl: baseUrl,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Callback processed' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error processing webhook' }, { status: 500 });
  }
}
