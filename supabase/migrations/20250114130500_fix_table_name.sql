-- Drop all the changes we tried to make to the wrong table
DROP INDEX IF EXISTS idx_customer_orders_payment_details;
DROP INDEX IF EXISTS idx_customer_orders_status;
DROP INDEX IF EXISTS idx_customer_orders_transaction_id;

DROP TABLE IF EXISTS customer_orders;
