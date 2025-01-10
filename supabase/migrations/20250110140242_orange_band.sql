-- Drop existing policies
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON business_staff;

-- Create more specific policies for business_staff
CREATE POLICY "Business owners can manage staff"
  ON business_staff
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view their own business staff"
  ON business_staff
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_staff WHERE user_id = auth.uid()
    )
  );

-- Update view permissions
DROP VIEW IF EXISTS business_staff_with_users;
CREATE VIEW business_staff_with_users AS
SELECT 
  bs.*,
  au.email,
  b.name as business_name,
  b.owner_id as business_owner_id
FROM business_staff bs
JOIN auth.users au ON bs.user_id = au.id
JOIN businesses b ON bs.business_id = b.id;

-- Grant access to the view
GRANT SELECT ON business_staff_with_users TO authenticated;