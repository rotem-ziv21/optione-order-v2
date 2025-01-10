-- Drop existing RLS policies for businesses
DROP POLICY IF EXISTS "Super admin can do everything on businesses" ON businesses;
DROP POLICY IF EXISTS "Business owners can view their own businesses" ON businesses;

-- Create new RLS policies for businesses
CREATE POLICY "Enable full access for authenticated users"
  ON businesses
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;