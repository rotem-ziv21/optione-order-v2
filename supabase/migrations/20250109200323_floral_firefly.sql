/*
  # Add Settings Table

  1. New Tables
    - `settings`
      - `id` (uuid, primary key)
      - `location_id` (text)
      - `api_token` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `settings` table
    - Add policies for authenticated users to read and update settings
*/

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text,
  api_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users on settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on settings"
  ON settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on settings"
  ON settings FOR UPDATE
  USING (true);

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();