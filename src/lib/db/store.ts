import { EventConfig, GatePass, Order, TicketCategory, TicketCategoryCode, CheckInRecord, CheckInResult, PaymentIdempotency } from './types';
import { generateOrderReference, generateSecureToken, hashToken } from '../security/crypto';

// In-memory persistent database engine (can synchronize with Supabase PostgreSQL)
class EventStore {
  private event: EventConfig = {
    id: 'raas-in-taal-2026-event',
    slug: 'raas-in-taal-2026',
    name: 'Raas in Taal',
    brand: 'Chaos and Chill',
    venue: 'Khelcity Multi-Sports Arena, Shivam Nagar, Jagatpura, Jaipur, Rajasthan',
    eventDate: '2026-10-18',
    durgaPujaTime: '17:30',
    dandiyaNightTime: '18:00',
    maxCapacity: 500,
    phones: ['8003022503', '8278695419'],
    instagramHandle: '@chaos_and_chill',
    instagramUrl: 'https://instagram.com/chaos_and_chill',
    refundPolicy: 'Tickets once booked are strictly non-refundable and non-transferable except in the event of official cancellation by organizers.',
    isActive: true,
  };

  private ticketCategories: Map<TicketCategoryCode, TicketCategory> = new Map([
    [
      'stag_girls',
      {
        id: 'cat-stag-girls',
        code: 'stag_girls',
        name: 'Stag Girls',
        pricePaise: 24900, // ₹249
        attendeesPerTicket: 1,
        description: 'Entry pass for 1 female attendee.',
        eligibilityRule: 'Entry strictly for female stags only.',
        isActive: true,
        displayOrder: 1,
      },
    ],
    [
      'couple',
      {
        id: 'cat-couple',
        code: 'couple',
        name: 'Couple',
        pricePaise: 44900, // ₹449
        attendeesPerTicket: 2,
        description: 'Entry pass for 1 couple (2 attendees).',
        eligibilityRule: 'Valid for 1 couple (Male + Female).',
        isActive: true,
        displayOrder: 2,
      },
    ],
    [
      'group',
      {
        id: 'cat-group',
        code: 'group',
        name: 'Group (4 People)',
        pricePaise: 69900, // ₹699
        attendeesPerTicket: 4,
        description: 'Entry package for 4 people.',
        eligibilityRule: 'At least 1 female attendee is mandatory in the group.',
        isActive: true,
        displayOrder: 3,
      },
    ],
    [
      'family',
      {
        id: 'cat-family',
        code: 'family',
        name: 'Family (4 Members)',
        pricePaise: 69900, // ₹699
        attendeesPerTicket: 4,
        description: 'Entry package for 4 family members.',
        eligibilityRule: 'Valid for family members (all ages).',
        isActive: true,
        displayOrder: 4,
      },
    ],
  ]);

  private orders: Map<string, Order> = new Map(); // orderId -> Order
  private ordersByReference: Map<string, string> = new Map(); // ref -> orderId
  private passes: Map<string, GatePass> = new Map(); // passId -> GatePass
  private passesByTokenHash: Map<string, string> = new Map(); // hash -> passId
  private passesByOrderId: Map<string, string> = new Map(); // orderId -> passId
  private checkIns: CheckInRecord[] = [];
  private idempotencyLogs: Map<string, PaymentIdempotency> = new Map();

  // Concurrency lock simulation for atomic operations
  private lockPromise: Promise<void> = Promise.resolve();

  private async acquireLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void = () => {};
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previousLock = this.lockPromise;
    this.lockPromise = this.lockPromise.then(() => waitPromise);

    await previousLock;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  // 1. EVENT & CATEGORIES
  public getEventConfig(): EventConfig {
    return { ...this.event };
  }

  public updateEventConfig(patch: Partial<EventConfig>): EventConfig {
    this.event = { ...this.event, ...patch };
    return { ...this.event };
  }

