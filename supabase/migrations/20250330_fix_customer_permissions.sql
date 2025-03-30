-- Drop existing policies for customers
DROP POLICY IF EXISTS "Enable read for business members" ON customers;
DROP POLICY IF EXISTS "Enable write for business admins" ON customers;

-- Create new, more permissive policies for customers
-- Allow all business members to read customers
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

-- Allow all business members to insert and update customers
CREATE POLICY "Enable write for business members"
  ON customers
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
  ON customers
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

-- Create or replace the stored procedure for adding customers
CREATE OR REPLACE FUNCTION add_customer(
  p_contact_id TEXT,
  p_name TEXT,
  p_email TEXT,
  p_business_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
BEGIN
  INSERT INTO customers (contact_id, name, email, business_id)
  VALUES (p_contact_id, p_name, p_email, p_business_id)
  ON CONFLICT (contact_id) DO NOTHING;
END;
$$;
