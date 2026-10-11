-- =============================================================================
-- RAAS IN TAAL — INCREMENTAL SAFE MIGRATION
-- Adds customer_id and Razorpay references to orders, and created_at to passes.
-- Non-destructive: preserves all existing tables, RLS policies, and data.
-- =============================================================================

-- 1. Add customer_id and razorpay tracking columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- 2. Create index for fast customer booking lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);

-- 3. Add created_at to passes if missing
ALTER TABLE passes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
