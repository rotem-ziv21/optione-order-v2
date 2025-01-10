-- Add new admin user
DO $$
DECLARE
  v_user_id uuid;
  v_business_id uuid;
BEGIN
  -- Create new admin user with minimal required fields
  INSERT INTO auth.users (
    email,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  VALUES (
    'rotemziv7766@gmail.com',
    crypt('bt55wa12345', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO v_user_id;

  -- Get the existing business ID
  SELECT id INTO v_business_id
  FROM businesses
  WHERE name = 'OptioneCRM'
  LIMIT 1;

  -- Add the user as admin to the business
  INSERT INTO business_staff (
    business_id,
    user_id,
    role,
    status,
    permissions
  )
  VALUES (
    v_business_id,
    v_user_id,
    'admin',
    'active',
    '{
      "can_view_inventory": true,
      "can_manage_inventory": true,
      "can_view_customers": true,
      "can_manage_customers": true,
      "can_view_quotes": true,
      "can_manage_quotes": true,
      "can_manage_staff": true
    }'::jsonb
  );
END $$;