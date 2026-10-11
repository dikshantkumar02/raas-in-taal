import fs from 'node:fs';
import path from 'node:path';
import { EventConfig, GatePass, Order, TicketCategory, TicketCategoryCode, CheckInRecord, CheckInResult, PaymentIdempotency, Customer, StaffAccount, StaffTicketLookupResult } from './types';
import { generateOrderReference, generateSecureToken, hashToken, hashPassword, verifyPassword, safeCompare } from '../security/crypto';
import { supabaseAdmin } from './supabase';

// In-memory persistent database engine (can synchronize with Supabase PostgreSQL)
class EventStore {
  private persistPath = path.join(process.cwd(), '.db_state.json');

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
    instagramHandle: '@_chaos_and_chill',
    instagramUrl: 'https://instagram.com/_chaos_and_chill_',
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
  private customers: Map<string, Customer> = new Map(); // email -> Customer
  private staffAccounts: Map<string, StaffAccount> = new Map(); // id -> StaffAccount
  private staffByUsername: Map<string, string> = new Map(); // username -> id

  // Concurrency lock simulation for atomic operations
  private lockPromise: Promise<void> = Promise.resolve();

  constructor() {
    this.loadFromDisk();
    this.seedDefaultStaffAccounts();
    if (supabaseAdmin) {
      this.syncFromSupabase().catch(() => {});
    }
  }

