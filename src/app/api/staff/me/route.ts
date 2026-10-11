import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { verifyStaffSessionToken } from '@/lib/security/crypto';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieToken = req.cookies.get('staff_session')?.value;
    const customToken = req.headers.get('x-staff-token');

    const token = headerToken || cookieToken || customToken;
    if (!token) {
      return NextResponse.json({ authenticated: false, error: 'No staff session token provided' }, { status: 401 });
    }

    const payload = verifyStaffSessionToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false, error: 'Invalid or expired staff session' }, { status: 401 });
    }

    await db.ensureInitialized();
    const staff = db.getStaffById(payload.staffId);
    if (!staff) {
      return NextResponse.json({ authenticated: false, error: 'Staff account no longer exists' }, { status: 401 });
    }

    if (!staff.isActive) {
      return NextResponse.json({ authenticated: false, error: 'Staff account has been revoked' }, { status: 403 });
    }

    return NextResponse.json({
      authenticated: true,
      staff: {
        id: staff.id,
        username: staff.username,
        name: staff.name,
        role: staff.role,
        gateLocation: staff.gateLocation,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: 'Staff verification failed' }, { status: 500 });
  }
}
