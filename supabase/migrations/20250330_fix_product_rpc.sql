-- Create a function to get products for a business
CREATE OR REPLACE FUNCTION get_business_products(p_business_id UUID)
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE business_id = p_business_id
  ORDER BY name ASC;
END;
$$;
