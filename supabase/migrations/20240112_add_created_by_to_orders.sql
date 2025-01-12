-- Drop existing foreign key if exists
ALTER TABLE customer_orders 
DROP CONSTRAINT IF EXISTS customer_orders_created_by_fkey;

-- Add foreign key to auth.users
ALTER TABLE customer_orders 
ADD CONSTRAINT customer_orders_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id);

-- Update existing orders to set created_by from business_staff
UPDATE customer_orders o
SET created_by = bs.user_id
FROM business_staff bs
WHERE o.business_id = bs.business_id
AND o.created_by IS NULL;
