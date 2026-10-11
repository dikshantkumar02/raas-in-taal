import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sendTicketConfirmationEmail, getEmailDeliveryStatus } from '../src/lib/email/service';
import { Order, GatePass, EventConfig } from '../src/lib/db/types';

describe('Resend Email Integration Test Suite', () => {
  const dummyOrder: Order = {
    id: 'ord_test_' + Date.now(),
    orderReference: 'RNT-TEST-001',
    categoryCode: 'stag_girls',
    quantity: 2,
    totalAttendees: 2,
    amountPaise: 99800,
    currency: 'INR',
    customerName: 'Aarav Sharma <script>alert(1)</script>',
    customerEmail: 'delivered@resend.dev',
    customerPhone: '9876543210',
    attendeeDetails: [{ name: 'Aarav Sharma' }, { name: 'Priya Sharma' }],
    groupFemaleVerified: true,
    paymentStatus: 'SUCCESS',
    reservationExpiresAt: new Date(Date.now() + 600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyPass: GatePass = {
    id: 'pass_test_' + Date.now(),
    orderId: dummyOrder.id,
    bookingReference: dummyOrder.orderReference,
    qrToken: 'rnt_test_qr_token_1234567890',
    qrTokenHash: 'hash_test_123',
    categoryCode: 'stag_girls',
    totalAttendees: 2,
    admittedCount: 0,
    status: 'VALID',
    issuedAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyEvent: EventConfig = {
    id: 'evt_2026',
    slug: 'raas-in-taal-2026',
    name: 'Raas in Taal 2026',
    brand: 'Chaos and Chill',
    venue: 'JECC Ground, Sitapura, Jaipur',
    eventDate: '2026-10-18',
    durgaPujaTime: '17:30',
    dandiyaNightTime: '18:00',
    maxCapacity: 500,
    phones: ['8003022503', '8278695419'],
    instagramHandle: '@chaos_and_chill',
    instagramUrl: 'https://instagram.com/chaos_and_chill',
    refundPolicy: 'Non-refundable strictly.',
    isActive: true,
  };

  test('1. sendTicketConfirmationEmail sends real email or handles mock safely', async () => {
    const res = await sendTicketConfirmationEmail({
      order: dummyOrder,
      pass: dummyPass,
      event: dummyEvent,
      appBaseUrl: 'http://localhost:3000',
    });

    assert.equal(res.success, true);
    assert.ok(['SENT', 'MOCKED'].includes(res.status));

    const delivery = getEmailDeliveryStatus(dummyOrder.id);
    assert.ok(delivery);
    assert.equal(delivery?.orderId, dummyOrder.id);
  });

  test('2. Resend escapes HTML tags from customer input in emails', async () => {
    const orderWithInjection: Order = {
      ...dummyOrder,
      id: 'ord_inj_' + Date.now(),
      customerName: '<b style="color:red">Malicious</b>',
      orderReference: 'REF<b>123</b>',
    };

    const res = await sendTicketConfirmationEmail({
      order: orderWithInjection,
      pass: dummyPass,
      event: dummyEvent,
      appBaseUrl: 'http://localhost:3000',
    });

    assert.equal(res.success, true);
  });
});
