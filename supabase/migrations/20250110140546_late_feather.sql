-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can access data for their businesses" ON products;
DROP POLICY IF EXISTS "Users can access data for their businesses" ON customers;
DROP POLICY IF EXISTS "Users can access data for their businesses" ON customer_orders;
DROP POLICY IF EXISTS "Users can access data for their businesses" ON quotes;
DROP POLICY IF EXISTS "Users can access data for their businesses" ON settings;

-- Create new, simplified policies for products
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

CREATE POLICY "Enable write for business admins"
  ON products
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND bs.role = 'admin'
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
        AND bs.role = 'admin'
    )
  );

-- Repeat for customers
CREATE POLICY "Enable read for business members"
  ON customers
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

CREATE POLICY "Enable write for business admins"
  ON customers
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND bs.role = 'admin'
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
        AND bs.role = 'admin'
    )
  );

-- Repeat for customer_orders
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

CREATE POLICY "Enable write for business admins"
  ON customer_orders
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND bs.role = 'admin'
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
        AND bs.role = 'admin'
    )
  );

-- Repeat for quotes
CREATE POLICY "Enable read for business members"
  ON quotes
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

CREATE POLICY "Enable write for business admins"
  ON quotes
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND bs.role = 'admin'
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
        AND bs.role = 'admin'
    )
  );

-- Repeat for settings
CREATE POLICY "Enable read for business members"
  ON settings
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

CREATE POLICY "Enable write for business admins"
  ON settings
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      WHERE b.owner_id = auth.uid()
      UNION
      SELECT bs.business_id FROM business_staff bs
      WHERE bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND bs.role = 'admin'
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
        AND bs.role = 'admin'
    )
  );

-- Create function to check business access
CREATE OR REPLACE FUNCTION check_business_access(business_id uuid, required_role text DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.id = business_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM business_staff bs
        WHERE bs.business_id = b.id
        AND bs.user_id = auth.uid()
        AND bs.status = 'active'
        AND (required_role IS NULL OR bs.role = required_role)
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;