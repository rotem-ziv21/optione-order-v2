-- Rollback all changes
DROP INDEX IF EXISTS idx_customer_orders_payment_details;
DROP INDEX IF EXISTS idx_customer_orders_status;
DROP INDEX IF EXISTS idx_customer_orders_transaction_id;

ALTER TABLE customer_orders
DROP COLUMN IF EXISTS payment_details,
DROP COLUMN IF EXISTS transaction_id,
DROP COLUMN IF EXISTS paid_at;

-- Drop the constraint if it exists
ALTER TABLE customer_orders 
DROP CONSTRAINT IF EXISTS customer_orders_status_check;
