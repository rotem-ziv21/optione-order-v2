-- Create a custom type for quote items
CREATE TYPE quote_item_input AS (
  product_name VARCHAR(255),
  quantity INTEGER,
  price_at_time DECIMAL(10,2),
  currency VARCHAR(3)
);

-- Create function to create quote with items in a single transaction
CREATE OR REPLACE FUNCTION create_quote_with_items(
  p_customer_id UUID,
  p_total_amount DECIMAL(10,2),
  p_currency VARCHAR(3),
  p_valid_until TIMESTAMPTZ,
  p_business_id UUID,
  p_items quote_item_input[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote_id UUID;
  v_item quote_item_input;
BEGIN
  -- Create the quote
  INSERT INTO quotes (
    customer_id,
    total_amount,
    currency,
    valid_until,
    status,
    business_id
  ) VALUES (
    p_customer_id,
    p_total_amount,
    p_currency,
    p_valid_until,
    'draft',
    p_business_id
  ) RETURNING id INTO v_quote_id;

  -- Insert all items
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO quote_items (
      quote_id,
      product_name,
      quantity,
      price_at_time,
      currency
    ) VALUES (
      v_quote_id,
      v_item.product_name,
      v_item.quantity,
      v_item.price_at_time,
      v_item.currency
    );
  END LOOP;

  RETURN jsonb_build_object('quote_id', v_quote_id);
END;
$$;
