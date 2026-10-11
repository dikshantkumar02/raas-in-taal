'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Ticket, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  LogOut, 
  Sparkles,
  RefreshCw,
  KeyRound,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface BookingItem {
  id: string;
  orderReference: string;
  categoryCode: string;
  quantity: number;
  totalAttendees: number;
  amountPaise: number;
  paymentStatus: 'SUCCESS' | 'RESERVED' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  passQrToken?: string;
  reservationExpiresAt: string;
  createdAt: string;
}

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get('redirect');

  const [tab, setTab] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD'>('LOGIN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login / Registration Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Password Recovery states
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.customer) {
          setUser(data.customer);
          setBookings(data.bookings || []);
          if (redirectUrl) {
            router.push(redirectUrl);
            return;
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    const endpoint = tab === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
    const payload = tab === 'LOGIN' 
      ? { email, password } 
      : { name, email, phone, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please check your details.');
      } else {
        setSuccessMsg(tab === 'LOGIN' ? 'Logged in successfully!' : 'Account registered successfully!');
        if (redirectUrl) {
          router.push(redirectUrl);
          return;
        }
        await fetchSession();
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 429) {
        setError(data.error || 'Failed to send verification code.');
      } else if (res.status === 429) {
        setError(data.error || 'Too many requests. Please wait.');
      } else {
        setSuccessMsg(data.message || 'Verification code sent to your email.');
        setTab('RESET_PASSWORD');
        setResendCooldown(60);
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !recoveryEmail) return;
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to resend verification code.');
      } else {
        setSuccessMsg('A new 6-digit verification code has been dispatched.');
        setResendCooldown(60);
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify both fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Password reset failed. Invalid or expired code.');
      } else {
        setSuccessMsg('Password updated successfully! You can now sign in with your new password.');
        setTab('LOGIN');
        setEmail(recoveryEmail);
        setPassword('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setBookings([]);
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
    } catch {
      // logout error
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-raas-gold animate-spin" />
        <p className="text-sm font-medium text-raas-cream/80">Loading your account...</p>
      </div>
    );
  }

  // LOGGED IN DASHBOARD
  if (user) {
    const successCount = bookings.filter((b) => b.paymentStatus === 'SUCCESS').length;
    const pendingCount = bookings.filter((b) => b.paymentStatus === 'RESERVED' || b.paymentStatus === 'PENDING').length;

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Header Profile Bar */}
        <div className="p-6 sm:p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-raas-marigold via-raas-gold to-yellow-200 text-[#140207] flex items-center justify-center font-black text-2xl shadow-lg">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                Attendee Portal
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-raas-cream">
                Namaste, {user.name}!
              </h1>
              <p className="text-xs text-raas-cream/70 font-mono pt-0.5">
                {user.email} {user.phone && `• ${user.phone}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => fetchSession()}
              className="p-2.5 rounded-xl border border-raas-gold/30 hover:border-raas-gold bg-black/40 text-raas-gold text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
              title="Refresh booking history"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/#tickets"
              className="flex-1 sm:flex-none gold-gradient-btn px-5 py-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5"
            >
              <Ticket className="w-4 h-4" />
              <span>Book Tickets</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl border border-red-500/30 hover:border-red-500 bg-red-950/20 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-raas-maroon-dark border border-raas-gold/25">
            <span className="text-xs text-raas-cream/60">Total Bookings</span>
            <div className="text-2xl font-black text-raas-cream mt-1">{bookings.length}</div>
          </div>
          <div className="p-5 rounded-2xl bg-raas-maroon-dark border border-emerald-500/30">
            <span className="text-xs text-emerald-400/80">Confirmed Passes</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{successCount}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-5 rounded-2xl bg-raas-maroon-dark border border-amber-500/30">
            <span className="text-xs text-amber-400/80">Pending Payments</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{pendingCount}</div>
          </div>
        </div>

        {/* Bookings List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold gold-gradient-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-raas-gold" />
              <span>Your Booking History</span>
            </h2>
            <span className="text-xs text-raas-cream/60 font-mono">
              Persistent &amp; Verified
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-raas-maroon-mid border border-raas-gold/20 space-y-4">
              <Ticket className="w-12 h-12 text-raas-gold/50 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-raas-cream">No Bookings Found Yet</h3>
                <p className="text-xs text-raas-cream/70 max-w-sm mx-auto">
                  Bookings made with {user.email} are permanently stored in our secure database and will appear here with instant QR passes.
                </p>
              </div>
              <Link
                href="/#tickets"
                className="inline-flex items-center gap-2 gold-gradient-btn px-6 py-3 rounded-full text-xs font-bold"
              >
                <span>Browse Ticket Packages</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const isSuccess = booking.paymentStatus === 'SUCCESS';
                const isPending = booking.paymentStatus === 'RESERVED' || booking.paymentStatus === 'PENDING';
                const isFailed = booking.paymentStatus === 'FAILED' || booking.paymentStatus === 'EXPIRED';

                return (
                  <div
                    key={booking.id}
                    className={`p-6 rounded-2xl border transition-all ${
                      isSuccess
                        ? 'bg-raas-maroon-mid border-raas-gold/30 shadow-lg'
                        : isPending
                        ? 'bg-[#26060E] border-amber-500/30'
                        : 'bg-[#1D0308] border-red-500/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-mono font-bold text-raas-cream bg-[#140207] px-2.5 py-1 rounded-md border border-raas-gold/20">
                            {booking.orderReference}
                          </span>

                          {/* Status Badge */}
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              CONFIRMED &amp; ISSUED
                            </span>
                          )}

                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500/40 text-[11px] font-bold text-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5" />
                              PAYMENT PENDING
                            </span>
                          )}

                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-950 border border-red-500/40 text-[11px] font-bold text-red-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {booking.paymentStatus}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-bold text-raas-cream">
                            {booking.categoryCode.toUpperCase()} • {booking.totalAttendees} Attendee(s)
                          </div>
                          <div className="text-xs text-raas-cream/70 flex items-center gap-1.5 flex-wrap">
                            <span>Amount: <strong className="text-raas-gold font-mono">₹{booking.amountPaise / 100}</strong></span>
                            <span>•</span>
                            <span>Booked on: <strong>{new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> at <strong>{new Date(booking.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 sm:self-center">
                        {isSuccess && booking.passQrToken && (
                          <Link
                            href={`/ticket/${encodeURIComponent(booking.passQrToken)}`}
                            className="gold-gradient-btn px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>View QR Pass</span>
                          </Link>
                        )}

                        {isPending && (
                          <Link
                            href={`/booking/${booking.orderReference}?mode=sandbox`}
                            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                          >
                            <Clock className="w-4 h-4" />
                            <span>Complete Payment</span>
                          </Link>
                        )}

                        {isFailed && (
                          <Link
                            href="/#tickets"
                            className="px-4 py-2.5 rounded-xl bg-[#28060F] border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-cream flex items-center gap-1.5"
                          >
                            <span>Book Again</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD / OTP RECOVERY FORM
  // ─────────────────────────────────────────────────────────────
  if (tab === 'FORGOT_PASSWORD') {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-raas-marigold/20 border border-raas-gold/30 text-raas-gold flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black gold-gradient-text tracking-wide">
              Recover Password
            </h1>
            <p className="text-xs text-raas-cream/70 leading-relaxed">
              Enter your registered email address. We will generate and send a secure 6-digit OTP to reset your password.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl gold-gradient-btn text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Code...</span>
                </>
              ) : (
                <span>Send Verification Code</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setTab('LOGIN'); setError(''); setSuccessMsg(''); }}
              className="text-xs text-amber-300/80 hover:text-amber-200 inline-flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RESET PASSWORD OTP & NEW PASSWORD FORM
  // ─────────────────────────────────────────────────────────────
  if (tab === 'RESET_PASSWORD') {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-raas-marigold/20 border border-raas-gold/30 text-raas-gold flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black gold-gradient-text tracking-wide">
              Set New Password
            </h1>
            <p className="text-xs text-raas-cream/70 leading-relaxed">
              Enter the 6-digit OTP code sent to <strong>{recoveryEmail}</strong> and choose your new password.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || submitting}
                  onClick={handleResendOtp}
                  className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full text-center tracking-[8px] font-mono font-black text-lg py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-amber-300 placeholder:text-raas-cream/20 focus:border-raas-gold focus:outline-none"
              />
              <span className="text-[10px] text-amber-200/60 block text-center">
                Valid for 5 minutes only
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl gold-gradient-btn text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password &amp; Sign In</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setTab('LOGIN'); setError(''); setSuccessMsg(''); }}
              className="text-xs text-amber-300/80 hover:text-amber-200 inline-flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LOGIN / SIGNUP FORM (Default Attendee Portal)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="p-8 sm:p-10 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-raas-marigold/20 border border-raas-gold/30 text-raas-gold flex items-center justify-center mx-auto">
            <User className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black gold-gradient-text tracking-wide">
            {tab === 'LOGIN' ? 'Attendee Sign In' : 'Create Attendee Account'}
          </h1>
          <p className="text-xs text-raas-cream/70">
            {tab === 'LOGIN'
              ? 'Access your booked passes, payment status, and gate passes.'
              : 'Sign up to track your bookings and access your passes anytime.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-[#140207] p-1 border border-raas-gold/20">
          <button
            type="button"
            onClick={() => { setTab('LOGIN'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'LOGIN'
                ? 'gold-gradient-btn'
                : 'text-raas-cream/70 hover:text-raas-cream'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('SIGNUP'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'SIGNUP'
                ? 'gold-gradient-btn'
                : 'text-raas-cream/70 hover:text-raas-cream'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {tab === 'SIGNUP' && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                  Mobile Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-raas-gold uppercase tracking-wider block">
                Password
              </label>
              {tab === 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(email);
                    setTab('FORGOT_PASSWORD');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-raas-cream/40 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream placeholder:text-raas-cream/30 focus:border-raas-gold focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl gold-gradient-btn text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{tab === 'LOGIN' ? 'Sign In' : 'Create My Account'}</span>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-raas-cream/60">
          Tip: Your tickets and QR passes remain accessible on this account permanently.
        </p>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-amber-300 font-bold">Loading account...</div>}>
      <AccountContent />
    </Suspense>
  );
}
