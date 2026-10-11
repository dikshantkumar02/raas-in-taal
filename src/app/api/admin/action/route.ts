import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import {
  safeCompare,
  checkRateLimit,
  getClientIp,
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`admin_action_${ip}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    const adminLockoutKey = `admin_fail_${ip}`;
    const adminLockout = checkBruteForceLockout(adminLockoutKey, 5, 15 * 60 * 1000);
    if (adminLockout.locked) {
      return NextResponse.json(
        { error: `Admin access temporarily locked due to repeated invalid attempts. Try again in ${adminLockout.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const adminKey = req.headers.get('x-admin-key') || '';
    const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev_super_secret_admin_key_32_characters_minimum');

    if (!expectedKey || !safeCompare(adminKey, expectedKey)) {
      recordFailedAttempt(adminLockoutKey, 5, 15 * 60 * 1000);
      return NextResponse.json({ error: 'Unauthorized: Invalid or unconfigured Admin Secret Key' }, { status: 401 });
    }

    clearFailedAttempts(adminLockoutKey);
    await db.ensureInitialized();

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'REVOKE_TICKET') {
      const { orderId, reason } = payload;
      if (!orderId) {
        return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
      }
      await db.revokePass(orderId, reason || 'REVOKED');
      return NextResponse.json({ success: true, message: `Ticket order ${orderId} has been revoked.` });
    }

    if (action === 'UPDATE_EVENT_CONFIG') {
      const updated = db.updateEventConfig(payload);
      return NextResponse.json({ success: true, event: updated });
    }

    return NextResponse.json({ error: 'Unknown admin action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal admin error' }, { status: 500 });
  }
}
