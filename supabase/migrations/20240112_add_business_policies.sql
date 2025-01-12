-- Allow all authenticated users to read businesses
DROP POLICY IF EXISTS "Allow business staff to read businesses" ON businesses;
DROP POLICY IF EXISTS "Allow business staff and super admin to read businesses" ON businesses;
DROP POLICY IF EXISTS "Allow authenticated to read businesses" ON businesses;

-- Allow super admin to manage everything
DROP POLICY IF EXISTS "Allow super admin to manage businesses" ON businesses;
CREATE POLICY "Allow super admin to manage businesses"
ON businesses
FOR ALL
TO authenticated
USING (
  auth.email() = 'rotemziv7766@gmail.com'
);

-- Allow business staff to read their businesses
DROP POLICY IF EXISTS "Allow business staff to read businesses" ON businesses;
CREATE POLICY "Allow business staff to read businesses"
ON businesses
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT business_id 
    FROM business_staff 
    WHERE user_id = auth.uid()
  )
);

-- Allow super admin to manage business_staff
DROP POLICY IF EXISTS "Allow super admin to manage business_staff" ON business_staff;
CREATE POLICY "Allow super admin to manage business_staff"
ON business_staff
FOR ALL
TO authenticated
USING (
  auth.email() = 'rotemziv7766@gmail.com'
);

-- Allow users to read their own business_staff records
DROP POLICY IF EXISTS "Allow users to read their business_staff" ON business_staff;
CREATE POLICY "Allow users to read their business_staff"
ON business_staff
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Ensure RLS is enabled on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_staff ENABLE ROW LEVEL SECURITY;
