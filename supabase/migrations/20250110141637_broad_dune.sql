-- Drop existing policies
DROP POLICY IF EXISTS "Super admin access" ON businesses;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON businesses;

-- Create new policies that allow access to business owners and staff
CREATE POLICY "Business access for owners and staff"
  ON businesses
  TO authenticated
  USING (
    id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );

-- Create policy for super admins
CREATE POLICY "Super admin full access"
  ON businesses
  TO authenticated
  USING (
    auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com')
  )
  WITH CHECK (
    auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com')
  );

-- Refresh the materialized view to update access permissions
REFRESH MATERIALIZED VIEW user_business_access;