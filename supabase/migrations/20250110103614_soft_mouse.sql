/*
  # Fix Authentication Setup

  1. Changes
    - Creates initial admin user with proper schema
    - Sets up initial business for admin
    - Handles existing user/business cases safely
    - Uses proper password hashing

  2. Security
    - Uses proper auth schema
    - Sets up correct role permissions
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    -- Generate encrypted password using proper Supabase format
    v_encrypted_pw := crypt('bt55wa12345', gen_salt('bf'));

    -- Insert new user with all required fields
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
      email_change_token_new_sent_at,
      email_change_token_current_sent_at,
      last_sign_in_at,
      banned_until,
      deleted_at
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
      NULL,
      now(),
      NULL,
      NULL
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