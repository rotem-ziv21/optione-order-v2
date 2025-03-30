-- Add monthly_sales_target to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS monthly_sales_target NUMERIC DEFAULT 0;

-- Create a function to get sales by staff member
CREATE OR REPLACE FUNCTION get_sales_by_staff(p_business_id UUID, p_start_date TIMESTAMP, p_end_date TIMESTAMP)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  total_sales NUMERIC,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_business_sales NUMERIC;
BEGIN
  -- Get total sales for the business in the period
  SELECT COALESCE(SUM(total_amount), 0) INTO total_business_sales
  FROM customer_orders
  WHERE business_id = p_business_id
    AND status = 'completed'
    AND created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN QUERY
  SELECT 
    t.id AS staff_id,
    t.name AS staff_name,
    COALESCE(SUM(co.total_amount), 0) AS total_sales,
    CASE 
      WHEN total_business_sales > 0 THEN 
        ROUND((COALESCE(SUM(co.total_amount), 0) / total_business_sales) * 100, 2)
      ELSE 0
    END AS percentage
  FROM 
    team t
    LEFT JOIN customer_orders co ON t.id = co.staff_id 
      AND co.status = 'completed'
      AND co.business_id = p_business_id
      AND co.created_at BETWEEN p_start_date AND p_end_date
  WHERE 
    t.business_id = p_business_id
  GROUP BY 
    t.id, t.name
  ORDER BY 
    total_sales DESC;
END;
$$;

-- Create a function to get products sold by staff
CREATE OR REPLACE FUNCTION get_products_by_staff(p_business_id UUID, p_start_date TIMESTAMP, p_end_date TIMESTAMP)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  staff_id UUID,
  staff_name TEXT,
  quantity BIGINT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    t.id AS staff_id,
    t.name AS staff_name,
    SUM(oi.quantity) AS quantity,
    SUM(oi.quantity * oi.price_at_time) AS total_amount
  FROM 
    products p
    JOIN order_items oi ON p.id = oi.product_id
    JOIN customer_orders co ON oi.order_id = co.id
    LEFT JOIN team t ON co.staff_id = t.id
  WHERE 
    p.business_id = p_business_id
    AND co.status = 'completed'
    AND co.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY 
    p.id, p.name, t.id, t.name
  ORDER BY 
    total_amount DESC;
END;
$$;

-- Create a function to get monthly sales progress
CREATE OR REPLACE FUNCTION get_monthly_sales_progress(p_business_id UUID)
RETURNS TABLE (
  current_month TEXT,
  target_amount NUMERIC,
  current_amount NUMERIC,
  percentage NUMERIC,
  remaining_amount NUMERIC,
  days_remaining INTEGER,
  daily_target NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  month_start TIMESTAMP;
  month_end TIMESTAMP;
  curr_date TIMESTAMP;
  days_in_month INTEGER;
BEGIN
  -- Set current date and month boundaries
  curr_date := NOW();
  month_start := DATE_TRUNC('month', curr_date);
  month_end := (DATE_TRUNC('month', curr_date) + INTERVAL '1 month' - INTERVAL '1 day')::date + INTERVAL '23 hours 59 minutes 59 seconds';
  days_in_month := EXTRACT(DAY FROM month_end);
  
  RETURN QUERY
  SELECT 
    TO_CHAR(curr_date, 'Month YYYY') AS current_month,
    b.monthly_sales_target AS target_amount,
    COALESCE(SUM(co.total_amount), 0) AS current_amount,
    CASE 
      WHEN b.monthly_sales_target > 0 THEN 
        ROUND((COALESCE(SUM(co.total_amount), 0) / b.monthly_sales_target) * 100, 2)
      ELSE 0
    END AS percentage,
    GREATEST(0, b.monthly_sales_target - COALESCE(SUM(co.total_amount), 0)) AS remaining_amount,
    (days_in_month - EXTRACT(DAY FROM curr_date)::INTEGER + 1) AS days_remaining,
    CASE 
      WHEN (days_in_month - EXTRACT(DAY FROM curr_date)::INTEGER + 1) > 0 AND 
           (b.monthly_sales_target - COALESCE(SUM(co.total_amount), 0)) > 0 THEN
        (b.monthly_sales_target - COALESCE(SUM(co.total_amount), 0)) / 
        (days_in_month - EXTRACT(DAY FROM curr_date)::INTEGER + 1)
      ELSE 0
    END AS daily_target
  FROM 
    businesses b
    LEFT JOIN customer_orders co ON b.id = co.business_id 
      AND co.status = 'completed'
      AND co.created_at BETWEEN month_start AND month_end
  WHERE 
    b.id = p_business_id
  GROUP BY 
    b.id, b.monthly_sales_target;
END;
$$;
