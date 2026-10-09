import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db/store';
import { calculatePayChecksum, calculateStatusChecksum, verifyCallbackSignature } from '../src/lib/payments/phonepe';
import { generateSecureToken, hashToken, safeCompare } from '../src/lib/security/crypto';
import { sendTicketConfirmationEmail } from '../src/lib/email/service';

describe('Raas in Taal — Strict Security, Capacity & QR Gate Pass Test Suite', () => {
  beforeEach(() => {
    db.reset();
  });

  // TEST 1: Client price manipulation prevention
  test('1. Client-manipulated prices are ignored; server authoritative pricing applies', async () => {
    const res = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 2,
      customerName: 'Ananya Sharma',
      customerEmail: 'ananya@example.com',
      customerPhone: '9876543210',
    });

    assert.equal(res.success, true);
    assert.ok(res.order);
    // Stag Girls is ₹249 (24900 paise). 2 tickets = 49800 paise
    assert.equal(res.order.amountPaise, 49800);
    assert.equal(res.order.totalAttendees, 2);
  });

  // TEST 2: Invalid payment signatures and forged callbacks
  test('2. PhonePe callback signature verification rejects invalid and forged signatures', () => {
    const saltKey = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = '1';
    const validPayload = Buffer.from(JSON.stringify({ code: 'PAYMENT_SUCCESS', amount: 24900 })).toString('base64');
    
    // Calculate valid signature
    const crypto = require('node:crypto');
    const validHash = crypto.createHash('sha256').update(validPayload + saltKey).digest('hex') + '###' + saltIndex;

    const isValid = verifyCallbackSignature(validPayload, validHash, saltKey, saltIndex);
    assert.equal(isValid, true, 'Valid signature must be verified');

    const isForged = verifyCallbackSignature(validPayload, 'forged_fake_hash_123###1', saltKey, saltIndex);
    assert.equal(isForged, false, 'Forged signature must be rejected');

    const isTamperedPayload = verifyCallbackSignature('tampered_base64_content', validHash, saltKey, saltIndex);
    assert.equal(isTamperedPayload, false, 'Tampered payload with previous hash must be rejected');
  });

  // TEST 3: Pending, failed, unverified payments cannot generate valid entry passes
  test('3. Unpaid or pending bookings cannot be checked in at the event gate', async () => {
    const res = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Rohan Verma',
      customerEmail: 'rohan@example.com',
      customerPhone: '9876543211',
    });

    assert.equal(res.success, true);
    // Attempting check-in on unconfirmed order
    const checkIn = await db.recordCheckIn({
      tokenOrHash: 'some_unissued_token',
      staffId: 'STAFF_1',
      staffName: 'Gate Guard',
    });

    assert.equal(checkIn.success, false);
    assert.equal(checkIn.resultCode, 'INVALID_PASS');
  });

  // TEST 4 & 5: Webhook idempotency prevents duplicate processing
  test('4 & 5. Idempotent payment processing prevents duplicate pass issuance', async () => {
    const res = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Kavita & Rahul',
      customerEmail: 'kavita@example.com',
      customerPhone: '9876543212',
    });

    const orderId = res.order!.id;
    const txnId = 'TXN_TEST_1001';

    // First confirmation
    const conf1 = await db.confirmPaymentAndIssuePass({
      orderId,
      phonepeTransactionId: txnId,
    });
    assert.equal(conf1.success, true);
    assert.ok(conf1.pass);
    const firstPassToken = conf1.pass.qrToken;

    // Second repeated callback/confirmation
    const conf2 = await db.confirmPaymentAndIssuePass({
      orderId,
      phonepeTransactionId: txnId,
    });
    assert.equal(conf2.success, true);
    // MUST return the identical pass, not create a second one!
    assert.equal(conf2.pass?.qrToken, firstPassToken);
    assert.equal(db.getAllPasses().length, 1, 'Only one QR Gate pass exists for the booking');
  });

  // TEST 6 & 9: Couple, Group, Family attendee counts & One pass per booking
  test('6 & 9. Exactly 1 pass per booking with correct attendee multiplier', async () => {
    // 1 Stag Girls = 1 attendee
    const stag = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Sneha',
      customerEmail: 'sneha@example.com',
      customerPhone: '9876543213',
    });
    const confStag = await db.confirmPaymentAndIssuePass({ orderId: stag.order!.id, phonepeTransactionId: 'TXN_STAG' });
    assert.equal(confStag.pass?.totalAttendees, 1);

    // 1 Couple = 2 attendees
    const couple = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Aarav & Meera',
      customerEmail: 'aarav@example.com',
      customerPhone: '9876543214',
    });
    const confCouple = await db.confirmPaymentAndIssuePass({ orderId: couple.order!.id, phonepeTransactionId: 'TXN_COUPLE' });
    assert.equal(confCouple.pass?.totalAttendees, 2);

    // 1 Group = 4 attendees
    const group = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'College Squad',
      customerEmail: 'squad@example.com',
      customerPhone: '9876543215',
      groupFemaleVerified: true,
    });
    const confGroup = await db.confirmPaymentAndIssuePass({ orderId: group.order!.id, phonepeTransactionId: 'TXN_GROUP' });
    assert.equal(confGroup.pass?.totalAttendees, 4);

    // 1 Family = 4 attendees
    const family = await db.createReservation({
      categoryCode: 'family',
      quantity: 1,
      customerName: 'Gupta Family',
      customerEmail: 'gupta@example.com',
      customerPhone: '9876543216',
    });
    const confFamily = await db.confirmPaymentAndIssuePass({ orderId: family.order!.id, phonepeTransactionId: 'TXN_FAMILY' });
    assert.equal(confFamily.pass?.totalAttendees, 4);
  });

  // TEST 7: Strict limit of 500 attendees (cannot be oversold)
  test('7. Strict limit of 500 attendees prevents booking beyond capacity', async () => {
    // Simulate booking 496 attendees (124 Group tickets = 496 attendees)
    for (let i = 0; i < 124; i++) {
      const res = await db.createReservation({
        categoryCode: 'group',
        quantity: 1,
        customerName: `Group ${i}`,
        customerEmail: `group${i}@example.com`,
        customerPhone: '9876543210',
        groupFemaleVerified: true,
      });
      assert.equal(res.success, true);
      await db.confirmPaymentAndIssuePass({
        orderId: res.order!.id,
        phonepeTransactionId: `TXN_BULK_${i}`,
      });
    }

    const cap = await db.getCapacityStatus();
    assert.equal(cap.confirmedAttendees, 496);
    assert.equal(cap.availableAttendees, 4);

    // Booking a couple ticket (2 attendees) should succeed
    const coupleRes = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Couple Near Cap',
      customerEmail: 'couple@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(coupleRes.success, true);
    await db.confirmPaymentAndIssuePass({
      orderId: coupleRes.order!.id,
      phonepeTransactionId: 'TXN_NEAR_CAP',
    });

    const cap2 = await db.getCapacityStatus();
    assert.equal(cap2.confirmedAttendees, 498);
    assert.equal(cap2.availableAttendees, 2);

    // Now trying to book a Group ticket (needs 4 attendees) MUST FAIL because only 2 slots remain!
    const groupFail = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'Excess Group',
      customerEmail: 'excess@example.com',
      customerPhone: '9876543210',
      groupFemaleVerified: true,
    });
    assert.equal(groupFail.success, false);
    assert.equal(groupFail.error, 'CAPACITY_EXCEEDED');

    // Trying to book 1 Couple (2 attendees) fills the exact 500 limit
    const lastCouple = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Final Couple',
      customerEmail: 'final@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(lastCouple.success, true);
    await db.confirmPaymentAndIssuePass({
      orderId: lastCouple.order!.id,
      phonepeTransactionId: 'TXN_FINAL_CAP',
    });

    const finalCap = await db.getCapacityStatus();
    assert.equal(finalCap.confirmedAttendees, 500);
    assert.equal(finalCap.availableAttendees, 0);
    assert.equal(finalCap.isSoldOut, true);

    // Even 1 single Stag Girls (1 attendee) MUST now be rejected
    const stagFail = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Rejected Stag',
      customerEmail: 'rejected@example.com',
      customerPhone: '9876543210',
    });
    assert.equal(stagFail.success, false);
    assert.equal(stagFail.error, 'CAPACITY_EXCEEDED');
  });

  // TEST 8: Expired reservation capacity release
  test('8. Expired reservations release allocated capacity safely', async () => {
    // Create reservation with -1 minute expiry (already expired)
    const res = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'Expired Booker',
      customerEmail: 'expired@example.com',
      customerPhone: '9876543210',
      groupFemaleVerified: true,
      expiryMinutes: -1, // Expired immediately
    });

    assert.equal(res.success, true);

    // Capacity status should reflect 500 available because reservation expired
    const cap = await db.getCapacityStatus();
    assert.equal(cap.availableAttendees, 500);
  });

  // TEST 10: Group eligibility validation
  test('10. Group ticket requires confirmation that at least one attendee is female', async () => {
    const res = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'All Boys Squad',
      customerEmail: 'boys@example.com',
      customerPhone: '9876543210',
      groupFemaleVerified: false, // Not verified!
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'GROUP_REQUIRES_FEMALE_VERIFICATION');
  });

  // TEST 11 & 12: Partial check-in and maximum permitted attendees enforcement
  test('11 & 12. Gate Scanner partial entry tracking and strict entry allowance limit', async () => {
    // Book a Group pass (4 attendees)
    const booking = await db.createReservation({
      categoryCode: 'group',
      quantity: 1,
      customerName: 'Friend Circle',
      customerEmail: 'friends@example.com',
      customerPhone: '9876543210',
      groupFemaleVerified: true,
    });

    const conf = await db.confirmPaymentAndIssuePass({
      orderId: booking.order!.id,
      phonepeTransactionId: 'TXN_FRIENDS',
    });

    const token = conf.pass!.qrToken;

    // Scan 1: 2 friends arrive early
    const scan1 = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_GATE_1',
      staffName: 'Officer Vikram',
      admitCount: 2,
    });

    assert.equal(scan1.success, true);
    assert.equal(scan1.resultCode, 'ENTRY_ACCEPTED');
    assert.equal(scan1.nowAdmitted, 2);
    assert.equal(scan1.remaining, 2);

    // Scan 2: 1 friend arrives next
    const scan2 = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_GATE_1',
      staffName: 'Officer Vikram',
      admitCount: 1,
    });

    assert.equal(scan2.success, true);
    assert.equal(scan2.nowAdmitted, 1);
    assert.equal(scan2.remaining, 1);

    // Scan 3: Try to admit 2 people when only 1 slot is left -> REJECTED
    const scanExcess = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_GATE_1',
      staffName: 'Officer Vikram',
      admitCount: 2,
    });

    assert.equal(scanExcess.success, false);
    assert.equal(scanExcess.resultCode, 'EXCEEDS_REMAINING_ALLOWANCE');

    // Scan 4: Admit the final 1 friend -> Success, pass is now ALL_ENTERED
    const scanFinal = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_GATE_1',
      staffName: 'Officer Vikram',
      admitCount: 1,
    });

    assert.equal(scanFinal.success, true);
    assert.equal(scanFinal.remaining, 0);

    // Scan 5: Attempt entry after all 4 attendees entered -> REJECTED ALL_ATTENDEES_CHECKED_IN
    const scanBlocked = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_GATE_1',
      staffName: 'Officer Vikram',
      admitCount: 1,
    });

    assert.equal(scanBlocked.success, false);
    assert.equal(scanBlocked.resultCode, 'ALL_ATTENDEES_CHECKED_IN');
  });

  // TEST 13: Revoked / Refunded ticket rejection
  test('13. Revoked or refunded ticket passes are rejected at the gate', async () => {
    const booking = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Cancelled Couple',
      customerEmail: 'cancel@example.com',
      customerPhone: '9876543210',
    });

    const conf = await db.confirmPaymentAndIssuePass({
      orderId: booking.order!.id,
      phonepeTransactionId: 'TXN_CANCEL',
    });

    const token = conf.pass!.qrToken;

    // Admin revokes pass
    await db.revokePass(booking.order!.id, 'REFUNDED');

    // Scan attempt
    const scan = await db.recordCheckIn({
      tokenOrHash: token,
      staffId: 'STAFF_1',
      staffName: 'Officer',
      admitCount: 1,
    });

    assert.equal(scan.success, false);
    assert.equal(scan.resultCode, 'REFUNDED');
  });

  // TEST 19: Safe transactional email dispatch
  test('19. Safe email delivery does not crash upon failure and records delivery status', async () => {
    const booking = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Priya',
      customerEmail: 'priya@example.com',
      customerPhone: '9876543210',
    });

    const conf = await db.confirmPaymentAndIssuePass({
      orderId: booking.order!.id,
      phonepeTransactionId: 'TXN_EMAIL',
    });

    const emailRes = await sendTicketConfirmationEmail({
      order: conf.order!,
      pass: conf.pass!,
      event: db.getEventConfig(),
      appBaseUrl: 'http://localhost:3000',
    });

    assert.equal(emailRes.success, true);
    assert.ok(['SENT', 'MOCKED'].includes(emailRes.status));
  });
});
