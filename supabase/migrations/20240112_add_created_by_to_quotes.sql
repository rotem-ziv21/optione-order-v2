-- Add created_by to quotes table
ALTER TABLE quotes 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update existing quotes to set created_by from business_staff
UPDATE quotes q
SET created_by = bs.user_id
FROM business_staff bs
WHERE q.business_id = bs.business_id
AND q.created_by IS NULL;
