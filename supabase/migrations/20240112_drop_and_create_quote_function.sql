-- Drop existing procedure
DROP PROCEDURE IF EXISTS create_quote_with_items;

-- Drop existing function (just in case)
DROP FUNCTION IF EXISTS create_quote_with_items;

-- Drop existing type (so we can recreate it)
DROP TYPE IF EXISTS quote_item_type;

-- Create type for quote items
CREATE TYPE quote_item_type AS (
    product_name text,
    quantity integer,
    price_at_time numeric,
    currency text
);

-- Create the function
CREATE OR REPLACE FUNCTION create_quote_with_items(
    p_customer_id uuid,
    p_total_amount numeric,
    p_currency text,
    p_valid_until timestamp with time zone,
    p_business_id uuid,
    p_items quote_item_type[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_id uuid;
    v_item quote_item_type;
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
    )
    RETURNING id INTO v_quote_id;

    -- Create quote items
    FOR v_item IN SELECT * FROM unnest(p_items)
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

    -- Return the quote ID
    RETURN v_quote_id;
END;
$$;
