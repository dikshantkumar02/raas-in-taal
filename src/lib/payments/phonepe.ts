import crypto from 'node:crypto';
import { safeCompare } from '../security/crypto';

export interface PhonePeConfig {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
  hostUrl: string;
}

export function getPhonePeConfig(): PhonePeConfig {
  return {
    merchantId: process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT',
    saltKey: process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399',
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
    hostUrl: process.env.PHONEPE_HOST_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  };
}

/**
 * Calculates X-VERIFY for POST /pg/v1/pay
 * Formula: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
 */
export function calculatePayChecksum(
  base64Payload: string,
  saltKey: string,
  saltIndex: string
): string {
  const endpoint = '/pg/v1/pay';
  const data = base64Payload + endpoint + saltKey;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `${hash}###${saltIndex}`;
}

/**
 * Calculates X-VERIFY for GET /pg/v1/status/{merchantId}/{merchantTransactionId}
 * Formula: SHA256("/pg/v1/status/" + merchantId + "/" + transactionId + saltKey) + "###" + saltIndex
 */
export function calculateStatusChecksum(
  merchantId: string,
  transactionId: string,
  saltKey: string,
  saltIndex: string
): string {
  const endpoint = `/pg/v1/status/${merchantId}/${transactionId}`;
  const data = endpoint + saltKey;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `${hash}###${saltIndex}`;
}

/**
 * Verifies PhonePe S2S Callback signature
 * Formula: SHA256(responseBase64 + saltKey) + "###" + saltIndex
 */
export function verifyCallbackSignature(
  responseBase64: string,
  receivedHeader: string,
  saltKey: string,
  saltIndex: string
): boolean {
  if (!responseBase64 || !receivedHeader) return false;
  const data = responseBase64 + saltKey;
  const calculatedHash = crypto.createHash('sha256').update(data).digest('hex');
  const expectedHeader = `${calculatedHash}###${saltIndex}`;
  return safeCompare(expectedHeader, receivedHeader);
}

/**
 * Initializes PhonePe payment order and generates redirect URL.
 */
export async function initiatePhonePePayment(params: {
  transactionId: string;
  orderReference: string;
  amountPaise: number;
  customerPhone: string;
  customerUserId: string;
  redirectUrl: string;
  callbackUrl: string;
}): Promise<{
  success: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  const config = getPhonePeConfig();

  const payload = {
    merchantId: config.merchantId,
    merchantTransactionId: params.transactionId,
    merchantUserId: params.customerUserId,
    amount: params.amountPaise,
    redirectUrl: params.redirectUrl,
    redirectMode: 'POST',
    callbackUrl: params.callbackUrl,
    mobileNumber: params.customerPhone.replace(/\D/g, '').slice(-10),
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  const jsonString = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonString).toString('base64');
  const xVerify = calculatePayChecksum(base64Payload, config.saltKey, config.saltIndex);

  try {
    const res = await fetch(`${config.hostUrl}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        request: base64Payload,
      }),
    });

    const data = await res.json();

    if (data.success && data.data?.instrumentResponse?.redirectInfo?.url) {
      return {
        success: true,
        redirectUrl: data.data.instrumentResponse.redirectInfo.url,
      };
    } else {
      return {
        success: false,
        error: data.message || 'PhonePe payment initiation failed',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to connect to PhonePe Gateway',
    };
  }
}

/**
 * Checks authoritative payment status with PhonePe server.
 */
export async function checkPhonePePaymentStatus(transactionId: string): Promise<{
  success: boolean;
  status: 'PAYMENT_SUCCESS' | 'PAYMENT_ERROR' | 'PAYMENT_PENDING' | 'PAYMENT_DECLINED' | 'UNKNOWN';
  amountPaise?: number;
  providerReferenceId?: string;
  error?: string;
}> {
  const config = getPhonePeConfig();
  const xVerify = calculateStatusChecksum(
    config.merchantId,
    transactionId,
    config.saltKey,
    config.saltIndex
  );

  try {
    const res = await fetch(
      `${config.hostUrl}/pg/v1/status/${config.merchantId}/${transactionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': config.merchantId,
        },
      }
    );

    const data = await res.json();

    if (data.success && data.code === 'PAYMENT_SUCCESS') {
      return {
        success: true,
        status: 'PAYMENT_SUCCESS',
        amountPaise: data.data?.amount,
        providerReferenceId: data.data?.transactionId,
      };
    } else if (data.code === 'PAYMENT_PENDING') {
      return {
        success: false,
        status: 'PAYMENT_PENDING',
        error: data.message,
      };
    } else {
      return {
        success: false,
        status: data.code === 'PAYMENT_DECLINED' ? 'PAYMENT_DECLINED' : 'PAYMENT_ERROR',
        error: data.message || 'Payment not successful',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'UNKNOWN',
      error: err.message || 'Network error querying PhonePe status',
    };
  }
}
