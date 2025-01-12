-- Drop existing policy
DROP POLICY IF EXISTS quote_items_business_access ON quote_items;

-- Create separate policies for SELECT, INSERT, UPDATE, and DELETE
CREATE POLICY quote_items_select ON quote_items
  FOR SELECT
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

CREATE POLICY quote_items_insert ON quote_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM quotes 
      WHERE id = quote_id 
      AND (
        business_id IN (
          SELECT business_id 
          FROM business_staff 
          WHERE user_id = auth.uid() 
          AND status = 'active'
        )
        OR 
        auth.email() IN ('rotemziv7766@gmail.com', 'rotem@optionecrm.com')
      )
    )
  );

CREATE POLICY quote_items_update ON quote_items
  FOR UPDATE
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
  )
  WITH CHECK (
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

CREATE POLICY quote_items_delete ON quote_items
  FOR DELETE
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
