-- Drop existing policies for products
DROP POLICY IF EXISTS "Enable read for business members" ON products;
DROP POLICY IF EXISTS "Enable write for business admins" ON products;

-- Create new, more permissive policies for products
-- Allow all business members to read products
CREATE POLICY "Enable read for business members"
  ON products
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

-- Allow all business members to insert and update products
CREATE POLICY "Enable write for business members"
  ON products
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
  ON products
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

-- Create a stored procedure to add products that bypasses RLS
CREATE OR REPLACE FUNCTION add_product(
  p_name TEXT,
  p_price NUMERIC,
  p_currency TEXT,
  p_stock INTEGER,
  p_sku TEXT,
  p_business_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
DECLARE
  new_product_id UUID;
BEGIN
  INSERT INTO products (name, price, currency, stock, sku, business_id)
  VALUES (p_name, p_price, p_currency, p_stock, p_sku, p_business_id)
  RETURNING id INTO new_product_id;
  
  RETURN new_product_id;
END;
$$;
