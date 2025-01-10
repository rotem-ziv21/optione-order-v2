/*
  # Fix Authentication Setup

  1. Changes
    - Creates initial admin user with proper schema
    - Sets up initial business for admin
    - Handles existing user/business cases safely

  2. Security
    - Uses proper auth schema
    - Sets up correct role permissions
*/

-- Create the initial admin user if not exists
DO $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rotem@optionecrm.com';

  -- If user doesn't exist, create it
  IF v_user_id IS NULL THEN
    -- Generate encrypted password
    v_encrypted_pw := crypt('bt55wa12345', gen_salt('bf'));

    -- Insert new user
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    )
    VALUES (
      gen_random_uuid(),
      'rotem@optionecrm.com',
      v_encrypted_pw,
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      true,
      'authenticated'
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- Create initial business if not exists
  INSERT INTO businesses (
    name,
    owner_id,
    status
  )
  SELECT 
    'OptioneCRM',
    v_user_id,
    'active'::business_status
  WHERE NOT EXISTS (
    SELECT 1 FROM businesses 
    WHERE owner_id = v_user_id
  );
END $$;