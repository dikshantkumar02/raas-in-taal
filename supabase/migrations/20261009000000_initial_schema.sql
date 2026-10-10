-- =============================================================================
-- RAAS IN TAAL — EVENT TICKETING SYSTEM DATABASE SCHEMA
-- Target: Supabase PostgreSQL
-- Features: Strict 500-attendee capacity, atomic reservation, 1 QR pass per booking,
--           partial check-in tracking, RLS policies, staff & admin audit trails.
-- =============================================================================

-- Enable pgcrypto for secure random UUIDs and token hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. EVENT CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL DEFAULT 'raas-in-taal-2026',
    name TEXT NOT NULL DEFAULT 'Raas in Taal',
    brand TEXT NOT NULL DEFAULT 'Chaos and Chill',
    venue TEXT NOT NULL DEFAULT 'Khelcity Multi-Sports Arena, Shivam Nagar, Jagatpura, Jaipur, Rajasthan',
    event_date DATE NOT NULL DEFAULT '2026-10-18',
    durga_puja_time TIME NOT NULL DEFAULT '17:30',
    dandiya_night_time TIME NOT NULL DEFAULT '18:00',
    max_attendee_capacity INTEGER NOT NULL DEFAULT 500 CHECK (max_attendee_capacity > 0),
    contact_phone_1 TEXT NOT NULL DEFAULT '8003022503',
    contact_phone_2 TEXT NOT NULL DEFAULT '8278695419',
    instagram_handle TEXT NOT NULL DEFAULT '@chaos_and_chill',
    instagram_url TEXT NOT NULL DEFAULT 'https://instagram.com/chaos_and_chill',
    refund_policy TEXT NOT NULL DEFAULT 'Tickets once booked are strictly non-refundable and non-transferable except in the event of official cancellation by organizers.',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TICKET CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- 'stag_girls', 'couple', 'group', 'family'
    name TEXT NOT NULL,
    price_paise INTEGER NOT NULL CHECK (price_paise > 0),
    attendees_per_ticket INTEGER NOT NULL CHECK (attendees_per_ticket >= 1),
    description TEXT NOT NULL,
    eligibility_rule TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default Ticket Categories
INSERT INTO ticket_categories (code, name, price_paise, attendees_per_ticket, description, eligibility_rule, display_order)
VALUES
    ('stag_girls', 'Stag Girls', 24900, 1, 'Entry for 1 female attendee.', 'Strictly for female stags only.', 1),
    ('couple', 'Couple', 44900, 2, 'Entry for 1 couple (2 attendees).', 'Valid for 1 couple (Male + Female).', 2),
    ('group', 'Group (4 People)', 69900, 4, 'Entry for a squad of 4 people.', 'At least 1 female attendee is mandatory in the group.', 3),
    ('family', 'Family (4 Members)', 69900, 4, 'Entry for 4 family members.', 'Valid for family members including kids/adults.', 4)
ON CONFLICT (code) DO UPDATE SET
    price_paise = EXCLUDED.price_paise,
    attendees_per_ticket = EXCLUDED.attendees_per_ticket,
    description = EXCLUDED.description,
    eligibility_rule = EXCLUDED.eligibility_rule;

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_reference TEXT UNIQUE NOT NULL, -- e.g. RIT-2026-AB12CD
    category_code TEXT NOT NULL REFERENCES ticket_categories(code),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    total_attendees INTEGER NOT NULL CHECK (total_attendees >= 1),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    attendee_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    group_female_verified BOOLEAN NOT NULL DEFAULT FALSE,
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'RESERVED', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED')),
    phonepe_transaction_id TEXT UNIQUE,
    phonepe_provider_reference TEXT,
    reservation_expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_reservation ON orders(payment_status, reservation_expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(order_reference);

-- 4. QR GATE PASSES TABLE (ONE PASS PER BOOKING)
CREATE TABLE IF NOT EXISTS passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    booking_reference TEXT UNIQUE NOT NULL,
    qr_token TEXT UNIQUE NOT NULL, -- Secret cryptographic token encoded in QR code
    qr_token_hash TEXT UNIQUE NOT NULL, -- SHA256 hash for secure server lookups
    category_code TEXT NOT NULL REFERENCES ticket_categories(code),
    total_attendees INTEGER NOT NULL CHECK (total_attendees >= 1),
    admitted_count INTEGER NOT NULL DEFAULT 0 CHECK (admitted_count >= 0),
    status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID', 'ALL_ENTERED', 'CANCELLED', 'REFUNDED', 'REVOKED')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_admitted_limit CHECK (admitted_count <= total_attendees)
);

