'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Clock, QrCode, Download, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderReference } = use(params);
  const searchParams = useSearchParams();
  const txn = searchParams.get('txn') || '';
  const isSandboxMode = searchParams.get('mode') === 'sandbox' || Boolean(txn);

  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | 'RESERVED'>('PENDING');
  const [passData, setPassData] = useState<{
    qrToken: string;
    categoryCode: string;
    totalAttendees: number;
    admittedCount: number;
    status: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  const verifyPayment = async (simulate = false) => {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          transactionId: txn,
          simulateSuccess: simulate,
        }),
      });

      const data = await res.json();
      if (data.success && data.paymentStatus === 'SUCCESS') {
        setOrderStatus('SUCCESS');
        setPassData(data.pass);
      } else {
        setOrderStatus(data.paymentStatus || 'PENDING');
        setMessage(data.message || 'Waiting for payment confirmation...');
      }
    } catch (err: any) {
      setMessage('Failed to verify status. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment(false);
  }, [orderReference, txn]);

  const handleResendEmail = async () => {
    const userEmail = prompt('Please re-enter your booking email address:');
    if (!userEmail) return;

    setResendingEmail(true);
    setEmailStatus('');
    try {
      const res = await fetch('/api/tickets/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: orderReference,
          email: userEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailStatus('Gate Pass email resent successfully!');
      } else {
        setEmailStatus(data.error || 'Failed to resend email.');
      }
    } catch {
      setEmailStatus('Network error resending email.');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-extrabold gold-gradient-text">Booking Status</h1>
        <p className="text-xs text-raas-cream/70 font-mono tracking-wider">
          Reference: {orderReference}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-4">
          <Loader2 className="w-8 h-8 text-raas-gold animate-spin mx-auto" />
          <p className="text-sm text-raas-cream font-medium">Verifying payment status with PhonePe...</p>
        </div>
      ) : orderStatus === 'SUCCESS' ? (
        <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/40 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Payment Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-raas-cream">
              You&apos;re Going to Raas in Taal!
            </h2>
            <p className="text-xs text-raas-cream/70 max-w-md mx-auto pt-1">
              Your official QR Gate Pass has been issued and sent to your email. You can view, download, or present it directly on your mobile.
            </p>
          </div>

          {passData && (
            <div className="p-5 rounded-2xl bg-raas-maroon-dark border border-raas-gold/20 text-left space-y-3 max-w-md mx-auto">
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Category:</span>
                <span className="font-bold text-raas-gold uppercase">{passData.categoryCode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Total Admitted Attendees:</span>
                <span className="font-bold text-raas-cream">{passData.totalAttendees} Person(s)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Admitted At Gate So Far:</span>
                <span className="font-bold text-raas-marigold">{passData.admittedCount} of {passData.totalAttendees}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Pass Status:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  {passData.status}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {passData?.qrToken && (
              <Link
                href={`/ticket/${encodeURIComponent(passData.qrToken)}`}
                className="w-full sm:w-auto gold-gradient-btn px-6 py-3.5 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>View & Download QR Gate Pass</span>
              </Link>
            )}

            <button
              onClick={handleResendEmail}
              disabled={resendingEmail}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4 text-raas-marigold" />
              <span>{resendingEmail ? 'Resending...' : 'Resend Email Pass'}</span>
            </button>
          </div>

          {emailStatus && (
            <p className="text-xs text-raas-gold pt-2 font-medium">{emailStatus}</p>
          )}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-raas-marigold/20 text-raas-marigold flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-raas-cream">Payment In Progress / Pending</h2>
            <p className="text-xs text-raas-cream/70 max-w-md mx-auto">
              {message || 'Your reservation is being held. Please complete the PhonePe transaction to receive your gate pass.'}
            </p>
          </div>

          {/* Sandbox Test Action Helper */}
          {isSandboxMode && (
            <div className="p-4 rounded-2xl bg-raas-maroon-dark border border-raas-gold/30 max-w-md mx-auto space-y-3">
              <span className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                PhonePe UAT Sandbox Testing
              </span>
              <p className="text-[11px] text-raas-cream/70">
                You are testing in PhonePe Sandbox mode. Click below to simulate PhonePe verified payment capture:
              </p>
              <button
                onClick={() => verifyPayment(true)}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Successful UAT Payment Capture</span>
              </button>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => verifyPayment(false)}
              className="gold-gradient-btn px-6 py-2.5 rounded-xl text-xs font-bold"
            >
              Check Status Again
            </button>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs font-bold text-raas-cream"
            >
              Back to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
