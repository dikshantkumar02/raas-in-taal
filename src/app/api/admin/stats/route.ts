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

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`admin_stats_${ip}`, 60, 60000);
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

    await db.ensureInitialized(true);

    const capacity = await db.getCapacityStatus();
    const event = db.getEventConfig();
    const categories = db.getTicketCategories();
    const orders = db.getAllOrders();
    const passes = db.getAllPasses();
    const checkIns = db.getCheckIns();

    // Compute sales statistics
    let totalSalesPaise = 0;
    const salesByCategory: Record<string, { count: number; attendees: number; salesPaise: number }> = {};

    for (const cat of categories) {
      salesByCategory[cat.code] = { count: 0, attendees: 0, salesPaise: 0 };
    }

    for (const order of orders) {
      if (order.paymentStatus === 'SUCCESS') {
        totalSalesPaise += order.amountPaise;
        if (salesByCategory[order.categoryCode]) {
          salesByCategory[order.categoryCode].count += order.quantity;
          salesByCategory[order.categoryCode].attendees += order.totalAttendees;
          salesByCategory[order.categoryCode].salesPaise += order.amountPaise;
        }
      }
    }

    return NextResponse.json({
      capacity,
      event,
      categories,
      orders,
      passes,
      checkIns,
      totalSalesPaise,
      salesByCategory,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal admin error' }, { status: 500 });
  }
}
