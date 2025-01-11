-- Drop existing type if exists
DROP TYPE IF EXISTS order_status CASCADE;

-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled', 'paid');

-- Modify customer_orders table to use new status
ALTER TABLE customer_orders 
  ALTER COLUMN status TYPE order_status 
  USING status::text::order_status;

-- Create function to handle order status changes
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Log the change
    INSERT INTO system_logs (action, details)
    VALUES (
      'order_paid',
      json_build_object(
        'order_id', NEW.id,
        'customer_id', NEW.customer_id,
        'total_amount', NEW.total_amount
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS order_status_change_trigger ON customer_orders;
CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE OF status
  ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();
