-- Add new admin user
DO $$
DECLARE
  v_user_id uuid;
  v_business_id uuid;
BEGIN
  -- Create new admin user with only the essential columns
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone,
    phone_confirmed_at,
    phone_change_token,
    confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    banned_until,
    deleted_at
  )
  VALUES (
    gen_random_uuid(),
    'rotemziv7766@gmail.com',
    crypt('bt55wa12345', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    '',
    NULL,
    NULL,
    '',
    now(),
    now(),
    NULL,
    NULL,
    NULL
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