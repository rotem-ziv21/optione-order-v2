/*
  # Create customers table

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `contact_id` (text, unique) - GHL Contact ID
      - `name` (text) - Customer's full name
      - `email` (text) - Customer's email address
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `customers` table
    - Add policies for read and write access
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users on customers"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on customers"
  ON customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on customers"
  ON customers FOR UPDATE
  USING (true);

-- Add index for contact_id since we'll be querying by it often
CREATE INDEX idx_customers_contact_id ON customers(contact_id);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();