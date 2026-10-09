import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { checkPhonePePaymentStatus } from '@/lib/payments/phonepe';
import { sendTicketConfirmationEmail } from '@/lib/email/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderReference, transactionId, simulateSuccess } = body;

    if (!orderReference) {
      return NextResponse.json({ error: 'Order reference is required' }, { status: 400 });
    }

    const order = db.getOrderByReference(orderReference);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // If order is already verified, return existing pass
    if (order.paymentStatus === 'SUCCESS') {
      const pass = db.getPassByOrderId(order.id);
      return NextResponse.json({
        success: true,
        orderReference: order.orderReference,
        paymentStatus: 'SUCCESS',
        pass: pass
          ? {
              qrToken: pass.qrToken,
              categoryCode: pass.categoryCode,
              totalAttendees: pass.totalAttendees,
              admittedCount: pass.admittedCount,
              status: pass.status,
            }
          : undefined,
      });
    }

    let isPaymentValid = false;
    let providerRef = transactionId || 'UAT_REF';

    // Verify against PhonePe server API
    if (transactionId) {
      const statusRes = await checkPhonePePaymentStatus(transactionId);
      if (statusRes.success && statusRes.status === 'PAYMENT_SUCCESS') {
        // Strict verification: check amount in paise
        if (statusRes.amountPaise && statusRes.amountPaise !== order.amountPaise) {
          return NextResponse.json(
            { error: 'Payment amount mismatch between gateway and order' },
            { status: 400 }
          );
        }
        isPaymentValid = true;
        providerRef = statusRes.providerReferenceId || providerRef;
      } else if (process.env.NODE_ENV !== 'production' && simulateSuccess) {
        // Sandbox testing mode verification
        isPaymentValid = true;
      }
    } else if (process.env.NODE_ENV !== 'production' && simulateSuccess) {
      isPaymentValid = true;
    }

    if (!isPaymentValid) {
      return NextResponse.json(
        {
          success: false,
          paymentStatus: order.paymentStatus,
          message: 'Payment has not been completed or verified yet.',
        },
        { status: 200 }
      );
    }

    // Confirm payment and issue 1 Gate Pass per booking
    const confirmation = await db.confirmPaymentAndIssuePass({
      orderId: order.id,
      phonepeTransactionId: transactionId || `TXN_${Date.now()}`,
      phonepeProviderReference: providerRef,
    });

    if (!confirmation.success || !confirmation.pass) {
      return NextResponse.json(
        { error: confirmation.error || 'Failed to issue ticket gate pass' },
        { status: 400 }
      );
    }

    // Trigger confirmation email
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    // Background email dispatch
    sendTicketConfirmationEmail({
      order: confirmation.order!,
      pass: confirmation.pass,
      event: db.getEventConfig(),
      appBaseUrl: baseUrl,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      orderReference: order.orderReference,
      paymentStatus: 'SUCCESS',
      pass: {
        qrToken: confirmation.pass.qrToken,
        categoryCode: confirmation.pass.categoryCode,
        totalAttendees: confirmation.pass.totalAttendees,
        admittedCount: confirmation.pass.admittedCount,
        status: confirmation.pass.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}
