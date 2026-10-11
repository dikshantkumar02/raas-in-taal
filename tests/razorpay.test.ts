import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db/store';
import { verifyRazorpaySignature, getRazorpayConfig, getRazorpayClient } from '../src/lib/payments/razorpay';
import { createSessionToken } from '../src/lib/security/crypto';
import { POST as createOrderHandler } from '../src/app/api/create-order/route';
import { POST as verifyPaymentHandler } from '../src/app/api/verify-payment/route';
import { POST as razorpayWebhookHandler } from '../src/app/api/webhooks/razorpay/route';

describe('Razorpay Standard Web Checkout Integration Test Suite', () => {
  const TEST_KEY_ID = 'rzp_test_TmZ25PPym09aUr';
  const TEST_KEY_SECRET = 'hhtKEMXqW2UuV85EXg3I0BDM';

  let testCookie = '';

  beforeEach(async () => {
    db.reset();
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    await db.registerCustomer({
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '9876543210',
      password: 'Password123!',
    });
    testCookie = `customer_session=${createSessionToken('test@example.com')}`;
  });

  // 1. Signature algorithm verification
  test('1. verifyRazorpaySignature computes HMAC-SHA256(order_id + "|" + payment_id, SECRET) correctly', () => {
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';
    const payload = `${orderId}|${paymentId}`;
    const expectedSig = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const isValid = verifyRazorpaySignature(orderId, paymentId, expectedSig, TEST_KEY_SECRET);
    assert.equal(isValid, true, 'Valid HMAC signature should be accepted');
  });

  test('2. verifyRazorpaySignature rejects forged, tampered, or mismatched signatures', () => {
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';
    const forgedSig = '9999999999999999999999999999999999999999999999999999999999999999';

    const isValid = verifyRazorpaySignature(orderId, paymentId, forgedSig, TEST_KEY_SECRET);
    assert.equal(isValid, false, 'Forged signature must be rejected');

    const isTamperedPayment = verifyRazorpaySignature('order_test_12345', 'pay_altered_99999', forgedSig, TEST_KEY_SECRET);
    assert.equal(isTamperedPayment, false, 'Tampered payment ID must be rejected');

    const isEmptyOrder = verifyRazorpaySignature('', paymentId, forgedSig, TEST_KEY_SECRET);
    assert.equal(isEmptyOrder, false, 'Empty orderId must be rejected');
  });

  // 2. POST /api/create-order validation & error handling
  test('2b. /api/create-order rejects unauthenticated request with status 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 24900,
        currency: 'INR',
        categoryCode: 'stag_girls',
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  });

  test('3. /api/create-order rejects amount < 100 paise with status 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: testCookie },
      body: JSON.stringify({
        amount: 50, // Less than minimum 100 paise
        currency: 'INR',
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /100 paise/i);
  });

  test('4. /api/create-order rejects missing or invalid non-numeric amount with status 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: testCookie },
      body: JSON.stringify({
        amount: 'invalid_amount',
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Amount is required/i);
  });

  test('5. /api/create-order returns 401 when Razorpay credentials are missing', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: testCookie },
      body: JSON.stringify({
        amount: 50000,
        currency: 'INR',
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /credentials|unauthorized/i);
  });

  // 3. POST /api/verify-payment validation & error handling
  test('6. /api/verify-payment rejects missing required fields with status 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'order_123',
        // missing payment_id and signature
      }),
    });

    const res = await verifyPaymentHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /missing required fields/i);
  });

  test('7. /api/verify-payment rejects signature mismatch with status 400 and does NOT mark order as paid', async () => {
    // Create an order in DB
    const reservation = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Pooja Verma',
      customerEmail: 'pooja@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(reservation.success, true);
    const order = reservation.order!;

    const req = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'order_rzp_mock_123',
        payment_id: 'pay_rzp_mock_456',
        signature: 'invalid_forged_signature_hash',
        orderReference: order.orderReference,
      }),
    });

    const res = await verifyPaymentHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /signature/i);

    // Verify order was NOT marked as paid in DB
    const refreshedOrder = db.getOrderByReference(order.orderReference);
    assert.notEqual(refreshedOrder?.paymentStatus, 'SUCCESS');
  });

  test('8. /api/verify-payment accepts valid HMAC signature, marks order as SUCCESS, and issues gate pass', async () => {
    // Create order in DB
    const reservation = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Rahul & Simran',
      customerEmail: 'rahul@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(reservation.success, true);
    const order = reservation.order!;

    const orderId = 'order_valid_789';
    const paymentId = 'pay_valid_101';
    const validSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const req = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
        orderReference: order.orderReference,
      }),
    });

    const res = await verifyPaymentHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.order_id, orderId);
    assert.equal(data.payment_id, paymentId);
    assert.ok(data.pass, 'Gate pass should be returned');
    assert.ok(data.pass.qrToken, 'QR token should be present in issued pass');

    // Verify order is now marked SUCCESS in DB
    const confirmedOrder = db.getOrderByReference(order.orderReference);
    assert.equal(confirmedOrder?.paymentStatus, 'SUCCESS');
    assert.equal(confirmedOrder?.razorpayOrderId, orderId);
    assert.equal(confirmedOrder?.razorpayPaymentId, paymentId);
  });

  // 4. Server-Authoritative Pricing Protection
  test('9. /api/create-order overrides client-manipulated price with authoritative server price', async () => {
    // Attempt to book a couple ticket (₹999 / 99900 paise) while manipulating amount to 100 paise (₹1)
    const client = getRazorpayClient();
    const originalCreate = client.orders.create;
    let capturedOptions: any = null;

    client.orders.create = (async (opts: any) => {
      capturedOptions = opts;
      return {
        id: 'order_mock_authoritative_123',
        amount: opts.amount,
        currency: opts.currency,
        receipt: opts.receipt,
      };
    }) as any;

    try {
      const req = new NextRequest('http://localhost:3000/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: testCookie },
        body: JSON.stringify({
          amount: 100, // Client tampered amount
          categoryCode: 'couple',
          quantity: 1,
          customerName: 'Aman & Neha',
          customerEmail: 'aman@example.com',
          customerPhone: '9876543210',
        }),
      });

      const res = await createOrderHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.orderReference);

      // Verify that Razorpay was asked to charge 44900 paise (₹449), completely ignoring the 100 paise
      assert.equal(capturedOptions?.amount, 44900, 'Razorpay order amount must be 44900 paise');
      
      // Check that DB order has the true authoritative price of 44900 paise (₹449), NOT 100 paise
      const savedOrder = db.getOrderByReference(data.orderReference);
      assert.equal(savedOrder?.amountPaise, 44900, 'Authoritative server price must be enforced');
      assert.equal(savedOrder?.razorpayOrderId, data.order_id, 'Razorpay order ID must be attached');
    } finally {
      client.orders.create = originalCreate;
    }
  });

  // 5. Razorpay Order ID Mismatch Rejection
  test('10. /api/verify-payment rejects payment when razorpay_order_id does not match the reserved order', async () => {
    const reservation = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Ananya Roy',
      customerEmail: 'ananya@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(reservation.success, true);
    const order = reservation.order!;

    // Attach legitimate razorpay order ID
    db.attachRazorpayOrderId(order.id, 'order_real_111');

    // Attacker tries to verify using a different razorpay order ID
    const attackerOrderId = 'order_attacker_999';
    const attackerPaymentId = 'pay_attacker_999';
    const attackerSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(`${attackerOrderId}|${attackerPaymentId}`)
      .digest('hex');

    const req = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: attackerOrderId,
        razorpay_payment_id: attackerPaymentId,
        razorpay_signature: attackerSignature,
        orderReference: order.orderReference,
      }),
    });

    const res = await verifyPaymentHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /does not match|mismatch/i);
    assert.notEqual(db.getOrderByReference(order.orderReference)?.paymentStatus, 'SUCCESS');
  });

  // 6. Webhook Security: Signature, Underpayment & Idempotency
  test('11. /api/webhooks/razorpay enforces HMAC signature, prevents underpayment, and processes idempotently', async () => {
    const reservation = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Vivek & Priya',
      customerEmail: 'vivek@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(reservation.success, true);
    const order = reservation.order!;
    db.attachRazorpayOrderId(order.id, 'order_webhook_123');

    // Case A: Reject forged webhook signature
    const forgedReq = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'forged_fake_signature_hash',
      },
      body: JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_fake_1', order_id: 'order_webhook_123', amount: 99900 } },
        },
      }),
    });
    const forgedRes = await razorpayWebhookHandler(forgedReq);
    assert.equal(forgedRes.status, 400);

    // Case B: Reject underpayment attempt (e.g. paying 20000 paise instead of 44900 paise)
    const underpayBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_underpay_1',
            order_id: 'order_webhook_123',
            amount: 20000, // Underpayment (< 44900)
            notes: { orderReference: order.orderReference },
          },
        },
      },
    });
    const underpaySig = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(underpayBody)
      .digest('hex');

    const underpayReq = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': underpaySig },
      body: underpayBody,
    });
    const underpayRes = await razorpayWebhookHandler(underpayReq);
    assert.equal(underpayRes.status, 400);
    assert.notEqual(db.getOrderByReference(order.orderReference)?.paymentStatus, 'SUCCESS');

    // Case C: Valid captured payment confirms order and issues pass
    const validBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_valid_hook_1',
            order_id: 'order_webhook_123',
            amount: 44900, // Full price
            notes: { orderReference: order.orderReference },
          },
        },
      },
    });
    const validSig = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(validBody)
      .digest('hex');

    const validReq = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': validSig },
      body: validBody,
    });
    const validRes = await razorpayWebhookHandler(validReq);
    assert.equal(validRes.status, 200);
    assert.equal(db.getOrderByReference(order.orderReference)?.paymentStatus, 'SUCCESS');

    // Case D: Duplicate webhook delivery is handled idempotently without error
    const dupReq = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': validSig },
      body: validBody,
    });
    const dupRes = await razorpayWebhookHandler(dupReq);
    assert.equal(dupRes.status, 200);
  });
});
