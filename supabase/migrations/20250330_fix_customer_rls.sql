-- Create a stored procedure to add customers that bypasses RLS
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
