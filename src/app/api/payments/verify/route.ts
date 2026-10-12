import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { verifyRazorpaySignature, getRazorpayClient, getRazorpayConfig } from '@/lib/payments/razorpay';
import { sendTicketConfirmationEmail } from '@/lib/email/service';
import { checkRateLimit, getClientIp } from '@/lib/security/crypto';

function maskPhone(phone: string): string {
  const clean = String(phone || '').replace(/\D/g, '');
  return clean.length >= 10 ? `${clean.slice(0, 2)}******${clean.slice(-2)}` : '**********';
}

function formatOrderSummary(order: any) {
  const isExpired = Boolean(
    order.reservationExpiresAt &&
    order.paymentStatus !== 'SUCCESS' &&
    new Date(order.reservationExpiresAt).getTime() < Date.now()
  );

  return {
    orderReference: order.orderReference,
    categoryCode: order.categoryCode,
    quantity: order.quantity,
    totalAttendees: order.totalAttendees,
    amountPaise: order.amountPaise,
    currency: order.currency || 'INR',
    paymentStatus: isExpired && order.paymentStatus === 'RESERVED' ? 'EXPIRED' : order.paymentStatus,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: maskPhone(order.customerPhone),
    reservationExpiresAt: order.reservationExpiresAt,
    isExpired,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`payment_status_get_${ip}`, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const rawRef = searchParams.get('orderReference');
    if (!rawRef) {
      return NextResponse.json({ error: 'Order reference is required' }, { status: 400 });
    }

    const orderReference = decodeURIComponent(rawRef).trim().toUpperCase();
    await db.ensureInitialized();
    const order = await db.getOrderByReferenceAsync(orderReference);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderDetails = formatOrderSummary(order);

    if (order.paymentStatus === 'SUCCESS') {
      const pass = db.getPassByOrderId(order.id);
      return NextResponse.json({
        success: true,
        orderReference: order.orderReference,
        paymentStatus: 'SUCCESS',
        orderDetails,
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

    return NextResponse.json({
      success: false,
      orderReference: order.orderReference,
      paymentStatus: orderDetails.paymentStatus,
      orderDetails,
      message: 'Payment has not been completed or verified yet.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve order status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`payment_verify_${ip}`, 40, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many verification requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { orderReference: rawRef, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!rawRef) {
      return NextResponse.json({ error: 'Order reference is required' }, { status: 400 });
    }

    const orderReference = decodeURIComponent(rawRef).trim().toUpperCase();

    await db.ensureInitialized();
    const order = await db.getOrderByReferenceAsync(orderReference);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderDetails = formatOrderSummary(order);

    // If order is already verified, return existing pass immediately
    if (order.paymentStatus === 'SUCCESS') {
      const pass = db.getPassByOrderId(order.id);
      return NextResponse.json({
        success: true,
        orderReference: order.orderReference,
        paymentStatus: 'SUCCESS',
        orderDetails,
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

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    // Case 1: Cryptographic signature provided (from Razorpay Web Checkout modal)
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
        return NextResponse.json(
          { error: 'Security violation: Razorpay order ID does not match internal booking reservation' },
          { status: 400 }
        );
      }

      const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid Razorpay payment signature' },
          { status: 400 }
        );
      }

      const confirmation = await db.confirmPaymentAndIssuePass({
        orderId: order.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });

      if (!confirmation.success || !confirmation.pass) {
        return NextResponse.json(
          { error: confirmation.error || 'Failed to issue ticket gate pass' },
          { status: 400 }
        );
      }

      try {
        await sendTicketConfirmationEmail({
          order: confirmation.order!,
          pass: confirmation.pass,
          event: db.getEventConfig(),
          appBaseUrl: baseUrl,
        });
      } catch (emailErr: any) {
        console.warn('[PaymentsVerify] Email dispatch error:', emailErr?.message || emailErr);
      }

      return NextResponse.json({
        success: true,
        orderReference: order.orderReference,
        paymentStatus: 'SUCCESS',
        orderDetails: formatOrderSummary(confirmation.order!),
        pass: {
          qrToken: confirmation.pass.qrToken,
          categoryCode: confirmation.pass.categoryCode,
          totalAttendees: confirmation.pass.totalAttendees,
          admittedCount: confirmation.pass.admittedCount,
          status: confirmation.pass.status,
        },
      });
    }

    // Case 2: Status check / Reconcile directly with Razorpay gateway
    if (order.razorpayOrderId) {
      try {
        const config = getRazorpayConfig();
        if (config.keyId && config.keySecret) {
          const razorpay = getRazorpayClient();
          const paymentsResponse: any = await razorpay.orders.fetchPayments(order.razorpayOrderId);
          const capturedPayment = paymentsResponse?.items?.find((p: any) => p.status === 'captured');

          if (capturedPayment) {
            const capturedAmount = Number(capturedPayment.amount || 0);
            if (capturedAmount >= (order.amountPaise || 0)) {
              const confirmation = await db.confirmPaymentAndIssuePass({
                orderId: order.id,
                razorpayOrderId: order.razorpayOrderId,
                razorpayPaymentId: capturedPayment.id,
              });

              if (confirmation.success && confirmation.pass) {
                try {
                  await sendTicketConfirmationEmail({
                    order: confirmation.order!,
                    pass: confirmation.pass,
                    event: db.getEventConfig(),
                    appBaseUrl: baseUrl,
                  });
                } catch (emailErr: any) {
                  console.warn('[PaymentsReconcile] Email dispatch error:', emailErr?.message || emailErr);
                }

                return NextResponse.json({
                  success: true,
                  orderReference: order.orderReference,
                  paymentStatus: 'SUCCESS',
                  orderDetails: formatOrderSummary(confirmation.order!),
                  pass: {
                    qrToken: confirmation.pass.qrToken,
                    categoryCode: confirmation.pass.categoryCode,
                    totalAttendees: confirmation.pass.totalAttendees,
                    admittedCount: confirmation.pass.admittedCount,
                    status: confirmation.pass.status,
                  },
                });
              }
            }
          }
        }
      } catch (reconcileErr) {
        // Silently continue to return current database state
      }
    }

    // Default: Payment remains uncompleted
    return NextResponse.json(
      {
        success: false,
        paymentStatus: orderDetails.paymentStatus,
        orderDetails,
        message: 'Payment has not been completed or verified yet.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}
