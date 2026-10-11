import Razorpay from 'razorpay';
import crypto from 'node:crypto';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  return {
    keyId,
    keySecret,
  };
}

let razorpayClientInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  const { keyId, keySecret } = getRazorpayConfig();

  if (!keyId || !keySecret) {
    const error: any = new Error('Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are missing.');
    error.statusCode = 401;
    throw error;
  }

  if (!razorpayClientInstance) {
    razorpayClientInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayClientInstance;
}

/**
 * Verifies Razorpay payment signature
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret?: string
): boolean {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const keySecret = secret || process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  try {
    const sigBuffer = Buffer.from(signature, 'utf8');
    const genBuffer = Buffer.from(generatedSignature, 'utf8');
    if (sigBuffer.length !== genBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, genBuffer);
  } catch {
    return false;
  }
}
