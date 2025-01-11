-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow users to view and edit settings for their business
CREATE POLICY settings_business_access ON settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_staff bs
      WHERE bs.business_id = settings.business_id
      AND bs.user_id = auth.uid()
      AND bs.status = 'active'
    )
  );

-- Add business_id column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE settings ADD COLUMN business_id UUID REFERENCES businesses(id);
  END IF;
END $$;
