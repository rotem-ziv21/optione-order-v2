-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(contact_id),
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  business_id UUID NOT NULL REFERENCES businesses(id)
);

-- Create quote_items table
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_time DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS quotes_customer_id_idx ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS quotes_business_id_idx ON quotes(business_id);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON quote_items(quote_id);

-- Add RLS policies
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Policy for quotes
CREATE POLICY quotes_business_access ON quotes
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id 
      FROM business_staff 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
    OR 
    auth.email() IN ('rotemziv7766@gmail.com', 'rotem@optionecrm.com')
  );

-- Policy for quote_items
CREATE POLICY quote_items_business_access ON quote_items
  FOR ALL
  TO authenticated
  USING (
    quote_id IN (
      SELECT id 
      FROM quotes 
      WHERE business_id IN (
        SELECT business_id 
        FROM business_staff 
        WHERE user_id = auth.uid() 
        AND status = 'active'
      )
      OR 
      auth.email() IN ('rotemziv7766@gmail.com', 'rotem@optionecrm.com')
    )
  );
