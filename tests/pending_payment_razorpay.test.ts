import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db/store';
import { getRazorpayClient } from '../src/lib/payments/razorpay';
import { createSessionToken } from '../src/lib/security/crypto';
import { POST as createOrderHandler } from '../src/app/api/create-order/route';
import { POST as verifyPaymentHandler, GET as getPaymentStatusHandler } from '../src/app/api/payments/verify/route';

describe('Pending Payment Page & Real Razorpay Checkout Integration', () => {
  const TEST_KEY_ID = 'rzp_test_TmZ25PPym09aUr';
  const TEST_KEY_SECRET = 'hhtKEMXqW2UuV85EXg3I0BDM';
  const CUSTOMER_EMAIL = 'dandiya_fan@example.com';

  let sessionCookie = '';
  let pendingOrderReference = '';

  beforeEach(async () => {
    db.reset();
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

    // Mock Razorpay SDK orders.create to avoid external network dependencies during tests
    const client = getRazorpayClient();
    client.orders.create = (async (opts: any) => {
      return {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        amount: opts.amount,
        currency: opts.currency,
        receipt: opts.receipt,
      };
    }) as any;

    const cust = await db.registerCustomer({
      name: 'Dandiya Fan',
      email: CUSTOMER_EMAIL,
      phone: '9876543210',
      password: 'Password123!',
    });

    sessionCookie = `customer_session=${createSessionToken(CUSTOMER_EMAIL)}`;

    // Create an initial reservation
    const res = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Dandiya Fan',
      customerEmail: CUSTOMER_EMAIL,
      customerPhone: '9876543210',
      customerId: cust.customer?.id,
    });

    assert.ok(res.success && res.order);
    pendingOrderReference = res.order.orderReference;
  });

  test('1. GET /api/payments/verify returns trusted database details for pending booking', async () => {
    const req = new NextRequest(`http://localhost:3000/api/payments/verify?orderReference=${pendingOrderReference}`, {
      method: 'GET',
    });

    const res = await getPaymentStatusHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, false);
    assert.equal(data.paymentStatus, 'RESERVED');
    assert.equal(data.orderDetails.orderReference, pendingOrderReference);
    assert.equal(data.orderDetails.categoryCode, 'couple');
    assert.equal(data.orderDetails.amountPaise, 44900);
    assert.equal(data.orderDetails.customerEmail, CUSTOMER_EMAIL);
    assert.ok(data.orderDetails.customerPhone.includes('*')); // Masked for privacy
  });

  test('2. POST /api/payments/verify strictly rejects sandbox simulateSuccess and does NOT mark order as paid', async () => {
    const req = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderReference: pendingOrderReference,
        simulateSuccess: true, // Should be ignored
      }),
    });

    const res = await verifyPaymentHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, false);
    assert.equal(data.paymentStatus, 'RESERVED');

    // Confirm DB record is still unpaid
    const order = db.getOrderByReference(pendingOrderReference);
    assert.equal(order?.paymentStatus, 'RESERVED');
    assert.equal(Boolean(db.getPassByOrderId(order!.id)), false, 'No gate pass should be issued for simulated attempts');
  });

  test('3. Initiating Razorpay checkout for existing pending order derives amount authoritatively from DB', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        orderReference: pendingOrderReference,
        amount: 100, // Client attempts to manipulate price to 100 paise (₹1)
      }),
    });

    const res = await createOrderHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.ok(data.order_id);
    // Server overrides client-manipulated price with authoritative 44900 paise (₹449)
    assert.equal(data.amount, 44900);
    assert.equal(data.orderReference, pendingOrderReference);
    assert.equal(data.key_id, TEST_KEY_ID);
  });

  test('4. Another user cannot initiate payment on a booking they do not own', async () => {
    const unauthorizedCookie = `customer_session=${createSessionToken('intruder@example.com')}`;
    await db.registerCustomer({
      name: 'Intruder',
      email: 'intruder@example.com',
      phone: '9111111111',
      password: 'Password123!',
    });

    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: unauthorizedCookie,
      },
      body: JSON.stringify({
        orderReference: pendingOrderReference,
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 403);
  });

  test('5. Valid Razorpay signature marks pending booking as SUCCESS and issues QR gate pass', async () => {
    // 1. Create order
    const createReq = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        orderReference: pendingOrderReference,
      }),
    });

    const createRes = await createOrderHandler(createReq);
    const orderData = await createRes.json();
    const razorpayOrderId = orderData.order_id;
    const razorpayPaymentId = `pay_${Date.now()}`;

    // 2. Generate authentic HMAC signature
    const signature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    // 3. Verify
    const verifyReq = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderReference: pendingOrderReference,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      }),
    });

    const verifyRes = await verifyPaymentHandler(verifyReq);
    const verifyData = await verifyRes.json();

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyData.success, true);
    assert.equal(verifyData.paymentStatus, 'SUCCESS');
    assert.ok(verifyData.pass.qrToken);
    assert.equal(verifyData.pass.totalAttendees, 2);

    // Verify DB state
    const updatedOrder = db.getOrderByReference(pendingOrderReference);
    assert.equal(updatedOrder?.paymentStatus, 'SUCCESS');
    assert.equal(updatedOrder?.razorpayPaymentId, razorpayPaymentId);
  });
});
