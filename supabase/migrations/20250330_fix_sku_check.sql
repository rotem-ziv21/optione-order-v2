-- Create a function to check if SKU exists
CREATE OR REPLACE FUNCTION check_sku_exists(p_sku TEXT, p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
DECLARE
  sku_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM products
    WHERE sku = p_sku AND business_id = p_business_id
  ) INTO sku_exists;
  
  RETURN sku_exists;
END;
$$;
