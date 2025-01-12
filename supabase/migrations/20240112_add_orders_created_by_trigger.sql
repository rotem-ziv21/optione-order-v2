-- Create function to set created_by on insert
CREATE OR REPLACE FUNCTION set_customer_order_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set created_by on insert
DROP TRIGGER IF EXISTS set_customer_order_created_by_trigger ON customer_orders;
CREATE TRIGGER set_customer_order_created_by_trigger
  BEFORE INSERT ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_customer_order_created_by();
