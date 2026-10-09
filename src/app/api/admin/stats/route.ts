import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key') || '';
    const expectedKey = process.env.ADMIN_SECRET_KEY || 'dev_super_secret_admin_key_32_characters_minimum';

    if (adminKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
    }

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
