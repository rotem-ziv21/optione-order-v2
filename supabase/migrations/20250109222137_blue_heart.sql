-- Add payment-related fields to customer_orders table
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Create index for payment-related queries
CREATE INDEX IF NOT EXISTS idx_customer_orders_payment_status 
ON customer_orders(status, paid_at);