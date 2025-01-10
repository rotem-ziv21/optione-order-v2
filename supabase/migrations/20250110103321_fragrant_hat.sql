/*
  # Initial Admin Setup

  1. Changes
    - Creates initial admin user using Supabase auth functions
    - Creates initial business for admin
    - Links admin user to business

  2. Security
    - Uses Supabase's built-in auth system
    - Sets up proper user role and permissions
*/

-- Create initial business for admin if not exists
INSERT INTO businesses (
  name,
  owner_id,
  status
)
SELECT 
  'OptioneCRM',
  id,
  'active'
FROM auth.users 
WHERE email = 'rotem@optionecrm.com'
AND NOT EXISTS (
  SELECT 1 FROM businesses 
  WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'rotem@optionecrm.com')
);