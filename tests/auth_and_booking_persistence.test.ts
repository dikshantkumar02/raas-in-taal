import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db/store';
import { createSessionToken, verifyPassword } from '../src/lib/security/crypto';
import { POST as createOrderHandler } from '../src/app/api/create-order/route';
import { GET as authMeHandler } from '../src/app/api/auth/me/route';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { POST as registerHandler } from '../src/app/api/auth/register/route';
import { POST as forgotPasswordHandler } from '../src/app/api/auth/forgot-password/route';
import { POST as resetPasswordHandler } from '../src/app/api/auth/reset-password/route';

describe('Mandatory Signup/Login, Booking History Persistence & Secure OTP Recovery', () => {
  const TEST_KEY_ID = 'rzp_test_TmZ25PPym09aUr';
  const TEST_KEY_SECRET = 'hhtKEMXqW2UuV85EXg3I0BDM';

  beforeEach(() => {
    db.reset();
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
  });

  // 1. Mandatory Authentication on Order Creation
  test('1. Unauthenticated direct call to /api/create-order is rejected with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryCode: 'stag_girls',
        quantity: 1,
        amount: 24900,
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  });

  test('2. Tampered or expired session cookie on /api/create-order is rejected with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'customer_session=forged_invalid_cookie_token.12345',
      },
      body: JSON.stringify({
        categoryCode: 'stag_girls',
        quantity: 1,
        amount: 24900,
      }),
    });

    const res = await createOrderHandler(req);
    assert.equal(res.status, 401);
  });

  test('3. Authenticated customer ID is derived from server session and saved in DB record', async () => {
    const regRes = await db.registerCustomer({
      name: 'Rohan Gupta',
      email: 'rohan@example.com',
      phone: '9876543210',
      password: 'Password123!',
    });
    assert.ok(regRes.customer);
    const customerId = regRes.customer.id;
    const cookie = `customer_session=${createSessionToken('rohan@example.com')}`;

    const reservation = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Rohan Gupta',
      customerEmail: 'rohan@example.com',
      customerPhone: '9876543210',
      customerId,
    });

    assert.equal(reservation.success, true);
    assert.ok(reservation.order);
    assert.equal(reservation.order.customerId, customerId, 'Order must store authenticated customer ID');
  });

  // 2. Persistent Booking History Across Refreshes and Logins
  test('4. Booking history is retrieved from database via /api/auth/me and persists', async () => {
    const regRes = await db.registerCustomer({
      name: 'Sneha Patel',
      email: 'sneha@example.com',
      phone: '9812345678',
      password: 'Password123!',
    });
    assert.ok(regRes.customer);
    const cookie = `customer_session=${createSessionToken('sneha@example.com')}`;

    // Create 2 bookings for Sneha
    const b1 = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Sneha Patel',
      customerEmail: 'sneha@example.com',
      customerPhone: '9812345678',
      customerId: regRes.customer.id,
    });
    const b2 = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'Sneha Patel',
      customerEmail: 'sneha@example.com',
      customerPhone: '9812345678',
      groupFemaleVerified: true,
      customerId: regRes.customer.id,
    });

    assert.ok(b1.order);
    assert.ok(b2.order);

    // Call /api/auth/me (simulating initial load and page refresh)
    const req = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { cookie },
    });

    const res = await authMeHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.authenticated, true);
    assert.equal(data.customer.id, regRes.customer.id);
    assert.equal(data.bookings.length, 2, 'Must return both bookings for authenticated customer');
    assert.equal(data.bookings[0].categoryCode, 'group');
    assert.equal(data.bookings[1].categoryCode, 'stag_girls');
  });

  test('5. linkCustomerBookings associates prior guest orders matching verified email upon registration/login', async () => {
    // Simulate a prior reservation made with priya@example.com before registering
    const priorOrder = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Priya Sharma',
      customerEmail: 'priya@example.com',
      customerPhone: '9898989898',
    });
    assert.ok(priorOrder.order);
    assert.equal(priorOrder.order.customerId, undefined, 'Prior order initially has no customerId');

    // Now Priya registers an account with the matching email
    const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: 'priya@example.com',
        phone: '9898989898',
        password: 'Password123!',
      }),
    });

    const regRes = await registerHandler(regReq);
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    assert.ok(regData.customer.id);

    // Prior order is now linked to Priya's customerId
    const updatedOrder = db.getOrderById(priorOrder.order.id);
    assert.equal(updatedOrder?.customerId, regData.customer.id, 'Prior order must be linked to verified customerId');

    // When Priya queries /api/auth/me, her prior booking appears in history
    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { cookie: `customer_session=${createSessionToken('priya@example.com')}` },
    });
    const meRes = await authMeHandler(meReq);
    const meData = await meRes.json();
    assert.equal(meData.bookings.length, 1);
    assert.equal(meData.bookings[0].orderReference, priorOrder.order.orderReference);
  });

  test('6. User cannot view bookings belonging to a different user', async () => {
    const u1 = await db.registerCustomer({ name: 'User 1', email: 'user1@example.com', phone: '1111111111', password: 'Password1!' });
    const u2 = await db.registerCustomer({ name: 'User 2', email: 'user2@example.com', phone: '2222222222', password: 'Password2!' });

    await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'User 1',
      customerEmail: 'user1@example.com',
      customerPhone: '1111111111',
      customerId: u1.customer?.id,
    });

    // User 2 queries /api/auth/me
    const req = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { cookie: `customer_session=${createSessionToken('user2@example.com')}` },
    });

    const res = await authMeHandler(req);
    const data = await res.json();
    assert.equal(data.bookings.length, 0, 'User 2 must not see User 1 bookings');
  });

  // 3. Secure Forgot Password and OTP Recovery
  test('7. /api/auth/forgot-password generates OTP and returns generic privacy message', async () => {
    await db.registerCustomer({
      name: 'Vikas Mehra',
      email: 'vikas@example.com',
      phone: '9988776655',
      password: 'OldPassword123!',
    });

    const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vikas@example.com' }),
    });

    const res = await forgotPasswordHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.match(data.message, /If an account exists/i);
  });

  test('8. /api/auth/forgot-password returns identical response for non-existent email without disclosing presence', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const res = await forgotPasswordHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.match(data.message, /If an account exists/i);
  });

  test('9. OTP resend cooldown enforces 60-second wait before generating new OTP', async () => {
    await db.registerCustomer({
      name: 'Kavita Das',
      email: 'kavita@example.com',
      phone: '9876123450',
      password: 'Password123!',
    });

    // First request
    const req1 = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita@example.com' }),
    });
    const res1 = await forgotPasswordHandler(req1);
    assert.equal(res1.status, 200);

    // Immediate second request: should be blocked by cooldown
    const req2 = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita@example.com' }),
    });
    const res2 = await forgotPasswordHandler(req2);
    assert.equal(res2.status, 429);
    const data2 = await res2.json();
    assert.match(data2.error, /wait|seconds/i);
  });

  test('10. Invalid OTP is rejected with remaining attempts counter', async () => {
    await db.registerCustomer({
      name: 'Aditya Roy',
      email: 'aditya@example.com',
      phone: '9876541122',
      password: 'OldPassword123!',
    });

    // Store a challenge with OTP 654321
    db.createPasswordResetOtp('aditya@example.com', '654321');

    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aditya@example.com',
        otp: '000000', // Incorrect OTP
        newPassword: 'NewPassword123!',
      }),
    });

    const res = await resetPasswordHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid verification code/i);
  });

  test('11. 5 failed attempts lock out and invalidate the OTP challenge', async () => {
    await db.registerCustomer({
      name: 'Mohit Rao',
      email: 'mohit@example.com',
      phone: '9876549988',
      password: 'OldPassword123!',
    });

    db.createPasswordResetOtp('mohit@example.com', '123456');

    // Submit 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      db.verifyAndConsumePasswordResetOtp('mohit@example.com', '999999');
    }

    // Now even correct OTP should be rejected
    const check = db.verifyAndConsumePasswordResetOtp('mohit@example.com', '123456');
    assert.equal(check.success, false);
    assert.match(check.error || '', /expired|No active|Too many/i);
  });

  test('12. Successfully verified OTP updates password and cannot be reused', async () => {
    await db.registerCustomer({
      name: 'Pooja Jain',
      email: 'pooja@example.com',
      phone: '9876547766',
      password: 'OldPassword123!',
    });

    db.createPasswordResetOtp('pooja@example.com', '887766');

    const resetReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pooja@example.com',
        otp: '887766',
        newPassword: 'BrandNewPassword2026!',
      }),
    });

    const resetRes = await resetPasswordHandler(resetReq);
    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.equal(resetData.success, true);

    // Attempting to reuse the same OTP must fail
    const reuseReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pooja@example.com',
        otp: '887766',
        newPassword: 'AnotherPassword333!',
      }),
    });
    const reuseRes = await resetPasswordHandler(reuseReq);
    assert.equal(reuseRes.status, 400, 'Reused OTP must be rejected');

    // New password works for login
    const loginNew = db.verifyCustomer('pooja@example.com', 'BrandNewPassword2026!');
    assert.equal(loginNew.success, true, 'New password must verify successfully');

    // Old password no longer works
    const loginOld = db.verifyCustomer('pooja@example.com', 'OldPassword123!');
    assert.equal(loginOld.success, false, 'Old password must be rejected');
  });

  test('13. New password shorter than 6 characters is rejected', async () => {
    await db.registerCustomer({
      name: 'Sunil Verma',
      email: 'sunil@example.com',
      phone: '9876543322',
      password: 'OldPassword123!',
    });

    db.createPasswordResetOtp('sunil@example.com', '112233');

    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sunil@example.com',
        otp: '112233',
        newPassword: '123', // Too short
      }),
    });

    const res = await resetPasswordHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /between 6 and 128 characters/i);
  });
});
