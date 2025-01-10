-- Drop existing policies on businesses
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON businesses;
DROP POLICY IF EXISTS "Admin only access" ON businesses;

-- Create admin-only policy for businesses
CREATE POLICY "Super admin access"
  ON businesses
  TO authenticated
  USING (auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com'))
  WITH CHECK (auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com'));

-- Update business_staff_with_users view to include more details
DROP VIEW IF EXISTS business_staff_with_users;
CREATE VIEW business_staff_with_users AS
SELECT 
  bs.*,
  au.email,
  au.created_at as user_created_at,
  b.name as business_name
FROM business_staff bs
JOIN auth.users au ON bs.user_id = au.id
JOIN businesses b ON bs.business_id = b.id;