-- Update the admin policy to include both admin users
DROP POLICY IF EXISTS "Admin only access" ON businesses;

CREATE POLICY "Admin only access"
  ON businesses
  TO authenticated
  USING (auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com'))
  WITH CHECK (auth.email() IN ('rotem@optionecrm.com', 'rotemziv7766@gmail.com'));