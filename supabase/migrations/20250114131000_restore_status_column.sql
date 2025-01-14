-- Create the order_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the status column back
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS status order_status DEFAULT 'pending';

-- Add RLS policy for status
CREATE POLICY IF NOT EXISTS customer_orders_status_policy
    ON customer_orders
    FOR ALL
    USING (true)
    WITH CHECK (true);
