-- Allow super admin and business staff to read orders
DROP POLICY IF EXISTS "Allow business staff to read orders" ON customer_orders;
CREATE POLICY "Allow business staff and super admin to read orders"
ON customer_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM business_staff 
    WHERE business_id = customer_orders.business_id
  )
  OR 
  auth.email() = 'rotemziv7766@gmail.com'
);

-- Allow super admin and business staff to read businesses
DROP POLICY IF EXISTS "Allow business staff to read businesses" ON businesses;
CREATE POLICY "Allow business staff and super admin to read businesses"
ON businesses
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT business_id 
    FROM business_staff 
    WHERE user_id = auth.uid()
  )
  OR 
  auth.email() = 'rotemziv7766@gmail.com'
);

-- Allow super admin and business staff to read business_staff
DROP POLICY IF EXISTS "Allow business staff to read business_staff" ON business_staff;
CREATE POLICY "Allow business staff and super admin to read business_staff"
ON business_staff
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM business_staff 
    WHERE user_id = auth.uid()
  )
  OR 
  auth.email() = 'rotemziv7766@gmail.com'
);

-- Grant execute permission on get_users_by_ids function to authenticated users
GRANT EXECUTE ON FUNCTION get_users_by_ids(uuid[]) TO authenticated;

-- Ensure RLS is enabled on all tables
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_staff ENABLE ROW LEVEL SECURITY;
