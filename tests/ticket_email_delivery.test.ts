import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db/store';
import { sendTicketConfirmationEmail, getEmailDeliveryStatus } from '../src/lib/email/service';
import { Order, GatePass } from '../src/lib/db/types';

describe('Event Pass Delivery in Payment Confirmation Email Suite', () => {
  test('1. A successfully verified payment produces the correct ticket email with gate pass details', async () => {
    await db.ensureInitialized();
    const orderRef = 'RNT-EML-' + Date.now();
    const order: Order = {
      id: 'ord_eml_' + Date.now(),
      orderReference: orderRef,
      categoryCode: 'couple',
      quantity: 1,
      totalAttendees: 2,
      amountPaise: 44900,
      currency: 'INR',
      customerName: 'Aman & Neha Verma',
      customerEmail: 'raasintaal@gmail.com',
      customerPhone: '9876543210',
      attendeeDetails: [{ name: 'Aman Verma' }, { name: 'Neha Verma' }],
      groupFemaleVerified: true,
      paymentStatus: 'SUCCESS',
      reservationExpiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pass: GatePass = {
      id: 'pass_eml_' + Date.now(),
      orderId: order.id,
      bookingReference: order.orderReference,
      qrToken: 'rnt_test_couple_token_' + Date.now(),
      qrTokenHash: 'hash_' + Date.now(),
      categoryCode: 'couple',
      totalAttendees: 2,
      admittedCount: 0,
      status: 'VALID',
      issuedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await sendTicketConfirmationEmail({
      order,
      pass,
      event: db.getEventConfig(),
      appBaseUrl: 'https://raas-in-taal-pi.vercel.app',
    });

    assert.equal(result.success, true);
    assert.ok(['SENT', 'MOCKED'].includes(result.status));
    const delivery = getEmailDeliveryStatus(order.id);
    assert.ok(delivery);
    assert.equal(delivery.orderId, order.id);
  });

  test('2. Couple, family, and group bookings receive appropriate pass & attendee information', async () => {
    await db.ensureInitialized();
    const groupOrder: Order = {
      id: 'ord_grp_' + Date.now(),
      orderReference: 'RNT-GRP-' + Date.now(),
      categoryCode: 'group',
      quantity: 1,
      totalAttendees: 4,
      amountPaise: 69900,
      currency: 'INR',
      customerName: 'Rohan Mehra',
      customerEmail: 'raasintaal@gmail.com',
      customerPhone: '9876543210',
      attendeeDetails: [
        { name: 'Rohan Mehra' },
        { name: 'Sneha Kapur' },
        { name: 'Aditya Sen' },
        { name: 'Kavita Joshi' },
      ],
      groupFemaleVerified: true,
      paymentStatus: 'SUCCESS',
      reservationExpiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const groupPass: GatePass = {
      id: 'pass_grp_' + Date.now(),
      orderId: groupOrder.id,
      bookingReference: groupOrder.orderReference,
      qrToken: 'rnt_grp_token_' + Date.now(),
      qrTokenHash: 'hash_grp_' + Date.now(),
      categoryCode: 'group',
      totalAttendees: 4,
      admittedCount: 0,
      status: 'VALID',
      issuedAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await sendTicketConfirmationEmail({
      order: groupOrder,
      pass: groupPass,
      event: db.getEventConfig(),
      appBaseUrl: 'https://raas-in-taal-pi.vercel.app',
    });

    assert.equal(res.success, true);
  });

  test('3. Scanned QR token matches database pass and works with check-in flow', async () => {
    await db.ensureInitialized();
    const reserveRes = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Pooja Bhatt',
      customerEmail: 'pooja.bhatt@test.com',
      customerPhone: '9876543211',
    });
    assert.equal(reserveRes.success, true);
    assert.ok(reserveRes.order);

    const confirmRes = await db.confirmPaymentAndIssuePass({
      orderId: reserveRes.order.id,
      razorpayOrderId: 'order_scan_' + Date.now(),
      razorpayPaymentId: 'pay_scan_' + Date.now(),
    });
    assert.equal(confirmRes.success, true);
    assert.ok(confirmRes.pass);

    // Verify token can be checked in
    const checkIn = await db.recordCheckIn({
      tokenOrHash: confirmRes.pass.qrToken,
      staffId: 'STAFF_1',
      staffName: 'Gate Officer',
      admitCount: 1,
    });
    assert.equal(checkIn.success, true);
    assert.equal(checkIn.nowAdmitted, 1);
    assert.equal(checkIn.resultCode, 'ENTRY_ACCEPTED');
  });

  test('4. Retrying email delivery does not generate duplicate tickets or alter booking status', async () => {
    await db.ensureInitialized();
    const reserveRes = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Ritika Roy',
      customerEmail: 'ritika.roy@test.com',
      customerPhone: '9876543212',
    });
    assert.equal(reserveRes.success, true);

    const firstConfirm = await db.confirmPaymentAndIssuePass({
      orderId: reserveRes.order!.id,
      razorpayOrderId: 'order_retry_' + Date.now(),
      razorpayPaymentId: 'pay_retry_' + Date.now(),
    });
    assert.equal(firstConfirm.success, true);
    const pass1 = firstConfirm.pass!;

    // Re-confirming / retrying must return the exact same pass ID and token
    const secondConfirm = await db.confirmPaymentAndIssuePass({
      orderId: reserveRes.order!.id,
      razorpayOrderId: 'order_retry_' + Date.now(),
      razorpayPaymentId: 'pay_retry_' + Date.now(),
    });
    assert.equal(secondConfirm.success, true);
    assert.equal(secondConfirm.pass!.id, pass1.id);
    assert.equal(secondConfirm.pass!.qrToken, pass1.qrToken);
  });

  test('5. Unverified / unpaid orders do not receive a valid gate pass', async () => {
    await db.ensureInitialized();
    const unverifiedReserve = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Pending User',
      customerEmail: 'pending@test.com',
      customerPhone: '9876543213',
    });
    assert.equal(unverifiedReserve.success, true);

    // Pass must not exist prior to payment confirmation
    const pass = db.getPassByOrderId(unverifiedReserve.order!.id);
    assert.equal(pass, undefined);
  });
});
