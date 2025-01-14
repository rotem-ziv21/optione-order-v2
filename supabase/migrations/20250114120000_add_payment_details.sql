-- Add payment_details column to customer_orders table
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS payment_details JSONB;

-- Add index on payment_details for better performance
CREATE INDEX IF NOT EXISTS idx_customer_orders_payment_details
ON customer_orders USING GIN (payment_details);

-- Update RLS policy to allow webhook to update payment_details
CREATE POLICY update_payment_details ON customer_orders
FOR UPDATE
USING (true)
WITH CHECK (true);
