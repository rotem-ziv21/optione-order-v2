-- Add payment-related columns to customer_orders table
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add index on status for better performance
CREATE INDEX IF NOT EXISTS idx_customer_orders_status
ON customer_orders (status);

-- Add index on transaction_id for better performance
CREATE INDEX IF NOT EXISTS idx_customer_orders_transaction_id
ON customer_orders (transaction_id);

-- Add constraint to validate status values
ALTER TABLE customer_orders
ADD CONSTRAINT customer_orders_status_check
CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded'));
