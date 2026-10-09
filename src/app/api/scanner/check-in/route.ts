import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const authPin = req.headers.get('x-staff-pin') || '';
    const expectedPin = process.env.STAFF_PIN || '202618';

    // Strict staff authorization check
    if (authPin !== expectedPin) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED_STAFF', message: 'Unauthorized staff access. Please enter valid Staff PIN.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { token, staffId, staffName, admitCount } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'MISSING_TOKEN', message: 'No QR pass token provided.' },
        { status: 400 }
      );
    }

    const count = Number(admitCount) || 1;
    if (count < 1) {
      return NextResponse.json(
        { success: false, error: 'INVALID_COUNT', message: 'Admit count must be at least 1.' },
        { status: 400 }
      );
    }

    const checkInResult = await db.recordCheckIn({
      tokenOrHash: token.trim(),
      staffId: staffId || 'GATE_STAFF_1',
      staffName: staffName || 'Gate Officer',
      admitCount: count,
    });

    if (!checkInResult.success) {
      return NextResponse.json(checkInResult, { status: 400 });
    }

    return NextResponse.json(checkInResult, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Check-in server verification failed. Fail closed.' },
      { status: 500 }
    );
  }
}
