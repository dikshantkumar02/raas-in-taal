import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function inspectDetails() {
  console.log('--- EXISTING CUSTOMERS IN SUPABASE ---');
  const { data: customers, error: custErr } = await adminClient
    .from('customers')
    .select('id, email, name, phone, created_at');
  
  if (custErr) {
    console.error('Error fetching customers:', custErr);
  } else {
    console.log(`Found ${customers?.length} customers:`);
    for (const c of customers || []) {
      console.log(`- ID: ${c.id}, Email: ${c.email}, Name: ${c.name}, Created: ${c.created_at}`);
    }
  }

  console.log('\n--- EXISTING TICKET CATEGORIES IN SUPABASE ---');
  const { data: categories, error: catErr } = await adminClient.from('ticket_categories').select('*');
  console.log(`Found ${categories?.length} categories:`, categories, catErr);

  console.log('\n--- EXISTING ORDERS IN SUPABASE ---');
  const { data: allOrders, error: orderErr } = await adminClient
    .from('orders')
    .select('id, order_reference, category_code, amount_paise, payment_status, customer_email, razorpay_order_id, created_at');

  if (orderErr) {
    console.error('Error on select orders:', orderErr);
  } else {
    console.log(`Found ${allOrders?.length} orders:`, allOrders);
  }

  console.log('\n--- EXISTING PASSES IN SUPABASE ---');
  const { data: allPasses } = await adminClient.from('passes').select('id, order_id, booking_reference, status');
  console.log(`Found ${allPasses?.length} passes:`, allPasses);

  const columnsToCheck = [
    'id',
    'order_reference',
    'category_code',
    'quantity',
    'total_attendees',
    'amount_paise',
    'currency',
    'customer_name',
    'customer_email',
    'customer_phone',
    'customer_id',
    'attendee_details',
    'group_female_verified',
    'payment_status',
    'razorpay_order_id',
    'razorpay_payment_id',
    'phonepe_transaction_id',
    'phonepe_provider_reference',
    'reservation_expires_at',
    'paid_at',
    'created_at',
    'updated_at'
  ];

  for (const col of columnsToCheck) {
    const res = await adminClient.from('orders').select(col).limit(1);
    if (res.error) {
      console.log(`orders.${col}: MISSING (${res.error.message})`);
    } else {
      console.log(`orders.${col}: PRESENT`);
    }
  }

  console.log('\n--- CHECKING PASSES COLUMNS ---');
  const passCols = [
    'id',
    'order_id',
    'booking_reference',
    'qr_token',
    'qr_token_hash',
    'category_code',
    'total_attendees',
    'admitted_count',
    'status',
    'issued_at',
    'created_at',
    'updated_at'
  ];

  for (const col of passCols) {
    const res = await adminClient.from('passes').select(col).limit(1);
    if (res.error) {
      console.log(`passes.${col}: MISSING (${res.error.message})`);
    } else {
      console.log(`passes.${col}: PRESENT`);
    }
  }
}

inspectDetails().catch(console.error);
