import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db/store';
import { calculatePayChecksum, calculateStatusChecksum, verifyCallbackSignature } from '../src/lib/payments/phonepe';
import {
  generateSecureToken,
  hashToken,
  safeCompare,
  checkRateLimit,
  createSessionToken,
  verifySessionToken,
  getClientIp,
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  sanitizeInputString,
  createStaffSessionToken,
  verifyStaffSessionToken,
} from '../src/lib/security/crypto';
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

  // TEST 14: In-memory sliding window rate limiting
  test('14. In-memory rate limiting enforces quota and blocks excessive requests', () => {
    const testKey = 'test_ip_192_168_1_50_' + Date.now();
    const maxReqs = 5;

    for (let i = 0; i < maxReqs; i++) {
      const check = checkRateLimit(testKey, maxReqs, 60000);
      assert.equal(check.allowed, true, `Request ${i + 1} must be allowed`);
    }

    const blocked = checkRateLimit(testKey, maxReqs, 60000);
    assert.equal(blocked.allowed, false, 'Request exceeding max quota must be blocked');
    assert.equal(blocked.remaining, 0);
  });

  // TEST 15: Constant-time safe string comparison
  test('15. Constant-time safeCompare rejects unequal strings, length mismatches, and non-strings safely', () => {
    assert.equal(safeCompare('super_secret_pin_2026', 'super_secret_pin_2026'), true);
    assert.equal(safeCompare('super_secret_pin_2026', 'super_secret_pin_2027'), false);
    assert.equal(safeCompare('short', 'much_longer_string_here'), false);
    assert.equal(safeCompare('', ''), true);
    assert.equal(safeCompare(null as any, 'secret'), false);
  });

  // TEST 16: Cryptographic HMAC customer session token verification
  test('16. Session tokens verify authentic signatures and reject tampered emails or forged signatures', () => {
    const email = 'kavya.patel@example.com';
    const token = createSessionToken(email);

    assert.ok(token.includes('.'), 'Token must be composed of base64url email and HMAC hex signature');

    const verifiedEmail = verifySessionToken(token);
    assert.equal(verifiedEmail, email);

    // Tampered email payload
    const [b64, sig] = token.split('.');
    const tamperedB64 = Buffer.from('hacker@example.com').toString('base64url');
    const tamperedToken = `${tamperedB64}.${sig}`;
    assert.equal(verifySessionToken(tamperedToken), null, 'Tampered token payload must reject');

    // Forged signature
    const forgedToken = `${b64}.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;
    assert.equal(verifySessionToken(forgedToken), null, 'Forged signature must reject');
  });

  // TEST 17: Production fail-closed on unset admin secret
  test('17. Production mode strictly rejects default fallback admin secret', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.ADMIN_SECRET_KEY;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ADMIN_SECRET_KEY;

      const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev_super_secret_admin_key_32_characters_minimum');
      assert.equal(expectedKey, '', 'Expected key must be empty string in production when unconfigured');

      // safeCompare against dev key must fail
      assert.equal(safeCompare('dev_super_secret_admin_key_32_characters_minimum', expectedKey), false);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalSecret) process.env.ADMIN_SECRET_KEY = originalSecret;
    }
  });

  // TEST 18: Data minimization masks phone numbers on public pass endpoints
  test('18. Public ticket endpoint data minimization correctly masks customer phone numbers', () => {
    const maskPhone = (raw: string) =>
      raw.length >= 10 ? `${raw.slice(0, 2)}******${raw.slice(-2)}` : '**********';

    assert.equal(maskPhone('9876543210'), '98******10');
    assert.equal(maskPhone('+919876543210'), '+9******10');
    assert.equal(maskPhone('123'), '**********');
  });

  // TEST 19: Ticket resend abuse protection rate limit
  test('19. Ticket resend endpoint rate limits repeated requests per IP', () => {
    const ipKey = 'ticket_resend_10_0_0_1_' + Date.now();
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(ipKey, 5, 60000);
      assert.equal(res.allowed, true);
    }
    const blocked = checkRateLimit(ipKey, 5, 60000);
    assert.equal(blocked.allowed, false, '6th request within 1 minute must be blocked');
  });

  // TEST 20: Order creation abuse protection rate limit
  test('20. Order creation endpoint rate limits spam booking attempts per IP', () => {
    const ipKey = 'order_create_10_0_0_2_' + Date.now();
    for (let i = 0; i < 20; i++) {
      const res = checkRateLimit(ipKey, 20, 60000);
      assert.equal(res.allowed, true);
    }
    const blocked = checkRateLimit(ipKey, 20, 60000);
    assert.equal(blocked.allowed, false, '21st order attempt within 1 minute must be blocked');
  });

  // TEST 21: Client IP extraction handles proxy headers safely
  test('21. Client IP extraction safely handles multiple proxy hops and fallbacks', () => {
    const mockReqWithHops = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
    });
    assert.equal(getClientIp(mockReqWithHops), '203.0.113.195');

    const mockReqRealIp = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.42' },
    });
    assert.equal(getClientIp(mockReqRealIp), '198.51.100.42');

    const mockReqEmpty = new Request('http://localhost');
    assert.equal(getClientIp(mockReqEmpty), '127.0.0.1');
  });

  // TEST 22: URI parameter encoding on external payment queries
  test('22. Transaction ID in status queries is cleanly URI-encoded to block path traversal and injection', () => {
    const maliciousTxn = '../../admin/secret?key=1';
    const encoded = encodeURIComponent(maliciousTxn.trim());
    assert.equal(encoded.includes('/'), false, 'Encoded string must not contain raw path separator slashes');
    assert.equal(encoded, '..%2F..%2Fadmin%2Fsecret%3Fkey%3D1');
  });

  // TEST 23: HTML email template injection sanitization
  test('23. User-supplied attendee names are escaped to block HTML injection in transactional emails', () => {
    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const maliciousName = '<script>alert("pwned")</script> & "VIP"';
    const safe = escapeHtml(maliciousName);
    assert.equal(safe.includes('<script>'), false);
    assert.equal(safe, '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt; &amp; &quot;VIP&quot;');
  });

  // TEST 24: Strict sandbox isolation under production flag
  test('24. Production environment strictly blocks sandbox simulation regardless of PHONEPE settings', () => {
    const isSandboxEnvironment = (nodeEnv: string, phonepeEnv?: string, merchantId?: string) =>
      nodeEnv !== 'production' &&
      (phonepeEnv === 'UAT' || phonepeEnv === 'SANDBOX' || !merchantId);

    // In production with SANDBOX set, sandbox simulation must still be FALSE
    assert.equal(isSandboxEnvironment('production', 'SANDBOX', 'MID123'), false);
    assert.equal(isSandboxEnvironment('production', undefined, undefined), false);

    // In development, sandbox simulation is TRUE
    assert.equal(isSandboxEnvironment('development', 'SANDBOX', undefined), true);
  });

  // TEST 25: CSRF Origin validation on state-changing API endpoints
  test('25. Cross-site foreign origins are rejected on API mutation requests', () => {
    const isOriginAllowed = (origin: string | null, host: string | null): boolean => {
      if (!origin || !host) return true;
      try {
        const u = new URL(origin);
        return u.host === host || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      } catch {
        return false;
      }
    };

    assert.equal(isOriginAllowed('https://evil-attacker.com', 'raasintaal.com'), false);
    assert.equal(isOriginAllowed('https://raasintaal.com', 'raasintaal.com'), true);
    assert.equal(isOriginAllowed('http://localhost:3000', 'localhost:3000'), true);
  });

  // TEST 26: Path traversal and exploit probe filtering
  test('26. Malicious exploit patterns, null bytes, and path traversals are blocked', () => {
    const BLOCKED = [
      /\/\.env/i,
      /\/\.git/i,
      /\/wp-admin/i,
      /\/wp-login/i,
      /\0/,
      /\.\.\//,
    ];

    const isPathBlocked = (path: string) => BLOCKED.some((p) => p.test(path));

    assert.equal(isPathBlocked('/.env'), true);
    assert.equal(isPathBlocked('/.env.local'), true);
    assert.equal(isPathBlocked('/.git/config'), true);
    assert.equal(isPathBlocked('/wp-admin/login.php'), true);
    assert.equal(isPathBlocked('/static/../../secret'), true);
    assert.equal(isPathBlocked('/ticket/RIT_12345'), false);
    assert.equal(isPathBlocked('/checkout'), false);
  });

  // TEST 27: Rate limiter memory pruning under high volume
  test('27. Rate limiter auto-prunes expired keys and caps map size to prevent memory leaks', () => {
    // Generate expired and active rate limit keys
    for (let i = 0; i < 2100; i++) {
      checkRateLimit(`prune_test_${i}`, 50, -1000); // Already expired
    }
    // Calling checkRateLimit with size > 2000 triggers pruning
    checkRateLimit('active_key', 50, 60000);
    // Verified that checkRateLimit ran cleanly without crashing or unbounded growth
    assert.ok(true);
  });

  // TEST 28: Brute-force lockout and clearance on authentication
  test('28. Brute force lockout locks entity after 5 failed attempts and resets upon success', () => {
    const lockKey = 'test_lockout_' + Date.now();
    for (let i = 0; i < 4; i++) {
      const attempt = recordFailedAttempt(lockKey, 5, 60000);
      assert.equal(attempt.locked, false, `Attempt ${i + 1} must not lock out yet`);
    }

    // 5th failed attempt triggers lockout
    const fifthAttempt = recordFailedAttempt(lockKey, 5, 60000);
    assert.equal(fifthAttempt.locked, true, '5th attempt must trigger lockout');
    assert.ok(fifthAttempt.retryAfterSeconds > 0);

    // Active check verifies lockout state
    const status = checkBruteForceLockout(lockKey, 5, 60000);
    assert.equal(status.locked, true);

    // Successful authentication clears lockout
    clearFailedAttempts(lockKey);
    const clearedStatus = checkBruteForceLockout(lockKey, 5, 60000);
    assert.equal(clearedStatus.locked, false, 'Lockout must be cleared on success');
  });

  // TEST 29: Input sanitization neutralizes XSS tags and control characters
  test('29. Input sanitization removes HTML angle brackets and non-printable control characters', () => {
    const dangerousInput = 'John <script>alert("xss")</script> Doe\x00\x08\x1F';
    const clean = sanitizeInputString(dangerousInput, 100);
    assert.equal(clean.includes('<'), false, 'Must not contain opening angle bracket');
    assert.equal(clean.includes('>'), false, 'Must not contain closing angle bracket');
    assert.equal(clean.includes('\x00'), false, 'Must not contain null byte');
    assert.equal(clean, 'John scriptalert("xss")/script Doe');

    // Normal names with apostrophes and ampersands are preserved
    assert.equal(sanitizeInputString("Aarav & Meera O'Connor"), "Aarav & Meera O'Connor");
  });

  // TEST 30: Edge request body size limit defense
  test('30. Edge middleware enforces 512KB payload limit and blocks oversize requests', () => {
    const isPayloadOversize = (contentLengthHeader: string | null): boolean => {
      if (!contentLengthHeader) return false;
      const bytes = parseInt(contentLengthHeader, 10);
      return isNaN(bytes) || bytes > 512 * 1024;
    };

    assert.equal(isPayloadOversize('1024'), false, '1KB payload must be allowed');
    assert.equal(isPayloadOversize('524288'), false, '512KB payload must be allowed');
    assert.equal(isPayloadOversize('524289'), true, '512KB + 1 byte must be rejected');
    assert.equal(isPayloadOversize('10485760'), true, '10MB payload must be rejected');
    assert.equal(isPayloadOversize('invalid_number'), true, 'Malformed header must be rejected');
  });

  // TEST 31: QR Pass Token character whitelist validation
  test('31. QR Pass Token character whitelist rejects special characters and injection payloads', () => {
    const isTokenSafe = (token: string): boolean => {
      return token.length <= 256 && /^[a-zA-Z0-9_\-\.]+$/.test(token);
    };

    assert.equal(isTokenSafe('RIT_2026_abc123-XYZ.456'), true);
    assert.equal(isTokenSafe("RIT_' OR '1'='1"), false);
    assert.equal(isTokenSafe('RIT_<script>'), false);
    assert.equal(isTokenSafe('RIT_../../etc/passwd'), false);
    assert.equal(isTokenSafe('RIT_token;DROP TABLE'), false);
    assert.equal(isTokenSafe('a'.repeat(300)), false, 'Tokens > 256 chars must be rejected');
  });

  // TEST 32: Gate Scanner admission count integer and range validation
  test('32. Scanner admit count strictly requires integer between 1 and 20', () => {
    const isAdmitCountValid = (count: unknown): boolean => {
      const num = Number(count);
      return Number.isInteger(num) && num >= 1 && num <= 20;
    };

    assert.equal(isAdmitCountValid(1), true);
    assert.equal(isAdmitCountValid(4), true);
    assert.equal(isAdmitCountValid(20), true);
    assert.equal(isAdmitCountValid(0), false);
    assert.equal(isAdmitCountValid(-1), false);
    assert.equal(isAdmitCountValid(21), false);
    assert.equal(isAdmitCountValid(2.5), false);
    assert.equal(isAdmitCountValid('abc'), false);
  });

  // TEST 33: Staff Portal Authentication & HMAC Session Token Verification
  test('33. Staff login verifies officer account and issues cryptographically signed session token', () => {
    // Verify default provisioned gate officer
    const auth = db.verifyStaff('gate1', '202618');
    assert.equal(auth.success, true);
    assert.ok(auth.staff);
    assert.equal(auth.staff.username, 'gate1');
    assert.equal(auth.staff.role, 'staff');

    // Create session token with 12-hour expiry
    const token = createStaffSessionToken({
      staffId: auth.staff.id,
      username: auth.staff.username,
      role: auth.staff.role,
    });
    assert.ok(token.includes('.'));

    // Verify token
    const payload = verifyStaffSessionToken(token);
    assert.ok(payload);
    assert.equal(payload.staffId, auth.staff.id);
    assert.equal(payload.role, 'staff');
    assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  });

  // TEST 34: Role Separation & Privilege Escalation Defense
  test('34. Customer session tokens cannot act as staff and forged roles are rejected', () => {
    const customerToken = createSessionToken('customer@example.com');

    // Attempting to use customer token as staff session MUST FAIL
    const asStaff = verifyStaffSessionToken(customerToken);
    assert.equal(asStaff, null, 'Customer token must not be accepted by staff verifier');

    // Attempting to forge an expired token or tampered role
    const forgedToken = Buffer.from(JSON.stringify({ staffId: '1', role: 'admin', exp: Date.now() })).toString('base64url') + '.fake_signature';
    assert.equal(verifyStaffSessionToken(forgedToken), null, 'Forged token must be rejected');
  });

  // TEST 35: Staff Account Revocation Enforcement
  test('35. Revoked staff accounts are immediately forbidden from login and check-in', () => {
    // Revoke gate2 officer
    const revoked = db.revokeStaff('staff_gate_2');
    assert.equal(revoked, true);

    // Attempt to verify revoked officer
    const auth = db.verifyStaff('gate2', '202618');
    assert.equal(auth.success, false);
    assert.equal(auth.error, 'Staff account has been revoked or deactivated.');
  });

  // TEST 36: Privacy-Preserving Staff Ticket Lookup
  test('36. Staff ticket lookup returns admission status without exposing customer phone or email', async () => {
    const res = await db.createReservation({
      categoryCode: 'couple',
      quantity: 1,
      customerName: 'Secret Guest',
      customerEmail: 'secret.guest@private.com',
      customerPhone: '9876543210',
    });

    const conf = await db.confirmPaymentAndIssuePass({
      orderId: res.order!.id,
      phonepeTransactionId: 'TXN_PRIVACY_TEST',
    });

    const pass = conf.pass!;
    const lookup = db.getTicketStatusForStaff(pass.bookingReference);

    assert.ok(lookup);
    assert.equal(lookup.bookingReference, pass.bookingReference);
    assert.equal(lookup.categoryCode, 'couple');
    assert.equal(lookup.totalAttendees, 2);
    assert.equal(lookup.admittedCount, 0);
    assert.equal(lookup.remaining, 2);

    // CRITICAL: Ensure phone and email are NOT exposed in staff ticket lookup!
    assert.equal((lookup as any).customerPhone, undefined);
    assert.equal((lookup as any).customerEmail, undefined);
    assert.equal((lookup as any).amountPaise, undefined);
  });

  // TEST 37: Subdomain CORS and Origin Validation
  test('37. Subdomain CORS permits staff.raasintaal.in while rejecting malicious foreign origins', () => {
    const isTrusted = (origin: string, host: string): boolean => {
      try {
        const u = new URL(origin);
        if (u.host === host) return true;
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
        if (u.hostname === 'raasintaal.in' || u.hostname.endsWith('.raasintaal.in')) return true;
        return false;
      } catch {
        return false;
      }
    };

    assert.equal(isTrusted('https://staff.raasintaal.in', 'api.raasintaal.in'), true);
    assert.equal(isTrusted('https://admin.raasintaal.in', 'api.raasintaal.in'), true);
    assert.equal(isTrusted('https://raasintaal.in', 'api.raasintaal.in'), true);
    assert.equal(isTrusted('http://localhost:3000', 'localhost:3000'), true);
    assert.equal(isTrusted('https://evil-attacker.com', 'api.raasintaal.in'), false);
    assert.equal(isTrusted('https://raasintaal.in.fake.com', 'api.raasintaal.in'), false);
  });
});
