/*
  # Create quotes table and related schemas

  1. New Tables
    - `quotes`
      - `id` (uuid, primary key)
      - `customer_id` (text, references customers)
      - `total_amount` (numeric)
      - `currency` (text)
      - `status` (enum: draft, sent, accepted, rejected)
      - `valid_until` (date)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `quote_items`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, references quotes)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `price_at_time` (numeric)
      - `currency` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for read/write access
*/

-- Create quote status enum
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES customers(contact_id),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL,
  status quote_status NOT NULL DEFAULT 'draft',
  valid_until date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote items table
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_at_time numeric NOT NULL CHECK (price_at_time >= 0),
  currency text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for quotes
CREATE POLICY "Enable read access for all users on quotes"
  ON quotes FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on quotes"
  ON quotes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on quotes"
  ON quotes FOR UPDATE
  USING (true);

-- Add RLS policies for quote items
CREATE POLICY "Enable read access for all users on quote_items"
  ON quote_items FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on quote_items"
  ON quote_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on quote_items"
  ON quote_items FOR UPDATE
  USING (true);

-- Add indexes for better performance
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);

-- Add trigger for updating updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();