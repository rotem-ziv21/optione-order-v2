-- Remove any indexes we added
DROP INDEX IF EXISTS idx_customer_orders_payment_details;
DROP INDEX IF EXISTS idx_customer_orders_status;
DROP INDEX IF EXISTS idx_customer_orders_transaction_id;

-- Remove any columns we added
ALTER TABLE customer_orders
DROP COLUMN IF EXISTS payment_details,
DROP COLUMN IF EXISTS transaction_id,
DROP COLUMN IF EXISTS paid_at;

-- Remove any constraints we added
ALTER TABLE customer_orders 
DROP CONSTRAINT IF EXISTS customer_orders_status_check;
