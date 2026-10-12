'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  QrCode,
  Mail,
  Loader2,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  Home,
  User,
  ArrowRight,
} from 'lucide-react';

interface OrderDetails {
  orderReference: string;
  categoryCode: string;
  quantity: number;
  totalAttendees: number;
  amountPaise: number;
  currency: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RESERVED' | 'EXPIRED' | 'CANCELLED';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  reservationExpiresAt?: string;
  isExpired?: boolean;
}

interface PassDetails {
  qrToken: string;
  categoryCode: string;
  totalAttendees: number;
  admittedCount: number;
  status: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  stag_girls: 'Stag Girls (Female Only)',
  couple: 'Couple Pass (2 People)',
  group: 'Group Package (4 People)',
  family: 'Family Package (4 Members)',
};

export default function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawOrderRef } = use(params);
  const router = useRouter();
  const orderReference = decodeURIComponent(rawOrderRef || '').trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [orderStatus, setOrderStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | 'RESERVED' | 'EXPIRED' | 'CANCELLED'>('PENDING');
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [passData, setPassData] = useState<PassDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  // Preload Razorpay Checkout Script
  useEffect(() => {
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

  const loadBookingStatus = useCallback(async (isUserAction = false) => {
    if (!orderReference) return;
    try {
      if (isUserAction) setLoading(true);
      setErrorMessage('');
      setInfoMessage('');

      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderReference }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404 || data.error?.toLowerCase().includes('not found')) {
          setNotFound(true);
          return;
        }
        setErrorMessage(data.error || 'Failed to check booking status.');
        return;
      }

      setNotFound(false);
      if (data.orderDetails) {
        setOrderDetails(data.orderDetails);
      }

      if (data.success && data.paymentStatus === 'SUCCESS') {
        setOrderStatus('SUCCESS');
        if (data.pass) {
          setPassData(data.pass);
        }
        if (isUserAction) {
          setInfoMessage('Payment verified successfully! Your gate pass is ready.');
        }
      } else {
        const nextStatus = data.paymentStatus || data.orderDetails?.paymentStatus || 'PENDING';
        setOrderStatus(nextStatus);
        if (isUserAction && !data.success) {
          setInfoMessage('Payment has not been completed yet. Please click "Pay Securely with Razorpay" below.');
        }
      }
    } catch {
      setErrorMessage('Unable to check payment status. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [orderReference]);

  useEffect(() => {
    loadBookingStatus(false);
  }, [loadBookingStatus]);

  // Ensure Razorpay SDK is loaded
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

  // Launch Real Razorpay Payment Gateway
  const handleLaunchPayment = async () => {
    setErrorMessage('');
    setInfoMessage('');

    // Check customer authentication
    try {
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) {
        const returnUrl = `/booking/${encodeURIComponent(orderReference)}`;
        router.push(`/account?redirect=${encodeURIComponent(returnUrl)}`);
        return;
      }
      const authData = await authRes.json();
      if (!authData.authenticated) {
        const returnUrl = `/booking/${encodeURIComponent(orderReference)}`;
        router.push(`/account?redirect=${encodeURIComponent(returnUrl)}`);
        return;
      }
    } catch {
      setErrorMessage('Could not verify account session. Please refresh and try again.');
      return;
    }

    setPaying(true);

    try {
      const isLoaded = await ensureRazorpayLoaded();
      if (!isLoaded || !(window as any).Razorpay) {
        setErrorMessage('Unable to load Razorpay payment gateway. Please check your internet connection or disable adblockers.');
        setPaying(false);
        return;
      }

      // 1. Request official Razorpay order from authenticated backend
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
        }),
      });

      const orderData = await createRes.json();

      if (!createRes.ok || !orderData.order_id) {
        if (orderData.alreadyPaid) {
          await loadBookingStatus(true);
          setPaying(false);
          return;
        }
        throw new Error(orderData.error || 'Failed to initialize payment gateway.');
      }

      const keyId = orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
      const catName = CATEGORY_NAMES[orderData.categoryCode] || 'Dandiya Event Pass';

      // 2. Open Official Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Raas in Taal 2026',
        description: `Official Gate Pass (${orderData.quantity || 1} pkg)`,
        order_id: orderData.order_id,
        prefill: {
          name: orderData.customerName || orderDetails?.customerName || '',
          email: orderData.customerEmail || orderDetails?.customerEmail || '',
          contact: (orderData.customerPhone || orderDetails?.customerPhone || '').replace(/\D/g, ''),
          ...(keyId.startsWith('rzp_test_') ? { vpa: 'success@razorpay' } : {}),
        },
        notes: {
          orderReference,
          category: orderData.categoryCode || orderDetails?.categoryCode || '',
        },
        theme: {
          color: '#d97706',
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // 3. Authoritative Backend Signature Verification
          try {
            setPaying(true);
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderReference,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              setErrorMessage(verifyData.error || 'Payment signature verification failed.');
              setOrderStatus('FAILED');
              setPaying(false);
              return;
            }

            // Successfully Verified
            setOrderStatus('SUCCESS');
            if (verifyData.pass) {
              setPassData(verifyData.pass);
            }
            if (verifyData.orderDetails) {
              setOrderDetails(verifyData.orderDetails);
            }
            setInfoMessage('Payment verified successfully! Your QR ticket has been generated.');
          } catch (err: any) {
            setErrorMessage(err.message || 'Network error verifying payment with server.');
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setInfoMessage('Payment was cancelled or closed. You can click "Pay Securely with Razorpay" when ready.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);

      rzp.on('payment.failed', (failRes: any) => {
        setPaying(false);
        setOrderStatus('FAILED');
        const reason = failRes.error?.description || failRes.error?.reason || 'Payment failed';
        setErrorMessage(`Payment could not be completed: ${reason}. Please try again.`);
      });

      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start Razorpay payment.');
      setPaying(false);
    }
  };

  const handleResendEmail = async () => {
    const userEmail = prompt('Please confirm your registered email address:', orderDetails?.customerEmail || '');
    if (!userEmail) return;

    setResendingEmail(true);
    setEmailStatus('');
    try {
      const res = await fetch('/api/tickets/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: orderReference,
          email: userEmail.trim().toLowerCase(),
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

  const formattedAmount = orderDetails
    ? `₹${(orderDetails.amountPaise / 100).toLocaleString('en-IN')}`
    : '—';

  const categoryTitle = orderDetails?.categoryCode
    ? CATEGORY_NAMES[orderDetails.categoryCode] || orderDetails.categoryCode
    : 'Dandiya Event Pass';

  const isEligibleForPayment =
    orderStatus === 'PENDING' || orderStatus === 'RESERVED' || orderStatus === 'FAILED';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-extrabold gold-gradient-text">Booking Status</h1>
        <p className="text-xs text-raas-cream/70 font-mono tracking-wider">
          Reference: <span className="text-raas-gold font-bold">{orderReference}</span>
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-4 shadow-xl">
          <Loader2 className="w-8 h-8 text-raas-gold animate-spin mx-auto" />
          <p className="text-sm text-raas-cream font-medium">Checking live payment status...</p>
        </div>
      ) : notFound ? (
        <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-6 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-raas-cream">
              Reservation Not Found or Expired
            </h2>
            <p className="text-xs text-raas-cream/70 max-w-md mx-auto">
              We could not find an active reservation for reference <span className="font-mono text-raas-gold font-bold">{orderReference}</span>. Unpaid reservations expire automatically after 10 minutes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/checkout"
              className="w-full sm:w-auto gold-gradient-btn px-6 py-3.5 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2"
            >
              <span>Book Tickets Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/account"
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center justify-center gap-2 transition-colors"
            >
              <User className="w-4 h-4 text-raas-marigold" />
              <span>My Bookings</span>
            </Link>

            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4 text-raas-cream/70" />
              <span>Home</span>
            </Link>
          </div>
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
              Your official QR Gate Pass has been issued and sent to your email. You can view, download, or present it directly on your mobile at the gate.
            </p>
          </div>

          {passData && (
            <div className="p-5 rounded-2xl bg-raas-maroon-dark border border-raas-gold/20 text-left space-y-3 max-w-md mx-auto">
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Ticket Category:</span>
                <span className="font-bold text-raas-gold">{categoryTitle}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Total Attendees:</span>
                <span className="font-bold text-raas-cream">{passData.totalAttendees} Person(s)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Gate Check-in:</span>
                <span className="font-bold text-raas-marigold">{passData.admittedCount} of {passData.totalAttendees} Admitted</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-raas-cream/60">Pass Status:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase">
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
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-raas-marigold" />
              <span>{resendingEmail ? 'Resending...' : 'Resend Email Pass'}</span>
            </button>
          </div>

          {emailStatus && (
            <p className="text-xs text-raas-gold pt-2 font-medium">{emailStatus}</p>
          )}

          <div className="pt-2">
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-raas-gold/80 hover:text-raas-gold transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>View All My Bookings</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-6 text-center shadow-xl">
          {orderStatus === 'FAILED' ? (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-9 h-9" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-raas-marigold/20 border border-raas-marigold/40 text-raas-marigold flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>
          )}

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-raas-cream">
              {orderStatus === 'FAILED'
                ? 'Payment Incomplete / Failed'
                : orderStatus === 'EXPIRED'
                ? 'Reservation Expired'
                : 'Payment In Progress / Pending'}
            </h2>
            <p className="text-xs text-raas-cream/70 max-w-md mx-auto">
              {orderStatus === 'EXPIRED'
                ? 'Your temporary ticket hold has expired. Please create a new booking from the homepage.'
                : orderStatus === 'FAILED'
                ? 'Your payment was not completed. You can safely retry payment below using Razorpay.'
                : 'Your ticket reservation is held. Complete payment securely via Razorpay to receive your QR gate pass.'}
            </p>
          </div>

          {/* Trusted Database Summary Card */}
          {orderDetails && (
            <div className="p-5 rounded-2xl bg-raas-maroon-dark border border-raas-gold/25 text-left space-y-3 max-w-md mx-auto shadow-inner">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-raas-gold/15">
                <span className="text-raas-cream/60">Booking Reference:</span>
                <span className="font-mono font-bold text-raas-gold tracking-wider">{orderDetails.orderReference}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-raas-cream/60">Ticket Category:</span>
                <span className="font-bold text-raas-cream">{categoryTitle}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-raas-cream/60">Tickets & Attendees:</span>
                <span className="font-bold text-raas-cream">
                  {orderDetails.quantity} Ticket(s) • {orderDetails.totalAttendees} Attendee(s)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-raas-cream/60">Booked For:</span>
                <span className="text-raas-cream/90 font-medium">{orderDetails.customerName}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-raas-gold/15">
                <span className="text-raas-cream/80 font-bold">Total Amount:</span>
                <span className="text-base font-extrabold text-raas-gold">{formattedAmount}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-raas-cream/60">Current Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  orderStatus === 'FAILED'
                    ? 'bg-rose-950 text-rose-400 border-rose-500/30'
                    : orderStatus === 'EXPIRED'
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    : 'bg-amber-950 text-amber-300 border-amber-500/30'
                }`}>
                  {orderStatus}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs text-center max-w-md mx-auto flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-raas-maroon-dark/80 border border-raas-gold/30 text-raas-cream/90 text-xs text-center max-w-md mx-auto">
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Real Razorpay Checkout Action */}
          {isEligibleForPayment && (
            <div className="max-w-md mx-auto space-y-3 pt-2">
              <button
                onClick={handleLaunchPayment}
                disabled={paying}
                className="w-full py-4 rounded-xl gold-gradient-btn text-xs sm:text-sm font-extrabold shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-raas-maroon-deep" />
                    <span>Connecting to Razorpay...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-raas-maroon-deep" />
                    <span>Pay Securely with Razorpay ({formattedAmount})</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-raas-cream/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>UPI, Cards, NetBanking via Official Razorpay 256-Bit SSL Gateway</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-raas-gold/15">
            <button
              onClick={() => loadBookingStatus(true)}
              disabled={loading || paying}
              className="px-5 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-raas-gold ${loading ? 'animate-spin' : ''}`} />
              <span>Check Payment Status</span>
            </button>

            <Link
              href="/account"
              className="px-5 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center gap-2 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-raas-marigold" />
              <span>My Bookings</span>
            </Link>

            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center gap-2 transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-raas-cream/70" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
