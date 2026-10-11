'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, QrCode, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function MyTicketsPage() {
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketData, setTicketData] = useState<any>(null);
  const [resendStatus, setResendStatus] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTicketData(null);
    setResendStatus('');
    setLoading(true);

    try {
      const res = await fetch('/api/tickets/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: bookingRef.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Booking not found or email does not match.');
      } else {
        setResendStatus('Verified! Pass resent to email. Redirecting to pass...');
        // Also fetch direct booking status
        window.location.href = `/booking/${encodeURIComponent(bookingRef.trim().toUpperCase())}`;
      }
    } catch {
      setError('Network error locating booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/40 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-raas-gold/20 text-raas-gold flex items-center justify-center mx-auto">
          <QrCode className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold gold-gradient-text uppercase">Find My Gate Pass</h1>
          <p className="text-xs text-raas-cream/70">
            Enter your booking reference to access your QR gate pass.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-raas-cream/80">Booking Reference</label>
            <input
              type="text"
              required
              placeholder="e.g. RIT-2026-AB12CD"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream uppercase tracking-wider focus:outline-none focus:border-raas-gold"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-raas-cream/80">Registered Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resendStatus && (
            <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500/40 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{resendStatus}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gold-gradient-btn py-3.5 rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Verifying Booking...' : 'Access Gate Pass'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-raas-gold/20 text-center space-y-1">
          <p className="text-xs text-raas-cream/70">
            Have an account or want to view all your passes?
          </p>
          <Link
            href="/account"
            className="text-xs text-amber-300 font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Open Attendee Dashboard &amp; Booking History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
