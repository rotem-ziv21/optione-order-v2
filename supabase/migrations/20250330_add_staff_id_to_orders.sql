-- Add staff_id column to customer_orders table
ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES team(id) NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_orders_staff_id ON customer_orders(staff_id);

-- Update RLS policies to include staff_id in the allowed columns
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."customer_orders";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."customer_orders"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_staff bs
    WHERE bs.user_id = auth.uid()
    AND bs.business_id = customer_orders.business_id
  )
);

DROP POLICY IF EXISTS "Enable update for business staff" ON "public"."customer_orders";
CREATE POLICY "Enable update for business staff" ON "public"."customer_orders"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM business_staff bs
    WHERE bs.user_id = auth.uid()
    AND bs.business_id = customer_orders.business_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_staff bs
    WHERE bs.user_id = auth.uid()
    AND bs.business_id = customer_orders.business_id
  )
);

-- Create a function to get orders by staff member
CREATE OR REPLACE FUNCTION get_orders_by_staff(p_staff_id UUID)
RETURNS SETOF customer_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM customer_orders
  WHERE staff_id = p_staff_id
  ORDER BY created_at DESC;
END;
$$;

-- Create a function to get staff sales stats
CREATE OR REPLACE FUNCTION get_staff_sales_stats(p_business_id UUID)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  total_orders BIGINT,
  total_amount NUMERIC,
  avg_order_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS staff_id,
    t.name AS staff_name,
    COUNT(co.id) AS total_orders,
    COALESCE(SUM(co.total_amount), 0) AS total_amount,
    CASE 
      WHEN COUNT(co.id) > 0 THEN COALESCE(SUM(co.total_amount) / COUNT(co.id), 0)
      ELSE 0
    END AS avg_order_value
  FROM 
    team t
    LEFT JOIN customer_orders co ON t.id = co.staff_id AND co.status = 'completed'
  WHERE 
    t.business_id = p_business_id
  GROUP BY 
    t.id, t.name
  ORDER BY 
    total_amount DESC;
END;
$$;
