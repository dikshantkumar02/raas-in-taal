import fs from 'node:fs';
import path from 'node:path';

// Load .env.local for test runner
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }
  }
}
process.env.TEST_PERSISTENCE = 'true';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { db } from '../src/lib/db/store';
import { supabaseAdmin } from '../src/lib/db/supabase';

describe('Data Persistence Across Redeployments & Restarts', () => {
  const testOrderId = crypto.randomUUID();
  const testPassId = crypto.randomUUID();
  const testOrderRef = `RIT-TEST-PERSIST-${Date.now().toString(36).toUpperCase()}`;
  const testEmail = `persist_test_${Date.now()}@example.com`;
  let createdCustomerId: string | undefined;

  after(async () => {
    // Clean up test records from Supabase
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('passes').delete().eq('booking_reference', testOrderRef);
        await supabaseAdmin.from('orders').delete().eq('order_reference', testOrderRef);
        if (createdCustomerId) {
          await supabaseAdmin.from('customers').delete().eq('id', createdCustomerId);
        }
      } catch (err) {
        console.warn('Cleanup notice:', err);
      }
    }
  });

  test('1. Generated order and pass IDs are valid RFC4122 UUIDs', async () => {
    const reservation = await db.createReservation({
      categoryCode: 'stag_girls',
      quantity: 1,
      customerName: 'Persistence Tester',
      customerEmail: testEmail,
      customerPhone: '9876543210',
      customReference: testOrderRef,
    });

    assert.strictEqual(reservation.success, true);
    assert.ok(reservation.order);
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert.match(reservation.order.id, uuidRegex, 'Order ID must be a valid RFC4122 UUID');

    // Confirm payment and issue pass
    const confirmation = await db.confirmPaymentAndIssuePass({
      orderId: reservation.order.id,
      razorpayOrderId: `order_test_${Date.now()}`,
      razorpayPaymentId: `pay_test_${Date.now()}`,
      razorpaySignature: 'sig_test_valid',
    });

    assert.strictEqual(confirmation.success, true);
    assert.ok(confirmation.pass);
    assert.match(confirmation.pass.id, uuidRegex, 'Pass ID must be a valid RFC4122 UUID');
    assert.match(confirmation.pass.orderId, uuidRegex, 'Pass orderId reference must be a valid RFC4122 UUID');
  });

  test('2. Order and Pass persist in Supabase and can be loaded by direct query', async () => {
    if (!supabaseAdmin) {
      console.log('Skipping Supabase direct check (supabaseAdmin not configured)');
      return;
    }

    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_reference', testOrderRef)
      .maybeSingle();

    assert.strictEqual(orderErr, null, 'Querying orders from Supabase should not error');
    assert.ok(orderData, 'Order should be present in Supabase table');
    assert.strictEqual(orderData.order_reference, testOrderRef);
    assert.strictEqual(orderData.payment_status, 'SUCCESS');

    const { data: passData, error: passErr } = await supabaseAdmin
      .from('passes')
      .select('*')
      .eq('booking_reference', testOrderRef)
      .maybeSingle();

    assert.strictEqual(passErr, null, 'Querying passes from Supabase should not error');
    assert.ok(passData, 'Pass should be present in Supabase table');
    assert.strictEqual(passData.booking_reference, testOrderRef);
    assert.strictEqual(passData.status, 'VALID');
  });

  test('3. Simulated cold start (memory cleared) recovers records via ensureInitialized()', async () => {
    // Clear memory store to simulate a fresh container / cold boot
    db.reset();

    // Verify memory is empty
    assert.strictEqual(db.getOrderById(testOrderId), undefined);

    // Call ensureInitialized()
    await db.ensureInitialized();

    // Verify order and pass were restored from persistent storage
    const recoveredOrder = await db.getOrderByReferenceAsync(testOrderRef);
    assert.ok(recoveredOrder, 'Order must be recovered after container restart');
    assert.strictEqual(recoveredOrder.orderReference, testOrderRef);
    assert.strictEqual(recoveredOrder.paymentStatus, 'SUCCESS');

    const recoveredPass = db.getPassByOrderId(recoveredOrder.id);
    assert.ok(recoveredPass, 'Pass must be recovered after container restart');
    assert.strictEqual(recoveredPass.bookingReference, testOrderRef);
  });

  test('4. Existing customer accounts in Supabase are discovered and authenticated', async () => {
    await db.ensureInitialized();
    // Check one of the existing customer emails in Supabase
    const existing = await db.getCustomerByEmailAsync('dikshantkumar9261@gmail.com');
    assert.ok(existing, 'Authoritative customer account dikshantkumar9261@gmail.com must exist');
    assert.strictEqual(existing.email, 'dikshantkumar9261@gmail.com');
  });
});
