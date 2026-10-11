'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayCheckoutButtonProps {
  amount: number; // in paise (e.g. 24900 for ₹249.00)
  currency?: string;
  receipt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  categoryCode?: string;
  quantity?: number;
  attendeeDetails?: Array<{ name: string }>;
  groupFemaleVerified?: boolean;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (verifyData: any) => void;
  onError?: (errorMessage: string) => void;
}

export function RazorpayCheckoutButton({
  amount,
  currency = 'INR',
  receipt,
  customerName = '',
  customerEmail = '',
  customerPhone = '',
  notes,
  categoryCode,
  quantity,
  attendeeDetails,
  groupFemaleVerified,
  buttonText,
  className,
  disabled = false,
  onSuccess,
  onError,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      setScriptLoaded(true);
    }
  }, []);

  const handlePay = async () => {
    setLocalError(null);

    // Validate amount
    if (!amount || amount < 100) {
      const err = 'Minimum order amount must be at least 100 paise (₹1.00)';
      setLocalError(err);
      onError?.(err);
      return;
    }

    // Ensure Razorpay SDK is available
    if (typeof window === 'undefined' || !window.Razorpay) {
      const err = 'Razorpay SDK is still loading. Please try again in a few seconds.';
      setLocalError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Call Backend to create order
      const createOrderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          receipt: receipt || `rcpt_${Date.now()}`,
          notes,
          categoryCode,
          quantity,
          customerName,
          customerEmail,
          customerPhone,
          attendeeDetails,
          groupFemaleVerified,
        }),
      });

      const orderData = await createOrderRes.json();

      if (!createOrderRes.ok || !orderData.order_id) {
        throw new Error(orderData.error || 'Failed to initialize Razorpay order');
      }

      const keyId = orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TmZ25PPym09aUr';

      // Step 2: Open Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Raas in Taal 2026',
        description: 'Official Pass Checkout - Chaos and Chill',
        order_id: orderData.order_id,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone.replace(/\D/g, ''),
          ...(keyId.startsWith('rzp_test_') ? { vpa: 'success@razorpay' } : {}),
        },
        notes: {
          orderReference: orderData.orderReference || orderData.receipt,
          ...(notes || {}),
        },
        theme: {
          color: '#d97706',
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // Step 3: Backend signature verification
          try {
            setLoading(true);
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderReference: orderData.orderReference || orderData.receipt,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              const verifyErr = verifyData.error || 'Payment signature verification failed';
              setLocalError(verifyErr);
              onError?.(verifyErr);
              setLoading(false);
              return;
            }

            // Success callback
            setLoading(false);
            onSuccess?.(verifyData);
          } catch (verifyErr: any) {
            const msg = verifyErr.message || 'Error communicating with verification endpoint';
            setLocalError(msg);
            onError?.(msg);
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            const cancelMsg = 'Payment was cancelled or modal was closed by user.';
            setLocalError(cancelMsg);
            onError?.(cancelMsg);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      // Handle payment failure event
      razorpayInstance.on('payment.failed', (failResponse: any) => {
        setLoading(false);
        const reason =
          failResponse.error?.description ||
          failResponse.error?.reason ||
          'Payment process failed at gateway';
        const failMsg = `Payment failed: ${reason}`;
        setLocalError(failMsg);
        onError?.(failMsg);
      });

      razorpayInstance.open();
    } catch (err: any) {
      setLoading(false);
      const errMsg = err.message || 'Failed to initiate payment';
      setLocalError(errMsg);
      onError?.(errMsg);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="w-full space-y-2">
        <button
          type="button"
          onClick={handlePay}
          disabled={disabled || loading}
          className={
            className ||
            'w-full gold-gradient-btn py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.01] transition-transform'
          }
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Connecting to Razorpay...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>{buttonText || `Pay ₹${(amount / 100).toFixed(2)} with Razorpay`}</span>
            </>
          )}
        </button>

        {localError && (
          <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}
      </div>
    </>
  );
}

export default RazorpayCheckoutButton;
