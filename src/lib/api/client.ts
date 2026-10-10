/**
 * RAAS IN TAAL — Centralized API Client
 *
 * Provides typed, standardized HTTP communication between the frontend
 * and backend APIs with configurable base URL, timeout, and consistent error handling.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    let data: any;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { text };
    }

    if (!res.ok) {
      const message = data?.error || data?.message || `Request failed with status ${res.status}`;
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network request failed', 0);
  }
}

export const api = {
  // Authentication
  auth: {
    me: () => request<{ authenticated: boolean; customer?: any; bookings?: any[] }>('/api/auth/me', { method: 'GET' }),
    login: (body: { email: string; password?: string }) =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: { name: string; email: string; phone: string; password?: string }) =>
      request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
  },

  // Orders & Bookings
  orders: {
    create: (payload: {
      categoryCode: string;
      quantity: number;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      groupFemaleVerified?: boolean;
      attendeeDetails?: Array<{ name: string; age?: number; gender?: string }>;
    }) => request<{ success: boolean; orderReference: string; redirectUrl?: string; order: any }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  },

  // Payment Verification
  payments: {
    verify: (orderReference: string, simulateSuccess = false) =>
      request<{ success: boolean; paymentStatus: string; passQrToken?: string; orderReference: string }>(
        '/api/payments/verify',
        {
          method: 'POST',
          body: JSON.stringify({ orderReference, simulateSuccess }),
        }
      ),
  },

  // Gate Scanner
  scanner: {
    checkIn: (body: { token: string; countToAdmit: number; staffPin: string; gateIdentifier?: string }) =>
      request('/api/scanner/check-in', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Ticket Resend & Retrieval
  tickets: {
    resend: (orderReference: string) =>
      request('/api/tickets/resend', {
        method: 'POST',
        body: JSON.stringify({ orderReference }),
      }),
    getByToken: (token: string) =>
      request(`/api/ticket/${encodeURIComponent(token)}`, { method: 'GET' }),
  },

  // Admin Management
  admin: {
    getStats: (adminSecret: string) =>
      request('/api/admin/stats', {
        method: 'POST',
        body: JSON.stringify({ adminSecret }),
      }),
    action: (adminSecret: string, action: string, payload?: any) =>
      request('/api/admin/action', {
        method: 'POST',
        body: JSON.stringify({ adminSecret, action, payload }),
      }),
  },
};
