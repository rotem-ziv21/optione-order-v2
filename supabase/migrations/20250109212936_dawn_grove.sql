-- Add Cardcom settings columns
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS cardcom_terminal text,
ADD COLUMN IF NOT EXISTS cardcom_api_name text;