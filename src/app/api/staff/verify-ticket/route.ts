import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { verifyStaffSessionToken, safeCompare, checkRateLimit, getClientIp } from '@/lib/security/crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`staff_lookup_${ip}`, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many lookup requests. Please wait a moment.' }, { status: 429 });
    }

    // Authenticate staff via token or pin
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieToken = req.cookies.get('staff_session')?.value;
    const customToken = req.headers.get('x-staff-token');
    const pin = req.headers.get('x-staff-pin');

    await db.ensureInitialized();
    let isAuthorized = false;
    const token = headerToken || cookieToken || customToken;

    if (token) {
      const payload = verifyStaffSessionToken(token);
      if (payload) {
        const staff = db.getStaffById(payload.staffId);
        if (staff && staff.isActive) {
          isAuthorized = true;
        }
      }
    } else if (pin) {
      const expectedPin = process.env.STAFF_PIN || '202618';
      if (safeCompare(pin, expectedPin)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid staff session or PIN required to lookup tickets.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length > 256) {
      return NextResponse.json({ error: 'Valid pass token or booking reference required.' }, { status: 400 });
    }

    const cleanQuery = decodeURIComponent(query.trim().replace(/^.*\/ticket\//, '').split('?')[0]);
    const lookup = db.getTicketStatusForStaff(cleanQuery);

    if (!lookup) {
      return NextResponse.json(
        { found: false, error: 'NO_TICKET_FOUND', message: 'No valid ticket found matching this reference or QR code.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      ticket: lookup,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Ticket verification query failed.' }, { status: 500 });
  }
}
