export type TicketCategoryCode = 'stag_girls' | 'couple' | 'group' | 'family';

export type PaymentStatus = 'PENDING' | 'RESERVED' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

export type PassStatus = 'VALID' | 'ALL_ENTERED' | 'CANCELLED' | 'REFUNDED' | 'REVOKED';

export interface TicketCategory {
  id: string;
  code: TicketCategoryCode;
  name: string;
  pricePaise: number;
  attendeesPerTicket: number;
  description: string;
  eligibilityRule?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface EventConfig {
  id: string;
  slug: string;
  name: string;
  brand: string;
  venue: string;
  eventDate: string; // "2026-10-18"
  durgaPujaTime: string; // "17:30"
  dandiyaNightTime: string; // "18:00"
  maxCapacity: number; // 500
  phones: string[]; // ["8003022503", "8278695419"]
  instagramHandle: string; // "@chaos_and_chill"
  instagramUrl: string;
  refundPolicy: string;
  isActive: boolean;
}

export interface Order {
  id: string;
  orderReference: string;
  categoryCode: TicketCategoryCode;
  quantity: number;
  totalAttendees: number;
  amountPaise: number;
  currency: 'INR';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerId?: string;
  attendeeDetails: Array<{ name: string; gender?: string; relation?: string }>;
  groupFemaleVerified: boolean;
  paymentStatus: PaymentStatus;
  phonepeTransactionId?: string;
  phonepeProviderReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  reservationExpiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GatePass {
  id: string;
  orderId: string;
  bookingReference: string;
  qrToken: string; // secret unpredictable token
  qrTokenHash: string; // SHA256 of token
  categoryCode: TicketCategoryCode;
  totalAttendees: number;
  admittedCount: number;
  status: PassStatus;
  issuedAt: Date;
  updatedAt: Date;
}

export interface CheckInRecord {
  id: string;
  passId: string;
  staffId: string;
  staffName: string;
  attendeesAdmitted: number;
  admittedTotalAfterScan: number;
  scanTimestamp: Date;
  notes?: string;
}

export interface PaymentIdempotency {
  id: string;
  transactionId: string;
  provider: string;
  payloadHash: string;
  status: string;
  createdAt: Date;
}

export interface CheckInResult {
  success: boolean;
  resultCode: 'ENTRY_ACCEPTED' | 'ALL_ATTENDEES_CHECKED_IN' | 'EXCEEDS_REMAINING_ALLOWANCE' | 'INVALID_PASS' | 'UNPAID' | 'CANCELLED' | 'REFUNDED' | 'REVOKED';
  message: string;
  bookingReference?: string;
  categoryCode?: TicketCategoryCode;
  customerName?: string;
  previouslyAdmitted: number;
  nowAdmitted: number;
  totalAllowed: number;
  remaining: number;
  firstCheckInTime?: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  createdAt: Date;
}

export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  pinHash: string;
  role: 'staff' | 'gate_supervisor';
  gateLocation?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface StaffTicketLookupResult {
  valid: boolean;
  status: PassStatus;
  bookingReference: string;
  categoryCode: TicketCategoryCode;
  customerName: string;
  totalAttendees: number;
  admittedCount: number;
  remaining: number;
  attendeeNames?: string[];
  issuedAt: Date;
}

