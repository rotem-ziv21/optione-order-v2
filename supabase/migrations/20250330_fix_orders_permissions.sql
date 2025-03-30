-- Drop existing policies for customer_orders
DROP POLICY IF EXISTS "Enable read for business members" ON customer_orders;
DROP POLICY IF EXISTS "Enable write for business admins" ON customer_orders;

-- Create new, more permissive policies for customer_orders
-- Allow all business members to read customer_orders
CREATE POLICY "Enable read for business members"
  ON customer_orders
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
    )
  );

-- Allow all business members to insert and update customer_orders
CREATE POLICY "Enable write for business members"
  ON customer_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
    )
  );

CREATE POLICY "Enable update for business members"
  ON customer_orders
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
    )
  );

-- Drop existing policies for order_items
DROP POLICY IF EXISTS "Enable read for business members" ON order_items;
DROP POLICY IF EXISTS "Enable write for business admins" ON order_items;

-- Create new, more permissive policies for order_items
-- Allow all business members to read order_items
CREATE POLICY "Enable read for business members"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT co.id FROM customer_orders co
      WHERE co.business_id IN (
        SELECT b.id FROM businesses b
        WHERE b.owner_id = auth.uid()
        UNION
        SELECT bs.business_id FROM business_staff bs
        WHERE bs.user_id = auth.uid()
          AND bs.status = 'active'
      )
    )
  );

-- Allow all business members to insert and update order_items
CREATE POLICY "Enable write for business members"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT co.id FROM customer_orders co
      WHERE co.business_id IN (
        SELECT b.id FROM businesses b
        WHERE b.owner_id = auth.uid()
        UNION
        SELECT bs.business_id FROM business_staff bs
        WHERE bs.user_id = auth.uid()
          AND bs.status = 'active'
      )
    )
  );

CREATE POLICY "Enable update for business members"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING (
    order_id IN (
      SELECT co.id FROM customer_orders co
      WHERE co.business_id IN (
        SELECT b.id FROM businesses b
        WHERE b.owner_id = auth.uid()
        UNION
        SELECT bs.business_id FROM business_staff bs
        WHERE bs.user_id = auth.uid()
          AND bs.status = 'active'
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT co.id FROM customer_orders co
      WHERE co.business_id IN (
        SELECT b.id FROM businesses b
        WHERE b.owner_id = auth.uid()
        UNION
        SELECT bs.business_id FROM business_staff bs
        WHERE bs.user_id = auth.uid()
          AND bs.status = 'active'
      )
    )
  );

-- Create a stored procedure to add an order with items that bypasses RLS
CREATE OR REPLACE FUNCTION add_order_with_items(
  p_customer_id TEXT,
  p_total_amount NUMERIC,
  p_currency TEXT,
  p_status TEXT,
  p_business_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
DECLARE
  new_order_id UUID;
  item_record JSONB;
BEGIN
  -- Insert the order
  INSERT INTO customer_orders (customer_id, total_amount, currency, status, business_id)
  VALUES (p_customer_id, p_total_amount, p_currency, p_status, p_business_id)
  RETURNING id INTO new_order_id;
  
  -- Insert each order item
  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, 
      product_id, 
      quantity, 
      price_at_time, 
      currency
    )
    VALUES (
      new_order_id,
      (item_record->>'product_id')::UUID,
      (item_record->>'quantity')::INTEGER,
      (item_record->>'price_at_time')::NUMERIC,
      item_record->>'currency'
    );
  END LOOP;
  
  RETURN new_order_id;
END;
$$;
