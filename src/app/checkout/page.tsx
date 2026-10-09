'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TicketCategoryCode } from '@/lib/db/types';
import { ShieldCheck, AlertCircle, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

const CATEGORY_DATA: Record<
  TicketCategoryCode,
  { name: string; price: number; perTicket: number; description: string; rule?: string }
> = {
  stag_girls: {
    name: 'Stag Girls',
    price: 249,
    perTicket: 1,
    description: 'Entry for 1 female attendee.',
    rule: 'Strictly for female stags only.',
  },
  couple: {
    name: 'Couple',
    price: 449,
    perTicket: 2,
    description: 'Entry pass for 1 couple (2 attendees).',
    rule: 'Valid for 1 couple (Male + Female).',
  },
  group: {
    name: 'Group (4 People)',
    price: 699,
    perTicket: 4,
    description: 'Entry package for 4 people.',
    rule: 'At least 1 female attendee is strictly mandatory.',
  },
  family: {
    name: 'Family (4 Members)',
    price: 699,
    perTicket: 4,
    description: 'Entry package for 4 family members.',
    rule: 'Valid for family members of all age groups.',
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCat = (searchParams.get('category') as TicketCategoryCode) || 'stag_girls';
  const [category, setCategory] = useState<TicketCategoryCode>(
    ['stag_girls', 'couple', 'group', 'family'].includes(initialCat) ? initialCat : 'stag_girls'
  );

  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [groupFemaleVerified, setGroupFemaleVerified] = useState(false);
  const [attendeeNames, setAttendeeNames] = useState<string[]>(['']);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const catInfo = CATEGORY_DATA[category];
  const totalAttendees = catInfo.perTicket * quantity;
  const totalPrice = catInfo.price * quantity;

  // Sync attendee input fields
  useEffect(() => {
    setAttendeeNames((prev) => {
      const arr = [...prev];
      while (arr.length < totalAttendees) arr.push('');
      return arr.slice(0, totalAttendees);
    });
  }, [totalAttendees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (category === 'group' && !groupFemaleVerified) {
      setErrorMessage('Please confirm that at least 1 attendee in your group is female.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        categoryCode: category,
        quantity,
        customerName,
        customerEmail,
        customerPhone,
        groupFemaleVerified: category === 'group' ? groupFemaleVerified : false,
        attendeeDetails: attendeeNames.map((name) => ({ name: name.trim() || customerName })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to place booking');
        setSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        router.push(`/booking/${data.orderReference}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error creating booking order');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold gold-gradient-text">
          Secure Ticket Checkout
        </h1>
        <p className="text-xs sm:text-sm text-raas-cream/70">
          Raas in Taal 2026 • Sunday, 18 Oct 2026 • Khelcity Arena, Jaipur
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Form (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-6">
            {/* Category Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-raas-gold uppercase tracking-wider">
                Select Ticket Category
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(CATEGORY_DATA) as TicketCategoryCode[]).map((code) => {
                  const item = CATEGORY_DATA[code];
                  const isSelected = category === code;
                  return (
                    <button
                      type="button"
                      key={code}
                      onClick={() => setCategory(code)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-raas-gold bg-raas-maroon-light shadow-md'
                          : 'border-raas-gold/20 bg-raas-maroon-dark/60 hover:border-raas-gold/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-raas-cream">{item.name}</span>
                        <span className="text-xs font-bold text-raas-gold">₹{item.price}</span>
                      </div>
                      <span className="text-[10px] text-raas-cream/60 block mt-1">
                        {item.perTicket} {item.perTicket === 1 ? 'Attendee' : 'Attendees'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-raas-maroon-dark/60 border border-raas-gold/20">
              <div>
                <span className="text-xs font-bold text-raas-cream uppercase tracking-wide block">Ticket Quantity</span>
                <span className="text-[11px] text-raas-cream/60">
                  {catInfo.perTicket * quantity} total attendee pass slots
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg bg-raas-maroon-light border border-raas-gold/30 text-raas-gold font-bold hover:bg-raas-maroon-deep"
                >
                  -
                </button>
                <span className="text-base font-bold text-raas-gold w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(5, quantity + 1))}
                  className="w-8 h-8 rounded-lg bg-raas-maroon-light border border-raas-gold/30 text-raas-gold font-bold hover:bg-raas-maroon-deep"
                >
                  +
                </button>
              </div>
            </div>

            {/* Group female confirmation checkbox */}
            {category === 'group' && (
              <div className="p-4 rounded-xl bg-raas-maroon-dark border border-raas-marigold/40 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupFemaleVerified}
                    onChange={(e) => setGroupFemaleVerified(e.target.checked)}
                    className="mt-1 w-4 h-4 text-raas-marigold rounded focus:ring-raas-marigold"
                    required
                  />
                  <span className="text-xs text-raas-cream/90 font-medium leading-relaxed">
                    I confirm that at least one attendee in our 4-person group is female. (Mandatory organizer rule).
                  </span>
                </label>
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-4 pt-2 border-t border-raas-gold/20">
              <h3 className="text-xs font-bold text-raas-gold uppercase tracking-wider">
                Primary Contact Details
              </h3>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-raas-cream/80">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-raas-cream/80">Email Address (Pass Delivery) *</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-raas-cream/80">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
                  />
                </div>
              </div>
            </div>

            {/* Attendee Names */}
            {totalAttendees > 1 && (
              <div className="space-y-3 pt-2 border-t border-raas-gold/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-raas-gold uppercase tracking-wider">
                    Attendee Names ({totalAttendees} people)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: totalAttendees }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Attendee ${i + 1} Name ${i === 0 ? '(Primary)' : ''}`}
                      value={attendeeNames[i] || ''}
                      onChange={(e) => {
                        const next = [...attendeeNames];
                        next[i] = e.target.value;
                        setAttendeeNames(next);
                      }}
                      className="px-3 py-2 rounded-lg bg-raas-maroon-dark/80 border border-raas-gold/20 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
                    />
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 flex items-start gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gold-gradient-btn py-4 rounded-xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Reserving Capacity & Initiating PhonePe...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Pay ₹{totalPrice} via PhonePe</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Summary Box (1 col) */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-5">
            <h2 className="text-sm font-bold text-raas-gold uppercase tracking-wider border-b border-raas-gold/20 pb-3">
              Booking Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-raas-cream/70">Category</span>
                <span className="font-bold text-raas-cream">{catInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-raas-cream/70">Package Quantity</span>
                <span className="font-bold text-raas-cream">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-raas-cream/70">Total Admitted Attendees</span>
                <span className="font-bold text-raas-marigold">{totalAttendees} Persons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-raas-cream/70">Price per unit</span>
                <span className="font-bold text-raas-cream">₹{catInfo.price}</span>
              </div>

              <div className="pt-3 border-t border-raas-gold/20 flex justify-between items-baseline">
                <span className="text-sm font-bold text-raas-cream">Total Amount</span>
                <span className="text-2xl font-extrabold text-raas-gold">₹{totalPrice}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-raas-maroon-dark border border-raas-gold/20 space-y-2 text-[11px] text-raas-cream/70">
              <div className="flex items-center gap-1.5 font-semibold text-raas-gold">
                <ShieldCheck className="w-4 h-4 text-raas-gold" />
                <span>Zero Hidden Fees</span>
              </div>
              <p>Strict 500-attendee limit. Temporary reservation held for 10 minutes upon checkout.</p>
            </div>

            <div className="space-y-1.5 text-[11px] text-raas-cream/60">
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>1 QR Gate Pass per booking</span>
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant email delivery upon payment</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-raas-gold">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
