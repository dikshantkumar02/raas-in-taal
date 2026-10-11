import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db/store';
import { verifyRazorpaySignature, getRazorpayConfig } from '../src/lib/payments/razorpay';
import { POST as createOrderHandler } from '../src/app/api/create-order/route';
import { POST as verifyPaymentHandler } from '../src/app/api/verify-payment/route';

describe('Razorpay Standard Web Checkout Integration Test Suite', () => {
  const TEST_KEY_ID = 'rzp_test_TmZ25PPym09aUr';
  const TEST_KEY_SECRET = 'hhtKEMXqW2UuV85EXg3I0BDM';

  beforeEach(() => {
    db.reset();
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
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
  test('3. /api/create-order rejects amount < 100 paise with status 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
});
