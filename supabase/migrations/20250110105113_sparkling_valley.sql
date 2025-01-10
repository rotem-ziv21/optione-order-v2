-- Add business for the authenticated user if not exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rotem@optionecrm.com';

  -- Create business if not exists
  IF v_user_id IS NOT NULL THEN
    INSERT INTO businesses (
      name,
      owner_id,
      status,
      settings
    )
    SELECT 
      'OptioneCRM',
      v_user_id,
      'active',
      '{}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM businesses 
      WHERE owner_id = v_user_id
    );
  END IF;
END $$;