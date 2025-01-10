/*
  # Add function to update product stock

  Creates a function to safely update product stock when a payment is completed.
  The function will:
  1. Subtract the specified quantity from the product's stock
  2. Ensure stock doesn't go below 0
  3. Return success/failure status
*/

CREATE OR REPLACE FUNCTION update_product_stock(p_product_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(stock - p_quantity, 0)
  WHERE id = p_product_id
  AND stock >= p_quantity;
  
  RETURN FOUND;
END;
$$;