  public async syncFromSupabase(): Promise<void> {
    if (!supabaseAdmin) return;
    try {
      const [ordersRes, passesRes, checkInsRes, customersRes, staffRes] = await Promise.all([
        supabaseAdmin.from('orders').select('*'),
        supabaseAdmin.from('passes').select('*'),
        supabaseAdmin.from('check_ins').select('*'),
        supabaseAdmin.from('customers').select('*'),
        supabaseAdmin.from('staff_accounts').select('*'),
      ]);

      if (ordersRes.data) {
        for (const row of ordersRes.data) {
          const ord: Order = {
            id: row.id,
            orderReference: row.order_reference,
            categoryCode: row.category_code,
            quantity: row.quantity,
            totalAttendees: row.total_attendees,
            amountPaise: row.amount_paise,
            currency: row.currency || 'INR',
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            attendeeDetails: row.attendee_details || [],
            groupFemaleVerified: Boolean(row.group_female_verified),
            paymentStatus: row.payment_status,
            reservationExpiresAt: new Date(row.reservation_expires_at),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            phonepeTransactionId: row.phonepe_transaction_id,
            phonepeProviderReference: row.phonepe_provider_reference,
            paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
          };
          this.orders.set(ord.id, ord);
          this.ordersByReference.set(ord.orderReference.toUpperCase().trim(), ord.id);
        }
      }

      if (passesRes.data) {
        for (const row of passesRes.data) {
          const p: GatePass = {
            id: row.id,
            orderId: row.order_id,
            bookingReference: row.booking_reference,
            qrToken: row.qr_token,
            qrTokenHash: row.qr_token_hash,
            categoryCode: row.category_code,
            totalAttendees: row.total_attendees,
            admittedCount: row.admitted_count,
            status: row.status,
            issuedAt: new Date(row.issued_at || row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          this.passes.set(p.id, p);
          this.passesByOrderId.set(p.orderId, p.id);
          this.passesByTokenHash.set(p.qrTokenHash, p.id);
        }
      }

      if (checkInsRes.data) {
        for (const row of checkInsRes.data) {
          this.checkIns.push({
            id: row.id,
            passId: row.pass_id,
            staffId: row.staff_id,
            staffName: row.staff_name,
            attendeesAdmitted: row.attendees_admitted,
            admittedTotalAfterScan: row.admitted_total_after_scan,
            scanTimestamp: new Date(row.scan_timestamp),
            notes: row.notes,
          });
        }
      }

      if (customersRes.data) {
        for (const row of customersRes.data) {
          this.customers.set(row.email.toLowerCase().trim(), {
            id: row.id,
            email: row.email,
            name: row.name,
            phone: row.phone,
            passwordHash: row.password_hash,
            createdAt: new Date(row.created_at),
          });
        }
      }

      if (staffRes.data) {
        for (const row of staffRes.data) {
          this.staffAccounts.set(row.id, {
            id: row.id,
            username: row.username,
            name: row.name,
            pinHash: row.pin_hash,
            role: row.role as any,
            gateLocation: row.gate_location,
            isActive: Boolean(row.is_active),
            createdAt: new Date(row.created_at),
          });
          this.staffByUsername.set(row.username.toLowerCase(), row.id);
        }
      }
    } catch (err) {
      // Non-fatal: memory cache keeps running safely
      console.warn('[Supabase Sync Notice]', err);
    }
  }

  private seedDefaultStaffAccounts(): void {
    if (this.staffAccounts.size > 0) return;
    const defaultPin = process.env.STAFF_PIN || '202618';
    const hashedPin = hashPassword(defaultPin);

    const defaultStaff: StaffAccount[] = [
      {
        id: 'staff_gate_1',
        username: 'gate1',
        name: 'Officer Vikram (Gate 1)',
        pinHash: hashedPin,
        role: 'staff',
        gateLocation: 'Main Arena Gate 1',
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'staff_gate_2',
        username: 'gate2',
        name: 'Officer Ananya (Gate 2)',
        pinHash: hashedPin,
        role: 'staff',
        gateLocation: 'VIP Entry Gate 2',
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'staff_supervisor',
        username: 'supervisor',
        name: 'Gate Supervisor',
        pinHash: hashedPin,
        role: 'gate_supervisor',
        gateLocation: 'All Gates / Helpdesk',
        isActive: true,
        createdAt: new Date(),
      },
    ];

    for (const s of defaultStaff) {
      this.staffAccounts.set(s.id, s);
      this.staffByUsername.set(s.username.toLowerCase(), s.id);
    }
  }

  private saveToDisk(): void {
    try {
      const state = {
        orders: Array.from(this.orders.entries()),
        passes: Array.from(this.passes.entries()),
        checkIns: this.checkIns,
        idempotencyLogs: Array.from(this.idempotencyLogs.entries()),
        customers: Array.from(this.customers.entries()),
        staffAccounts: Array.from(this.staffAccounts.entries()),
      };
      const tmpPath = `${this.persistPath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.persistPath);
    } catch { }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, 'utf-8');
        const state = JSON.parse(raw);
        if (state.orders && Array.isArray(state.orders)) {
          for (const [id, ord] of state.orders) {
            ord.reservationExpiresAt = new Date(ord.reservationExpiresAt);
            ord.createdAt = new Date(ord.createdAt);
            ord.updatedAt = new Date(ord.updatedAt);
            if (ord.paidAt) ord.paidAt = new Date(ord.paidAt);
            this.orders.set(id, ord);
            this.ordersByReference.set(ord.orderReference.toUpperCase().trim(), id);
          }
        }
        if (state.passes && Array.isArray(state.passes)) {
          for (const [id, p] of state.passes) {
            p.issuedAt = new Date(p.issuedAt);
            p.updatedAt = new Date(p.updatedAt);
            this.passes.set(id, p);
            this.passesByTokenHash.set(p.qrTokenHash, id);
            this.passesByOrderId.set(p.orderId, id);
          }
        }
        if (state.checkIns && Array.isArray(state.checkIns)) {
          this.checkIns = state.checkIns.map((c: any) => ({
            ...c,
            scanTimestamp: new Date(c.scanTimestamp),
          }));
        }
        if (state.customers && Array.isArray(state.customers)) {
          for (const [email, c] of state.customers) {
            c.createdAt = new Date(c.createdAt);
            this.customers.set(email.toLowerCase().trim(), c);
          }
        }
        if (state.staffAccounts && Array.isArray(state.staffAccounts)) {
          for (const [id, s] of state.staffAccounts) {
            s.createdAt = new Date(s.createdAt);
            if (s.lastLoginAt) s.lastLoginAt = new Date(s.lastLoginAt);
            this.staffAccounts.set(id, s);
            this.staffByUsername.set(s.username.toLowerCase(), id);
          }
        }
      }
    } catch { }
  }

  private async acquireLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void = () => { };
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
    customReference?: string;
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
      const orderRef = params.customReference || generateOrderReference();
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
      this.ordersByReference.set(orderRef.toUpperCase().trim(), orderId);
      this.saveToDisk();

      if (supabaseAdmin) {
        supabaseAdmin
          .from('orders')
          .upsert({
            id: orderId,
            order_reference: orderRef,
            category_code: params.categoryCode,
            quantity: params.quantity,
            total_attendees: totalAttendeesRequested,
            amount_paise: expectedAmountPaise,
            currency: 'INR',
            customer_name: params.customerName.trim(),
            customer_email: params.customerEmail.trim().toLowerCase(),
            customer_phone: params.customerPhone.trim(),
            attendee_details: params.attendeeDetails || [],
            group_female_verified: Boolean(params.groupFemaleVerified),
            payment_status: 'RESERVED',
            reservation_expires_at: expiresAt.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .then(
            () => {},
            (err: unknown) => console.warn('[Supabase Order Upsert Warning]', err)
          );
      }

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
    phonepeTransactionId?: string;
    phonepeProviderReference?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
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
          this.saveToDisk();
          return {
            success: false,
            error: 'LATE_PAYMENT_CAPACITY_LOST_RECONCILIATION_REQUIRED',
            order: { ...order },
          };
        }
      }

      // Update Order
      order.paymentStatus = 'SUCCESS';
      if (params.phonepeTransactionId) order.phonepeTransactionId = params.phonepeTransactionId;
      if (params.phonepeProviderReference) order.phonepeProviderReference = params.phonepeProviderReference;
      if (params.razorpayOrderId) order.razorpayOrderId = params.razorpayOrderId;
      if (params.razorpayPaymentId) order.razorpayPaymentId = params.razorpayPaymentId;
      if (params.razorpaySignature) order.razorpaySignature = params.razorpaySignature;
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
      this.saveToDisk();

      if (supabaseAdmin) {
        Promise.all([
          supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'SUCCESS',
              phonepe_transaction_id: params.phonepeTransactionId,
              phonepe_provider_reference: params.phonepeProviderReference,
              paid_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', order.id),
          supabaseAdmin.from('passes').upsert({
            id: gatePass.id,
            order_id: gatePass.orderId,
            booking_reference: gatePass.bookingReference,
            qr_token: gatePass.qrToken,
            qr_token_hash: gatePass.qrTokenHash,
            category_code: gatePass.categoryCode,
            total_attendees: gatePass.totalAttendees,
            admitted_count: gatePass.admittedCount,
            status: gatePass.status,
            issued_at: gatePass.issuedAt.toISOString(),
            updated_at: gatePass.updatedAt.toISOString(),
          }),
        ]).catch((err) => console.warn('[Supabase Payment Confirm Warning]', err));
      }

      return {
        success: true,
        order: { ...order },
        pass: { ...gatePass },
      };
    });
  }

  // 4. ATOMIC CHECK-IN SCANNING (Mobile Staff Gate)
  public async recordCheckIn(params: {
    tokenOrHash: string;
    staffId: string;
    staffName: string;
    admitCount?: number;
  }): Promise<CheckInResult> {
    return this.acquireLock(async () => {
      const input = params.tokenOrHash.trim();
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
      this.saveToDisk();

      if (supabaseAdmin) {
        Promise.all([
          supabaseAdmin
            .from('passes')
            .update({
              admitted_count: newAdmitted,
              status: pass.status,
              updated_at: pass.updatedAt.toISOString(),
            })
            .eq('id', pass.id),
          supabaseAdmin.from('check_ins').insert({
            id: checkInRecord.id,
            pass_id: pass.id,
            staff_id: params.staffId,
            staff_name: params.staffName,
            attendees_admitted: admitRequested,
            admitted_total_after_scan: newAdmitted,
            scan_timestamp: checkInRecord.scanTimestamp.toISOString(),
          }),
        ]).catch((err) => console.warn('[Supabase CheckIn Warning]', err));
      }

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
    const clean = decodeURIComponent(reference || '').toUpperCase().trim();
    const orderId = this.ordersByReference.get(clean);
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

  public async getOrderByReferenceAsync(reference: string): Promise<Order | undefined> {
    const mem = this.getOrderByReference(reference);
    if (mem) return mem;

    if (supabaseAdmin) {
      try {
        const clean = decodeURIComponent(reference || '').toUpperCase().trim();
        const { data } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('order_reference', clean)
          .maybeSingle();

        if (data) {
          const ord: Order = {
            id: data.id,
            orderReference: data.order_reference,
            categoryCode: data.category_code,
            quantity: data.quantity,
            totalAttendees: data.total_attendees,
            amountPaise: data.amount_paise,
            currency: data.currency || 'INR',
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            customerPhone: data.customer_phone,
            attendeeDetails: data.attendee_details || [],
            groupFemaleVerified: Boolean(data.group_female_verified),
            paymentStatus: data.payment_status,
            reservationExpiresAt: new Date(data.reservation_expires_at),
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            phonepeTransactionId: data.phonepe_transaction_id,
            phonepeProviderReference: data.phonepe_provider_reference,
            paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
          };
          this.orders.set(ord.id, ord);
          this.ordersByReference.set(ord.orderReference.toUpperCase().trim(), ord.id);
          return ord;
        }
      } catch (err) {
        console.warn('[Supabase Async Lookup Warning]', err);
      }
    }
    return undefined;
  }

  public async getPassByTokenAsync(token: string): Promise<GatePass | undefined> {
    const mem = this.getPassByToken(token);
    if (mem) return mem;

    if (supabaseAdmin) {
      try {
        const hash = hashToken(token.trim());
        const { data } = await supabaseAdmin
          .from('passes')
          .select('*')
          .or(`qr_token.eq.${token.trim()},qr_token_hash.eq.${hash}`)
          .maybeSingle();

        if (data) {
          const p: GatePass = {
            id: data.id,
            orderId: data.order_id,
            bookingReference: data.booking_reference,
            qrToken: data.qr_token,
            qrTokenHash: data.qr_token_hash,
            categoryCode: data.category_code,
            totalAttendees: data.total_attendees,
            admittedCount: data.admitted_count,
            status: data.status,
            issuedAt: new Date(data.issued_at || data.created_at),
            updatedAt: new Date(data.updated_at),
          };
          this.passes.set(p.id, p);
          this.passesByOrderId.set(p.orderId, p.id);
          this.passesByTokenHash.set(p.qrTokenHash, p.id);
          return p;
        }
      } catch (err) {
        console.warn('[Supabase Pass Lookup Warning]', err);
      }
    }
    return undefined;
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
    this.saveToDisk();
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
      this.saveToDisk();
      return true;
    });
  }

  // 8. CUSTOMER AUTH & BOOKINGS
  public async registerCustomer(params: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ success: boolean; customer?: Omit<Customer, 'passwordHash'>; error?: string }> {
    return this.acquireLock(() => {
      const email = params.email.trim().toLowerCase();
      if (!email || !params.password || !params.name) {
        return { success: false, error: 'Name, email, and password are required.' };
      }
      if (this.customers.has(email)) {
        return { success: false, error: 'An account with this email already exists. Please log in.' };
      }

      const customer: Customer = {
        id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: params.name.trim(),
        email,
        phone: params.phone.trim(),
        passwordHash: hashPassword(params.password),
        createdAt: new Date(),
      };

      this.customers.set(email, customer);
      this.saveToDisk();

      if (supabaseAdmin) {
        supabaseAdmin
          .from('customers')
          .upsert({
            id: customer.id,
            email,
            name: customer.name,
            phone: customer.phone,
            password_hash: customer.passwordHash,
            created_at: customer.createdAt.toISOString(),
          })
          .then(
            () => {},
            (err: unknown) => console.warn('[Supabase Customer Warning]', err)
          );
      }

      const { passwordHash: _, ...safe } = customer;
      return { success: true, customer: safe };
    });
  }

  public verifyCustomer(email: string, password: string): { success: boolean; customer?: Omit<Customer, 'passwordHash'>; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const customer = this.customers.get(cleanEmail);
    if (!customer) {
      return { success: false, error: 'No account found with this email. Please sign up.' };
    }

    if (!verifyPassword(password, customer.passwordHash)) {
      return { success: false, error: 'Incorrect password.' };
    }

    const { passwordHash: _, ...safe } = customer;
    return { success: true, customer: safe };
  }

  public getCustomerByEmail(email: string): Omit<Customer, 'passwordHash'> | undefined {
    const customer = this.customers.get(email.trim().toLowerCase());
    if (!customer) return undefined;
    const { passwordHash: _, ...safe } = customer;
    return safe;
  }

  public getCustomerBookings(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const results: Array<Order & { passQrToken?: string }> = [];

    for (const order of this.orders.values()) {
      if (order.customerEmail.toLowerCase() === cleanEmail) {
        const passId = this.passesByOrderId.get(order.id);
        const pass = passId ? this.passes.get(passId) : undefined;
        results.push({
          ...order,
          passQrToken: pass?.qrToken,
        });
      }
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 6. STAFF PORTAL AUTHENTICATION & MANAGEMENT
  public verifyStaff(
    identifier: string,
    pin: string
  ): { success: boolean; staff?: Omit<StaffAccount, 'pinHash'>; error?: string } {
    const cleanId = (identifier || '').trim().toLowerCase();
    let staffId = this.staffByUsername.get(cleanId);
    let staff = staffId ? this.staffAccounts.get(staffId) : undefined;

    // Fallback: If officer supplied PIN without username or generic 'staff' / 'gate'
    if (!staff && (!cleanId || cleanId === 'staff' || cleanId === 'gate' || cleanId === 'gate1')) {
      staff = this.staffAccounts.get('staff_gate_1');
    }

    if (!staff) {
      return { success: false, error: 'Staff account not found.' };
    }

    if (!staff.isActive) {
      return { success: false, error: 'Staff account has been revoked or deactivated.' };
    }

    const expectedPin = process.env.STAFF_PIN || '202618';
    const isValidPin =
      verifyPassword(pin, staff.pinHash) ||
      safeCompare(pin, expectedPin);

    if (!isValidPin) {
      return { success: false, error: 'Invalid Staff PIN.' };
    }

    staff.lastLoginAt = new Date();
    this.saveToDisk();

    const { pinHash: _, ...safeStaff } = staff;
    return { success: true, staff: safeStaff };
  }

  public getStaffById(id: string): Omit<StaffAccount, 'pinHash'> | null {
    const staff = this.staffAccounts.get(id);
    if (!staff) return null;
    const { pinHash: _, ...safeStaff } = staff;
    return safeStaff;
  }

  public revokeStaff(id: string): boolean {
    const staff = this.staffAccounts.get(id);
    if (!staff) return false;
    staff.isActive = false;
    this.saveToDisk();
    return true;
  }

  public provisionStaff(account: {
    username: string;
    name: string;
    pin: string;
    role?: 'staff' | 'gate_supervisor';
    gateLocation?: string;
  }): Omit<StaffAccount, 'pinHash'> {
    const id = `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newStaff: StaffAccount = {
      id,
      username: account.username.toLowerCase().trim(),
      name: account.name.trim(),
      pinHash: hashPassword(account.pin),
      role: account.role || 'staff',
      gateLocation: account.gateLocation || 'General Gate',
      isActive: true,
      createdAt: new Date(),
    };
    this.staffAccounts.set(id, newStaff);
    this.staffByUsername.set(newStaff.username, id);
    this.saveToDisk();

    const { pinHash: _, ...safeStaff } = newStaff;
    return safeStaff;
  }

  // 7. PRIVACY-PRESERVING STAFF TICKET LOOKUP
  public getTicketStatusForStaff(query: string): StaffTicketLookupResult | null {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    let passId = this.passesByTokenHash.get(cleanQuery);
    if (!passId) {
      passId = this.passesByTokenHash.get(hashToken(cleanQuery));
    }
    if (!passId) {
      // Lookup by booking reference
      const orderId = this.ordersByReference.get(cleanQuery.toUpperCase());
      if (orderId) {
        passId = this.passesByOrderId.get(orderId);
      }
    }

    if (!passId) return null;
    const pass = this.passes.get(passId);
    if (!pass) return null;
    const order = this.orders.get(pass.orderId);
    if (!order) return null;

    // Return minimal staff-necessary data (no phone, no email, no amounts paid)
    return {
      valid: pass.status === 'VALID' || pass.status === 'ALL_ENTERED',
      status: pass.status,
      bookingReference: pass.bookingReference,
      categoryCode: pass.categoryCode,
      customerName: order.customerName,
      totalAttendees: pass.totalAttendees,
      admittedCount: pass.admittedCount,
      remaining: Math.max(0, pass.totalAttendees - pass.admittedCount),
      attendeeNames: order.attendeeDetails?.map((a) => a.name).filter(Boolean),
      issuedAt: pass.issuedAt,
    };
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
    this.customers.clear();
    this.staffAccounts.clear();
    this.staffByUsername.clear();
    this.seedDefaultStaffAccounts();
    try {
      if (fs.existsSync(this.persistPath)) fs.unlinkSync(this.persistPath);
    } catch { }
  }
}

// Global singleton instance
export const db = new EventStore();
