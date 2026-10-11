'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { generateQrDataUrl } from '@/lib/qr/generator';
import { Calendar, Clock, MapPin, Sparkles, Printer, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TicketPassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    async function loadPass() {
      try {
        setLoading(true);
        const res = await fetch(`/api/ticket/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.error || 'Invalid or revoked gate pass.');
          return;
        }

        const passData = await res.json();
        setData(passData);

        // Generate QR code data URL
        const qrUrl = await generateQrDataUrl(passData.pass.qrToken);
        setQrCodeUrl(qrUrl);
      } catch (err: any) {
        setError('Network error loading gate pass.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadPass();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="py-24 text-center text-raas-gold">
        <p className="text-sm font-semibold animate-pulse">Rendering official QR Gate Pass...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-950 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-raas-cream">Gate Pass Not Available</h1>
        <p className="text-xs text-raas-cream/70">{error || 'This pass could not be retrieved.'}</p>
        <Link href="/" className="inline-block gold-gradient-btn px-6 py-2.5 rounded-full text-xs font-bold mt-4">
          Return to Homepage
        </Link>
      </div>
    );
  }

  const { pass, order, event } = data;
  const isAllEntered = pass.admittedCount >= pass.totalAttendees;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Top back navigation */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-raas-cream/70 hover:text-raas-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors"
          >
            My Bookings
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-raas-maroon-mid border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-gold shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Pass</span>
          </button>
        </div>
      </div>

      {/* Official Gate Pass Card */}
      <div className="print-card rounded-3xl bg-raas-maroon-mid border-2 border-raas-gold/50 shadow-2xl overflow-hidden">
        {/* Pass Header */}
        <div className="bg-gradient-to-r from-raas-maroon-deep via-raas-maroon-dark to-raas-maroon-deep p-6 text-center border-b border-raas-gold/30 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-raas-maroon-mid border border-raas-gold/30 text-[10px] font-bold text-raas-marigold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Chaos and Chill Presents</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-wide uppercase">
            {event.name} 2026
          </h1>
          <p className="text-xs text-raas-cream/80">
            Official Single Gate Pass • Valid for {pass.totalAttendees} {pass.totalAttendees === 1 ? 'Person' : 'People'}
          </p>
        </div>

        {/* QR Code & Status Box */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-raas-gold/40">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt={`QR Gate Pass for ${pass.bookingReference}`}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-black">
                  Loading QR...
                </div>
              )}
            </div>

            <div className="text-center space-y-1">
              <span className="text-[11px] font-mono tracking-widest text-raas-gold block uppercase font-bold">
                Pass ID: {pass.bookingReference}
              </span>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border">
                {isAllEntered ? (
                  <span className="text-red-400 bg-red-950/60 border-red-500/40 px-2 py-0.5 rounded">
                    ALL ATTENDEES ENTERED ({pass.admittedCount}/{pass.totalAttendees})
                  </span>
                ) : (
                  <span className="text-emerald-400 bg-emerald-950/60 border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VALID PASS • {pass.admittedCount} of {pass.totalAttendees} Admitted</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Booking & Attendee Breakdown */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-raas-maroon-dark/80 border border-raas-gold/20 text-xs">
            <div>
              <span className="text-raas-cream/60 block text-[11px]">Primary Booker</span>
              <span className="font-bold text-raas-cream text-sm">{order.customerName}</span>
            </div>
            <div>
              <span className="text-raas-cream/60 block text-[11px]">Ticket Category</span>
              <span className="font-bold text-raas-gold uppercase text-sm">{pass.categoryCode}</span>
            </div>
            <div>
              <span className="text-raas-cream/60 block text-[11px]">Total Allowed</span>
              <span className="font-bold text-raas-cream">{pass.totalAttendees} Person(s)</span>
            </div>
            <div>
              <span className="text-raas-cream/60 block text-[11px]">Remaining Entries</span>
              <span className="font-bold text-raas-marigold">
                {Math.max(0, pass.totalAttendees - pass.admittedCount)} Remaining
              </span>
            </div>
          </div>

          {/* Event Venue & Time Details */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-raas-maroon-dark/40 border border-raas-gold/20 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-raas-marigold shrink-0" />
              <span className="font-semibold text-raas-cream">Sunday, 18 October 2026</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-raas-marigold shrink-0" />
              <span className="text-raas-cream/90">Durga Puja: 5:30 PM | Dandiya Night: 6:00 PM</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-raas-marigold shrink-0 mt-0.5" />
              <span className="text-raas-cream/90">{event.venue}</span>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="border-t border-raas-gold/20 pt-4 text-[11px] text-raas-cream/70 space-y-1.5">
            <p className="font-bold text-raas-gold">Gate Entry Instructions:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Present this QR code on your phone screen to gate staff for entrance scanning.</li>
              <li>Partial arrivals permitted: members of your party can scan and enter at different times.</li>
              <li>Strictly 1 pass per booking. Do not share your private pass link with untrusted individuals.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
