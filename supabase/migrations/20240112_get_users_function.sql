-- Drop existing function
DROP FUNCTION IF EXISTS get_users_by_ids(uuid[]);

-- Function to get user details by IDs
CREATE OR REPLACE FUNCTION get_users_by_ids(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  email varchar(255)
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::varchar(255)
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql;
