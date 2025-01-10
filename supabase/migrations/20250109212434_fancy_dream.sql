/*
  # Add Cardcom payment settings

  1. Changes
    - Add cardcom_terminal column to settings table
    - Add cardcom_api_name column to settings table
    
  2. Security
    - Existing RLS policies will apply to new columns
*/

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS cardcom_terminal text,
ADD COLUMN IF NOT EXISTS cardcom_api_name text;