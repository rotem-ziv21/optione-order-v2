-- Get the current enum values
DO $$
DECLARE
    enum_values text[];
BEGIN
    SELECT array_agg(enumlabel::text)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = 'order_status'::regtype;
    
    RAISE NOTICE 'Current enum values: %', enum_values;
END $$;

-- Add new enum value if it doesn't exist
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_completed';

-- Remove the status column we tried to add (it already exists as enum)
ALTER TABLE customer_orders 
DROP COLUMN IF EXISTS status;
