/*
  # Admin System Setup

  1. New Tables
    - `businesses`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `owner_id` (uuid, references auth.users)
      - `status` (enum: active, inactive)
      
    - `business_staff`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `user_id` (uuid, references auth.users)
      - `role` (enum: admin, staff)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `status` (enum: active, inactive)

  2. Security
    - Enable RLS on all tables
    - Add policies for business owners and staff
    - Add policies for super admin
*/

-- Create business status enum
CREATE TYPE business_status AS ENUM ('active', 'inactive');

-- Create staff role enum
CREATE TYPE staff_role AS ENUM ('admin', 'staff');

-- Create staff status enum
CREATE TYPE staff_status AS ENUM ('active', 'inactive');

-- Create businesses table
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  owner_id uuid REFERENCES auth.users(id),
  status business_status DEFAULT 'active',
  settings jsonb DEFAULT '{}'::jsonb
);

-- Create business staff table
CREATE TABLE business_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role staff_role DEFAULT 'staff',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status staff_status DEFAULT 'active',
  permissions jsonb DEFAULT '{}'::jsonb,
  UNIQUE(business_id, user_id)
);

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_staff ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_staff_updated_at
  BEFORE UPDATE ON business_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_business_staff_business_id ON business_staff(business_id);
CREATE INDEX idx_business_staff_user_id ON business_staff(user_id);

-- Add RLS policies for businesses
CREATE POLICY "Super admin can do everything on businesses"
  ON businesses
  TO authenticated
  USING (auth.email() = 'rotem@optionecrm.com')
  WITH CHECK (auth.email() = 'rotem@optionecrm.com');

CREATE POLICY "Business owners can view their own businesses"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Add RLS policies for business_staff
CREATE POLICY "Super admin can do everything on business_staff"
  ON business_staff
  TO authenticated
  USING (auth.email() = 'rotem@optionecrm.com')
  WITH CHECK (auth.email() = 'rotem@optionecrm.com');

CREATE POLICY "Staff can view their own assignments"
  ON business_staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add business_id column to existing tables
ALTER TABLE products ADD COLUMN business_id uuid REFERENCES businesses(id);
ALTER TABLE customers ADD COLUMN business_id uuid REFERENCES businesses(id);
ALTER TABLE customer_orders ADD COLUMN business_id uuid REFERENCES businesses(id);
ALTER TABLE quotes ADD COLUMN business_id uuid REFERENCES businesses(id);
ALTER TABLE settings ADD COLUMN business_id uuid REFERENCES businesses(id);

-- Add indexes for business_id columns
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customer_orders_business_id ON customer_orders(business_id);
CREATE INDEX idx_quotes_business_id ON quotes(business_id);
CREATE INDEX idx_settings_business_id ON settings(business_id);

-- Update RLS policies for existing tables to include business_id checks
CREATE POLICY "Users can access data for their businesses"
  ON products
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );

-- Repeat similar policies for other tables
CREATE POLICY "Users can access data for their businesses"
  ON customers
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access data for their businesses"
  ON customer_orders
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access data for their businesses"
  ON quotes
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access data for their businesses"
  ON settings
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM businesses b
      LEFT JOIN business_staff bs ON bs.business_id = b.id
      WHERE b.owner_id = auth.uid()
      OR bs.user_id = auth.uid()
    )
  );