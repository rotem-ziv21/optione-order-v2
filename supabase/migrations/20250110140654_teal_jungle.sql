-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read for business members" ON products;
DROP POLICY IF EXISTS "Enable write for business admins" ON products;
DROP POLICY IF EXISTS "Enable read for business members" ON customers;
DROP POLICY IF EXISTS "Enable write for business admins" ON customers;
DROP POLICY IF EXISTS "Enable read for business members" ON customer_orders;
DROP POLICY IF EXISTS "Enable write for business admins" ON customer_orders;
DROP POLICY IF EXISTS "Enable read for business members" ON quotes;
DROP POLICY IF EXISTS "Enable write for business admins" ON quotes;
DROP POLICY IF EXISTS "Enable read for business members" ON settings;
DROP POLICY IF EXISTS "Enable write for business admins" ON settings;
DROP POLICY IF EXISTS "Business owners can manage staff" ON business_staff;
DROP POLICY IF EXISTS "Staff can view their own business staff" ON business_staff;

-- Create a materialized view for user business access
CREATE MATERIALIZED VIEW user_business_access AS
SELECT DISTINCT
    auth.uid() as user_id,
    b.id as business_id,
    CASE 
        WHEN b.owner_id = auth.uid() THEN 'owner'
        WHEN bs.role = 'admin' THEN 'admin'
        ELSE 'staff'
    END as access_level
FROM businesses b
LEFT JOIN business_staff bs ON bs.business_id = b.id AND bs.user_id = auth.uid()
WHERE b.owner_id = auth.uid() 
   OR (bs.user_id = auth.uid() AND bs.status = 'active');

-- Create index for better performance
CREATE UNIQUE INDEX idx_user_business_access ON user_business_access (user_id, business_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_business_access()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_business_access;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the view
CREATE TRIGGER refresh_access_businesses
    AFTER INSERT OR UPDATE OR DELETE ON businesses
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_user_business_access();

CREATE TRIGGER refresh_access_business_staff
    AFTER INSERT OR UPDATE OR DELETE ON business_staff
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_user_business_access();

-- Create new simplified policies using the materialized view
CREATE POLICY "Business access policy"
    ON products
    TO authenticated
    USING (business_id IN (SELECT business_id FROM user_business_access))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ));

CREATE POLICY "Business access policy"
    ON customers
    TO authenticated
    USING (business_id IN (SELECT business_id FROM user_business_access))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ));

CREATE POLICY "Business access policy"
    ON customer_orders
    TO authenticated
    USING (business_id IN (SELECT business_id FROM user_business_access))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ));

CREATE POLICY "Business access policy"
    ON quotes
    TO authenticated
    USING (business_id IN (SELECT business_id FROM user_business_access))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ));

CREATE POLICY "Business access policy"
    ON settings
    TO authenticated
    USING (business_id IN (SELECT business_id FROM user_business_access))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ));

CREATE POLICY "Business access policy"
    ON business_staff
    TO authenticated
    USING (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level IN ('owner', 'admin')
    ))
    WITH CHECK (business_id IN (
        SELECT business_id 
        FROM user_business_access 
        WHERE access_level = 'owner'
    ));

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW user_business_access;