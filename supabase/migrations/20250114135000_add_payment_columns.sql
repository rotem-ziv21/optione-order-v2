-- Add payment-related columns
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_details JSONB,
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_orders_paid_at
ON customer_orders (paid_at);

CREATE INDEX IF NOT EXISTS idx_customer_orders_transaction_id
ON customer_orders (transaction_id);

CREATE INDEX IF NOT EXISTS idx_customer_orders_payment_details
ON customer_orders USING GIN (payment_details);