  public getTicketCategories(): TicketCategory[] {
    return Array.from(this.ticketCategories.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public getTicketCategory(code: TicketCategoryCode): TicketCategory | undefined {
    return this.ticketCategories.get(code);
  }

  // 2. CAPACITY & RESERVATIONS
  public async getCapacityStatus(): Promise<{
    maxCapacity: number;
    allocatedAttendees: number;
    availableAttendees: number;
    confirmedAttendees: number;
    reservedAttendees: number;
    isSoldOut: boolean;
  }> {
    return this.acquireLock(() => {
      const now = new Date();
      let confirmed = 0;
      let reserved = 0;

      for (const order of this.orders.values()) {
        if (order.paymentStatus === 'SUCCESS') {
          confirmed += order.totalAttendees;
        } else if (
          (order.paymentStatus === 'RESERVED' || order.paymentStatus === 'PENDING') &&
          order.reservationExpiresAt > now
        ) {
          reserved += order.totalAttendees;
        }
      }

      const allocated = confirmed + reserved;
      const available = Math.max(0, this.event.maxCapacity - allocated);

      return {
        maxCapacity: this.event.maxCapacity,
        allocatedAttendees: allocated,
        availableAttendees: available,
        confirmedAttendees: confirmed,
        reservedAttendees: reserved,
        isSoldOut: available === 0,
      };
    });
  }

  /**
   * Atomic ticket reservation. Ensures strict limit of 500 attendees cannot be exceeded.
   */
  public async createReservation(params: {
    categoryCode: TicketCategoryCode;
    quantity: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    attendeeDetails?: Array<{ name: string; gender?: string; relation?: string }>;
    groupFemaleVerified?: boolean;
    expiryMinutes?: number;
  }): Promise<{
    success: boolean;
    order?: Order;
    error?: string;
  }> {
    return this.acquireLock(async () => {
      const category = this.ticketCategories.get(params.categoryCode);
      if (!category || !category.isActive) {
        return { success: false, error: 'INVALID_CATEGORY' };
      }

      if (params.quantity < 1 || !Number.isInteger(params.quantity)) {
        return { success: false, error: 'INVALID_QUANTITY' };
      }

      // Group validation: must confirm at least 1 female attendee
      if (params.categoryCode === 'group' && !params.groupFemaleVerified) {
        return { success: false, error: 'GROUP_REQUIRES_FEMALE_VERIFICATION' };
      }

      const totalAttendeesRequested = category.attendeesPerTicket * params.quantity;
      const expectedAmountPaise = category.pricePaise * params.quantity;

      // Check current capacity
      const now = new Date();
      let currentlyAllocated = 0;

      for (const order of this.orders.values()) {
        if (order.paymentStatus === 'SUCCESS') {
          currentlyAllocated += order.totalAttendees;
        } else if (
          (order.paymentStatus === 'RESERVED' || order.paymentStatus === 'PENDING') &&
          order.reservationExpiresAt > now
        ) {
          currentlyAllocated += order.totalAttendees;
        }
      }

      if (currentlyAllocated + totalAttendeesRequested > this.event.maxCapacity) {
        return {
          success: false,
          error: 'CAPACITY_EXCEEDED',
        };
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const orderRef = generateOrderReference();
      const expiryMinutes = params.expiryMinutes || 10;
      const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

      const newOrder: Order = {
        id: orderId,
        orderReference: orderRef,
        categoryCode: params.categoryCode,
        quantity: params.quantity,
        totalAttendees: totalAttendeesRequested,
        amountPaise: expectedAmountPaise,
        currency: 'INR',
        customerName: params.customerName.trim(),
        customerEmail: params.customerEmail.trim().toLowerCase(),
        customerPhone: params.customerPhone.trim(),
        attendeeDetails: params.attendeeDetails || [],
        groupFemaleVerified: Boolean(params.groupFemaleVerified),
        paymentStatus: 'RESERVED',
        reservationExpiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      };

      this.orders.set(orderId, newOrder);
      this.ordersByReference.set(orderRef, orderId);

      return {
        success: true,
        order: { ...newOrder },
      };
    });
  }

  // 3. PAYMENT CONFIRMATION & PASS ISSUANCE
  /**
   * Confirms payment and issues EXACTLY ONE QR Gate Pass for the booking.
   * Idempotent: repeated calls return the existing valid pass.
   */
  public async confirmPaymentAndIssuePass(params: {
    orderId: string;
    phonepeTransactionId: string;
    phonepeProviderReference?: string;
  }): Promise<{
    success: boolean;
    order?: Order;
    pass?: GatePass;
    error?: string;
  }> {
    return this.acquireLock(async () => {
      const order = this.orders.get(params.orderId);
      if (!order) {
        return { success: false, error: 'ORDER_NOT_FOUND' };
      }

      // Check if already paid and pass already issued (idempotent)
      if (order.paymentStatus === 'SUCCESS') {
        const passId = this.passesByOrderId.get(order.id);
        const existingPass = passId ? this.passes.get(passId) : undefined;
        return {
          success: true,
          order: { ...order },
          pass: existingPass ? { ...existingPass } : undefined,
        };
      }

      const now = new Date();

      // Check if reservation expired
      if (order.reservationExpiresAt < now) {
        // Safe reconciliation check: does capacity still exist?
        let confirmedAttendees = 0;
        for (const o of this.orders.values()) {
          if (o.paymentStatus === 'SUCCESS') confirmedAttendees += o.totalAttendees;
        }
        if (confirmedAttendees + order.totalAttendees > this.event.maxCapacity) {
          order.paymentStatus = 'EXPIRED';
          order.updatedAt = now;
          return {
            success: false,
            error: 'LATE_PAYMENT_CAPACITY_LOST_RECONCILIATION_REQUIRED',
            order: { ...order },
          };
        }
      }

      // Update Order
      order.paymentStatus = 'SUCCESS';
      order.phonepeTransactionId = params.phonepeTransactionId;
      order.phonepeProviderReference = params.phonepeProviderReference;
      order.paidAt = now;
      order.updatedAt = now;

      // Generate 1 QR Gate Pass per booking
      const qrToken = generateSecureToken(`RIT_${order.categoryCode.toUpperCase()}`);
      const qrHash = hashToken(qrToken);
      const passId = `pass_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const gatePass: GatePass = {
        id: passId,
        orderId: order.id,
        bookingReference: order.orderReference,
        qrToken,
        qrTokenHash: qrHash,
        categoryCode: order.categoryCode,
        totalAttendees: order.totalAttendees,
        admittedCount: 0,
        status: 'VALID',
        issuedAt: now,
        updatedAt: now,
      };

      this.passes.set(passId, gatePass);
      this.passesByTokenHash.set(qrHash, passId);
      this.passesByOrderId.set(order.id, passId);

      return {
        success: true,
        order: { ...order },
        pass: { ...gatePass },
      };
    });
  }

  // 4. ATOMIC CHECK-IN SCANNING (Mobile Staff Gate)
  /**
   * Atomic check-in for QR Gate Pass.
   * Supports partial entry (e.g. 2 of 4 enter first, remaining 2 enter later).
   * Rejects if all attendees already checked in or if pass is invalid/unpaid/revoked.
   */
  public async recordCheckIn(params: {
    tokenOrHash: string;
    staffId: string;
    staffName: string;
    admitCount?: number;
  }): Promise<CheckInResult> {
    return this.acquireLock(async () => {
      const input = params.tokenOrHash.trim();
      // Look up by direct hash or by hashing the raw token
      let passId = this.passesByTokenHash.get(input);
      if (!passId) {
        const computedHash = hashToken(input);
        passId = this.passesByTokenHash.get(computedHash);
      }

      if (!passId) {
        return {
          success: false,
          resultCode: 'INVALID_PASS',
          message: 'Invalid ticket pass or unrecognized QR code.',
          previouslyAdmitted: 0,
          nowAdmitted: 0,
          totalAllowed: 0,
          remaining: 0,
        };
      }

      const pass = this.passes.get(passId)!;
      const order = this.orders.get(pass.orderId)!;

      // Status check
      if (pass.status === 'CANCELLED' || pass.status === 'REFUNDED' || pass.status === 'REVOKED') {
        return {
          success: false,
          resultCode: pass.status as any,
          message: `Ticket pass is ${pass.status}. Entry forbidden.`,
          bookingReference: pass.bookingReference,
          categoryCode: pass.categoryCode,
          customerName: order.customerName,
          previouslyAdmitted: pass.admittedCount,
          nowAdmitted: 0,
          totalAllowed: pass.totalAttendees,
          remaining: Math.max(0, pass.totalAttendees - pass.admittedCount),
        };
      }

      if (order.paymentStatus !== 'SUCCESS') {
        return {
          success: false,
          resultCode: 'UNPAID',
          message: 'Booking payment is unverified or failed.',
          bookingReference: pass.bookingReference,
          categoryCode: pass.categoryCode,
          customerName: order.customerName,
          previouslyAdmitted: pass.admittedCount,
          nowAdmitted: 0,
          totalAllowed: pass.totalAttendees,
          remaining: Math.max(0, pass.totalAttendees - pass.admittedCount),
        };
      }

      // Check if already completely admitted
      if (pass.admittedCount >= pass.totalAttendees) {
        const firstCheckIn = this.checkIns.find((c) => c.passId === pass.id);
        return {
          success: false,
          resultCode: 'ALL_ATTENDEES_CHECKED_IN',
          message: `All ${pass.totalAttendees} attendees on this pass have already entered.`,
          bookingReference: pass.bookingReference,
          categoryCode: pass.categoryCode,
          customerName: order.customerName,
          previouslyAdmitted: pass.admittedCount,
          nowAdmitted: 0,
          totalAllowed: pass.totalAttendees,
          remaining: 0,
          firstCheckInTime: firstCheckIn?.scanTimestamp,
        };
      }

      const admitRequested = params.admitCount ?? 1;
      if (admitRequested < 1) {
        return {
          success: false,
          resultCode: 'INVALID_PASS',
          message: 'Admit count must be at least 1.',
          previouslyAdmitted: pass.admittedCount,
          nowAdmitted: 0,
          totalAllowed: pass.totalAttendees,
          remaining: pass.totalAttendees - pass.admittedCount,
        };
      }

      const remainingSlots = pass.totalAttendees - pass.admittedCount;
      if (admitRequested > remainingSlots) {
        return {
          success: false,
          resultCode: 'EXCEEDS_REMAINING_ALLOWANCE',
          message: `Cannot admit ${admitRequested} people. Only ${remainingSlots} attendee slot(s) remaining on this pass.`,
          bookingReference: pass.bookingReference,
          categoryCode: pass.categoryCode,
          customerName: order.customerName,
          previouslyAdmitted: pass.admittedCount,
          nowAdmitted: 0,
          totalAllowed: pass.totalAttendees,
          remaining: remainingSlots,
        };
      }

      // Atomically update pass
      const previouslyAdmitted = pass.admittedCount;
      const newAdmitted = previouslyAdmitted + admitRequested;
      pass.admittedCount = newAdmitted;
      pass.updatedAt = new Date();

      if (newAdmitted >= pass.totalAttendees) {
        pass.status = 'ALL_ENTERED';
      }

      // Record audit check-in
      const checkInRecord: CheckInRecord = {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        passId: pass.id,
        staffId: params.staffId,
        staffName: params.staffName,
        attendeesAdmitted: admitRequested,
        admittedTotalAfterScan: newAdmitted,
        scanTimestamp: new Date(),
      };
      this.checkIns.push(checkInRecord);

      return {
        success: true,
        resultCode: 'ENTRY_ACCEPTED',
        message:
          newAdmitted >= pass.totalAttendees
            ? `ENTRY ACCEPTED: Admitted ${admitRequested}. All ${pass.totalAttendees} attendees now entered.`
            : `ENTRY ACCEPTED: Admitted ${admitRequested}. ${pass.totalAttendees - newAdmitted} attendees remaining.`,
        bookingReference: pass.bookingReference,
        categoryCode: pass.categoryCode,
        customerName: order.customerName,
        previouslyAdmitted,
        nowAdmitted: admitRequested,
        totalAllowed: pass.totalAttendees,
        remaining: pass.totalAttendees - newAdmitted,
      };
    });
  }

  // 5. LOOKUP HELPERS
  public getOrderByReference(reference: string): Order | undefined {
    const orderId = this.ordersByReference.get(reference.toUpperCase().trim());
    return orderId ? this.orders.get(orderId) : undefined;
  }

  public getOrderById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  public getPassByOrderId(orderId: string): GatePass | undefined {
    const passId = this.passesByOrderId.get(orderId);
    return passId ? this.passes.get(passId) : undefined;
  }

  public getPassByToken(token: string): GatePass | undefined {
    const hash = hashToken(token.trim());
    const passId = this.passesByTokenHash.get(hash);
    return passId ? this.passes.get(passId) : undefined;
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getAllPasses(): GatePass[] {
    return Array.from(this.passes.values());
  }

  public getCheckIns(): CheckInRecord[] {
    return [...this.checkIns];
  }

  // 6. IDEMPOTENCY
  public isPaymentProcessed(transactionId: string): boolean {
    return this.idempotencyLogs.has(transactionId);
  }

  public recordIdempotency(log: PaymentIdempotency): void {
    this.idempotencyLogs.set(log.transactionId, log);
  }

  // 7. REVOCATION / REFUND
  public async revokePass(orderId: string, reason: 'CANCELLED' | 'REFUNDED' | 'REVOKED'): Promise<boolean> {
    return this.acquireLock(() => {
      const passId = this.passesByOrderId.get(orderId);
      const pass = passId ? this.passes.get(passId) : undefined;
      const order = this.orders.get(orderId);

      if (pass) {
        pass.status = reason;
        pass.updatedAt = new Date();
      }
      if (order) {
        order.paymentStatus = 'REFUNDED';
        order.updatedAt = new Date();
      }
      return true;
    });
  }

  // For testing reset
  public reset(): void {
    this.orders.clear();
    this.ordersByReference.clear();
    this.passes.clear();
    this.passesByTokenHash.clear();
    this.passesByOrderId.clear();
    this.checkIns = [];
    this.idempotencyLogs.clear();
  }
}

// Global singleton instance
export const db = new EventStore();
