'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { TicketCategoryCode } from '@/lib/db/types';
import {
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Lock,
  User,
  Mail,
  Phone,
  KeyRound,
  LogOut,
  CreditCard,
} from 'lucide-react';

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const CATEGORY_DATA: Record<
  TicketCategoryCode,
  { name: string; price: number; perTicket: number; description: string; rule?: string; color: string }
> = {
  stag_girls: {
    name: 'Stag Girls',
    price: 249,
    perTicket: 1,
    description: 'Entry for 1 female attendee.',
    rule: 'Strictly for female stags only.',
    color: 'pink',
  },
  couple: {
    name: 'Couple',
    price: 449,
    perTicket: 2,
    description: 'Entry pass for 1 couple (2 attendees).',
    rule: 'Valid for 1 couple (Male + Female).',
    color: 'amber',
  },
  group: {
    name: 'Group (4 People)',
    price: 699,
    perTicket: 4,
    description: 'Entry package for 4 people.',
    rule: 'At least 1 female attendee is strictly mandatory.',
    color: 'purple',
  },
  family: {
    name: 'Family (4 Members)',
    price: 699,
    perTicket: 4,
    description: 'Entry package for 4 family members.',
    rule: 'Valid for family members of all age groups.',
    color: 'teal',
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

  // Authentication State (Optional pre-fill from logged-in account)
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const catInfo = CATEGORY_DATA[category];
  const totalAttendees = catInfo.perTicket * quantity;
  const totalPrice = catInfo.price * quantity;

  // Check customer session quietly in background without blocking the UI
  const verifySession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.customer) {
          setCustomerUser(data.customer);
          setCustomerName((prev) => prev || data.customer.name);
          setCustomerEmail((prev) => prev || data.customer.email);
          setCustomerPhone((prev) => prev || data.customer.phone);
        }
      }
    } catch {}
  };

  useEffect(() => {
    verifySession();
    // Preload Razorpay checkout script early on mount
    if (typeof window !== 'undefined' && !(window as any).Razorpay) {
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, []);

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

    const finalName = (customerName || customerUser?.name || '').trim();
    const finalEmail = (customerEmail || customerUser?.email || '').trim();
    const finalPhone = (customerPhone || customerUser?.phone || '').trim();

    if (!finalName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!finalEmail || !finalEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address for your QR pass delivery.');
      return;
    }
    const cleanPh = finalPhone.replace(/\D/g, '');
    if (cleanPh.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (category === 'group' && !groupFemaleVerified) {
      setErrorMessage('Please confirm that at least 1 attendee in your group is female.');
      return;
    }

    setSubmitting(true);

    try {
      // Helper to ensure Razorpay checkout script is loaded
      const ensureRazorpayLoaded = async (): Promise<boolean> => {
        if (typeof window !== 'undefined' && (window as any).Razorpay) return true;

        return new Promise((resolve) => {
          let resolved = false;

          const check = () => {
            if (typeof window !== 'undefined' && (window as any).Razorpay) {
              if (!resolved) {
                resolved = true;
                resolve(true);
              }
              return true;
            }
            return false;
          };

          if (check()) return;

          let script = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
          ) as HTMLScriptElement;

          if (!script) {
            script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
          }

          script.addEventListener('load', () => {
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(Boolean((window as any).Razorpay));
              }
            }, 100);
          });

          script.addEventListener('error', () => {
            if (!resolved) {
              resolved = true;
              resolve(false);
            }
          });

          const interval = setInterval(() => {
            if (check()) {
              clearInterval(interval);
            }
          }, 150);

          setTimeout(() => {
            clearInterval(interval);
            if (!resolved) {
              resolved = true;
              resolve(Boolean((window as any).Razorpay));
            }
          }, 8000);
        });
      };

      const isLoaded = await ensureRazorpayLoaded();
      if (!isLoaded || !(window as any).Razorpay) {
        setErrorMessage('Unable to load Razorpay payment gateway. Please check your internet connection or disable adblockers on this page.');
        setSubmitting(false);
        return;
      }

      // Step 1: Call Backend to create order
      const payload = {
        amount: totalPrice * 100, // paise (minimum 100 paise)
        currency: 'INR',
        categoryCode: category,
        quantity,
        customerName: finalName,
        customerEmail: finalEmail,
        customerPhone: finalPhone,
        groupFemaleVerified: category === 'group' ? groupFemaleVerified : false,
        attendeeDetails: attendeeNames.map((name, idx) => ({
          name: name.trim() || (idx === 0 ? finalName : `Attendee ${idx + 1}`),
        })),
      };

      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.order_id) {
        setErrorMessage(data.error || 'Failed to initialize payment order');
        setSubmitting(false);
        return;
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TmZ25PPym09aUr';

      // Step 2: Open Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Raas in Taal 2026',
        description: `${catInfo.name} Ticket (${quantity} pkg, ${totalAttendees} passes)`,
        order_id: data.order_id,
        prefill: {
          name: finalName,
          email: finalEmail,
          contact: cleanPh,
        },
        notes: {
          orderReference: data.orderReference,
          category,
        },
        theme: {
          color: '#d97706',
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // Step 3: Backend signature verification
          try {
            setSubmitting(true);
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderReference: data.orderReference,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              setErrorMessage(verifyData.error || 'Payment signature verification failed.');
              setSubmitting(false);
              return;
            }

            // Redirect to ticket confirmation page
            const targetRef = verifyData.orderReference || data.orderReference;
            if (targetRef) {
              router.push(`/booking/${targetRef}`);
            } else {
              setSubmitting(false);
            }
          } catch (err: any) {
            setErrorMessage(err.message || 'Network error verifying payment.');
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            // Handle modal dismiss (user cancelled)
            setSubmitting(false);
            setErrorMessage('Payment cancelled by user. You can try again whenever ready.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);

      // Handle payment failure event
      rzp.on('payment.failed', function (failRes: any) {
        setSubmitting(false);
        const reason = failRes.error?.description || failRes.error?.reason || 'Payment failed';
        setErrorMessage(`Payment failed: ${reason}. Please try again or check your card/UPI details.`);
      });

      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error creating booking order');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-20">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl sm:text-5xl font-black gold-gradient-text uppercase font-royal">
          Secure Ticket Checkout
        </h1>
        <p className="text-xs sm:text-sm text-amber-100/70">
          Raas in Taal 2026 • Sunday, 18 Oct 2026 • Khelcity Arena, Jaipur
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Form (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-3xl glass-festive-card border-2 border-amber-400/35 space-y-6"
          >
            {/* Category Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-amber-400 uppercase tracking-widest">
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
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_20px_rgba(245,130,32,0.3)]'
                          : 'border-amber-400/20 bg-black/40 hover:border-amber-400/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        <span className="text-xs font-black text-amber-300">₹{item.price}</span>
                      </div>
                      <span className="text-[10px] text-amber-100/60 block mt-1">
                        {item.perTicket} {item.perTicket === 1 ? 'Attendee' : 'Attendees'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-amber-400/20">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wide block">
                  Package Quantity
                </span>
                <span className="text-[11px] text-amber-200/70">
                  {catInfo.perTicket * quantity} total attendee pass slots
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 rounded-xl bg-[#28060F] border border-amber-400/30 text-amber-300 font-black hover:bg-black text-sm"
                >
                  -
                </button>
                <span className="text-base font-black text-amber-300 w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(5, quantity + 1))}
                  className="w-9 h-9 rounded-xl bg-[#28060F] border border-amber-400/30 text-amber-300 font-black hover:bg-black text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Group female confirmation checkbox */}
            {category === 'group' && (
              <div className="p-4 rounded-2xl bg-[#28060F]/90 border border-purple-500/50 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupFemaleVerified}
                    onChange={(e) => setGroupFemaleVerified(e.target.checked)}
                    className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    required
                  />
                  <span className="text-xs text-amber-100/90 font-medium leading-relaxed">
                    I confirm that at least one attendee in our 4-person group is female. (Mandatory organizer rule).
                  </span>
                </label>
              </div>
            )}

            {/* Primary Customer Contact Details (Immediate, Zero Waiting) */}
            <div className="space-y-4 pt-4 border-t border-amber-400/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                  Primary Attendee &amp; Pass Delivery
                </span>
                {customerUser ? (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Signed in as {customerUser.name}</span>
                  </span>
                ) : (
                  <Link
                    href="/account"
                    className="text-[11px] text-amber-300/80 hover:text-amber-200 underline font-semibold"
                  >
                    Have an account? Sign in
                  </Link>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-200 uppercase mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-amber-400/60 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-amber-400/30 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-amber-200 uppercase mb-1">
                    Email Address (Instant QR Delivery) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-amber-400/60 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-amber-400/30 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-200 uppercase mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-amber-400/60 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-amber-400/30 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Attendee Names (if > 1 attendee) */}
            {totalAttendees > 1 && (
              <div className="space-y-3 pt-2 border-t border-amber-400/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-400 uppercase tracking-widest">
                    Attendee Names ({totalAttendees} people)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: totalAttendees }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Attendee ${i + 1} Name ${i === 0 ? '(Primary / You)' : ''}`}
                      value={attendeeNames[i] || (i === 0 ? customerName : '')}
                      onChange={(e) => {
                        const next = [...attendeeNames];
                        next[i] = e.target.value;
                        setAttendeeNames(next);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-black/50 border border-amber-400/20 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/60 flex items-start gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Razorpay Test Mode Active</span>
                </p>
                <p className="text-[11px] text-amber-100/75 leading-relaxed">
                  Real banking UPI apps reject test transactions. To test payment success:
                  <br />• <strong>UPI:</strong> select UPI &rarr; enter VPA <span className="font-mono text-amber-300 bg-black/50 px-1 py-0.5 rounded">success@razorpay</span>
                  <br />• <strong>Card:</strong> use test card <span className="font-mono text-amber-300 bg-black/50 px-1 py-0.5 rounded">4111 1111 1111 1111</span> (any future MM/YY, CVV 123, OTP 123456)
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gold-gradient-btn py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.01] transition-transform"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Reserving &amp; Opening Razorpay Checkout...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Proceed to Pay ₹{totalPrice} via Razorpay</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Summary Box (1 col) */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl glass-festive-card border-2 border-amber-400/35 space-y-5">
            <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest border-b border-amber-400/20 pb-3">
              Booking Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-amber-100/70">Category</span>
                <span className="font-extrabold text-white">{catInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-100/70">Package Quantity</span>
                <span className="font-extrabold text-white">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-100/70">Total Admitted Attendees</span>
                <span className="font-black text-amber-300">{totalAttendees} Persons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-100/70">Price per unit</span>
                <span className="font-bold text-white">₹{catInfo.price}</span>
              </div>

              <div className="pt-3 border-t border-amber-400/20 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total Amount</span>
                <span className="text-3xl font-black text-amber-300">₹{totalPrice}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-400/20 space-y-2 text-[11px] text-amber-100/75">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Hidden Fees</span>
              </div>
              <p>Temporary reservation held for 10 minutes upon checkout.</p>
            </div>

            <div className="space-y-2 text-[11px] text-amber-100/70">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>1 QR Gate Pass per booking</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant email delivery upon verified payment</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-amber-300 font-bold">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
