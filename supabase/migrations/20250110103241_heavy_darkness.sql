/*
  # Initial Admin Setup

  1. Changes
    - Creates initial admin user if not exists
    - Creates initial business for admin
    - Links admin user to business

  2. Security
    - Uses secure password hashing
    - Sets up proper user role
*/

-- Create the initial admin user if not exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rotem@optionecrm.com';

  -- If user doesn't exist, create it
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'rotem@optionecrm.com',
      crypt('bt55wa12345', gen_salt('bf')),
      now(),
      now(),
      now(),
      '',
      '',
      ''
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
    'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM businesses WHERE owner_id = v_user_id
  );
END $$;