-- Drop existing foreign key if exists
ALTER TABLE customer_orders 
DROP CONSTRAINT IF EXISTS customer_orders_created_by_fkey;

-- Add foreign key constraint with explicit name
ALTER TABLE customer_orders
ADD CONSTRAINT customer_orders_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id)
ON DELETE SET NULL;
