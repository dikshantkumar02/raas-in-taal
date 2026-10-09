import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key') || '';
    const expectedKey = process.env.ADMIN_SECRET_KEY || 'dev_super_secret_admin_key_32_characters_minimum';

    if (adminKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Secret Key' }, { status: 401 });
    }

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