CREATE INDEX IF NOT EXISTS idx_passes_token_hash ON passes(qr_token_hash);
CREATE INDEX IF NOT EXISTS idx_passes_order_id ON passes(order_id);

-- 5. CHECK-INS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID NOT NULL REFERENCES passes(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    attendees_admitted INTEGER NOT NULL CHECK (attendees_admitted >= 1),
    admitted_total_after_scan INTEGER NOT NULL,
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_check_ins_pass_id ON check_ins(pass_id);

-- 6. WEBHOOK & CALLBACK IDEMPOTENCY LOG
CREATE TABLE IF NOT EXISTS payment_idempotency_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'PHONEPE',
    raw_payload_hash TEXT NOT NULL,
    processed_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_id TEXT,
    ip_address TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ATOMIC DATABASE FUNCTIONS
-- =============================================================================

-- A. ATOMIC INVENTORY ALLOCATION (Enforces 500 Capacity with Row Lock)
CREATE OR REPLACE FUNCTION allocate_ticket_reservation(
    p_order_reference TEXT,
    p_category_code TEXT,
    p_quantity INTEGER,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_attendee_details JSONB,
    p_group_female_verified BOOLEAN,
    p_expiry_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
    success BOOLEAN,
    order_id UUID,
    allocated_attendees INTEGER,
    total_active_attendees INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_attendees_per_ticket INTEGER;
    v_price_paise INTEGER;
    v_needed_attendees INTEGER;
    v_current_active_attendees INTEGER;
    v_max_capacity INTEGER := 500;
    v_expires_at TIMESTAMPTZ;
    v_new_order_id UUID;
BEGIN
    -- 1. Fetch category properties
    SELECT attendees_per_ticket, price_paise
    INTO v_attendees_per_ticket, v_price_paise
    FROM ticket_categories
    WHERE code = p_category_code AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'INVALID_TICKET_CATEGORY';
        RETURN;
    END IF;

    -- Validate Group rule
    IF p_category_code = 'group' AND NOT p_group_female_verified THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'GROUP_REQUIRES_AT_LEAST_ONE_FEMALE';
        RETURN;
    END IF;

    v_needed_attendees := v_attendees_per_ticket * p_quantity;

    -- 2. Lock event row to serialize concurrency
    PERFORM id FROM events WHERE slug = 'raas-in-taal-2026' FOR UPDATE;

    -- 3. Calculate currently active attendees:
    -- Sum of all confirmed tickets (payment_status = 'SUCCESS')
    -- + Active reservations (payment_status IN ('PENDING', 'RESERVED') AND reservation_expires_at > NOW())
    SELECT COALESCE(SUM(total_attendees), 0)
    INTO v_current_active_attendees
    FROM orders
    WHERE payment_status = 'SUCCESS'
       OR (payment_status IN ('PENDING', 'RESERVED') AND reservation_expires_at > NOW());

    -- 4. Check if adding requested attendees exceeds the strict 500 limit
    IF (v_current_active_attendees + v_needed_attendees) > v_max_capacity THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, v_current_active_attendees, 'CAPACITY_EXCEEDED';
        RETURN;
    END IF;

    -- 5. Create the reservation
    v_expires_at := NOW() + (p_expiry_minutes || ' minutes')::INTERVAL;

    INSERT INTO orders (
        order_reference,
        category_code,
        quantity,
        total_attendees,
        amount_paise,
        currency,
        customer_name,
        customer_email,
        customer_phone,
        attendee_details,
        group_female_verified,
        payment_status,
        reservation_expires_at
    ) VALUES (
        p_order_reference,
        p_category_code,
        p_quantity,
        v_needed_attendees,
        v_price_paise * p_quantity,
        'INR',
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_attendee_details,
        p_group_female_verified,
        'RESERVED',
        v_expires_at
    )
    RETURNING id INTO v_new_order_id;

    RETURN QUERY SELECT TRUE, v_new_order_id, v_needed_attendees, (v_current_active_attendees + v_needed_attendees), NULL;
END;
$$;

-- B. ATOMIC CHECK-IN FUNCTION (One pass per booking, partial entry tracking)
CREATE OR REPLACE FUNCTION record_ticket_check_in(
    p_qr_token_hash TEXT,
    p_staff_id TEXT,
    p_staff_name TEXT,
    p_admit_count INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    result_code TEXT,
    message TEXT,
    booking_reference TEXT,
    category_code TEXT,
    customer_name TEXT,
    previously_admitted INTEGER,
    now_admitted INTEGER,
    total_allowed INTEGER,
    remaining INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pass RECORD;
    v_order RECORD;
    v_new_admitted INTEGER;
BEGIN
    -- 1. Fetch pass with exclusive row lock
    SELECT * INTO v_pass
    FROM passes
    WHERE qr_token_hash = p_qr_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'INVALID_PASS', 'Invalid ticket pass or wrong event', NULL, NULL, NULL, 0, 0, 0, 0;
        RETURN;
    END IF;

    -- 2. Fetch order
    SELECT * INTO v_order FROM orders WHERE id = v_pass.order_id;

    -- 3. Validate status
    IF v_pass.status IN ('CANCELLED', 'REFUNDED', 'REVOKED') THEN
        RETURN QUERY SELECT FALSE, v_pass.status, 'Ticket has been ' || v_pass.status, v_pass.booking_reference, v_pass.category_code, v_order.customer_name, v_pass.admitted_count, 0, v_pass.total_attendees, (v_pass.total_attendees - v_pass.admitted_count);
        RETURN;
    END IF;

    IF v_order.payment_status <> 'SUCCESS' THEN
        RETURN QUERY SELECT FALSE, 'UNPAID', 'Payment is unverified or failed', v_pass.booking_reference, v_pass.category_code, v_order.customer_name, v_pass.admitted_count, 0, v_pass.total_attendees, (v_pass.total_attendees - v_pass.admitted_count);
        RETURN;
    END IF;

    -- 4. Check if already completely admitted
    IF v_pass.admitted_count >= v_pass.total_attendees THEN
        RETURN QUERY SELECT FALSE, 'ALL_ATTENDEES_CHECKED_IN', 'All attendees on this pass have already entered', v_pass.booking_reference, v_pass.category_code, v_order.customer_name, v_pass.admitted_count, 0, v_pass.total_attendees, 0;
        RETURN;
    END IF;

    -- 5. Check if requested admit count exceeds remaining allowance
    IF (v_pass.admitted_count + p_admit_count) > v_pass.total_attendees THEN
        RETURN QUERY SELECT FALSE, 'EXCEEDS_REMAINING_ALLOWANCE', 'Cannot admit ' || p_admit_count || ' people. Only ' || (v_pass.total_attendees - v_pass.admitted_count) || ' slots remaining on this pass.', v_pass.booking_reference, v_pass.category_code, v_order.customer_name, v_pass.admitted_count, 0, v_pass.total_attendees, (v_pass.total_attendees - v_pass.admitted_count);
        RETURN;
    END IF;

    -- 6. Apply atomic update
    v_new_admitted := v_pass.admitted_count + p_admit_count;

    UPDATE passes
    SET admitted_count = v_new_admitted,
        status = CASE WHEN v_new_admitted >= v_pass.total_attendees THEN 'ALL_ENTERED' ELSE 'VALID' END,
        updated_at = NOW()
    WHERE id = v_pass.id;

    -- 7. Record check-in audit log
    INSERT INTO check_ins (
        pass_id,
        staff_id,
        staff_name,
        attendees_admitted,
        admitted_total_after_scan,
        scan_timestamp
    ) VALUES (
        v_pass.id,
        p_staff_id,
        p_staff_name,
        p_admit_count,
        v_new_admitted,
        NOW()
    );

    RETURN QUERY SELECT TRUE, 'ENTRY_ACCEPTED', 'Entry accepted successfully', v_pass.booking_reference, v_pass.category_code, v_order.customer_name, v_pass.admitted_count, p_admit_count, v_pass.total_attendees, (v_pass.total_attendees - v_new_admitted);
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency_log ENABLE ROW LEVEL SECURITY;

-- Public can read active events and ticket categories
CREATE POLICY "Public can view active event" ON events FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can view active categories" ON ticket_categories FOR SELECT USING (is_active = TRUE);

-- Customer can view only their own order if they know the order_reference or via server
CREATE POLICY "Public cannot arbitrarily view all orders" ON orders FOR SELECT USING (false);
CREATE POLICY "Public cannot modify orders" ON orders FOR ALL USING (false);

-- Passes and Check-ins are strictly protected; access via server API routes with verified auth
CREATE POLICY "Service and staff only for passes" ON passes FOR ALL USING (false);
CREATE POLICY "Service and staff only for check_ins" ON check_ins FOR ALL USING (false);

-- 8. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server only for customers" ON customers FOR ALL USING (false);

-- 9. STAFF ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS staff_accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    gate_location TEXT NOT NULL DEFAULT 'Main Gate',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_username ON staff_accounts(username);
ALTER TABLE staff_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server only for staff_accounts" ON staff_accounts FOR ALL USING (false);

