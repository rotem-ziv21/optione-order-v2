/*
  # Customer Orders Schema

  1. New Tables
    - `customer_orders`
      - `id` (uuid, primary key)
      - `customer_id` (text, references customer's contact ID)
      - `total_amount` (numeric)
      - `currency` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references customer_orders)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `price_at_time` (numeric)
      - `currency` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for read/write access
*/

-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');

-- Create customer orders table
CREATE TABLE IF NOT EXISTS customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_at_time numeric NOT NULL CHECK (price_at_time >= 0),
  currency text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policies for customer_orders
CREATE POLICY "Enable read access for all users on customer_orders"
  ON customer_orders FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on customer_orders"
  ON customer_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on customer_orders"
  ON customer_orders FOR UPDATE
  USING (true);

-- Policies for order_items
CREATE POLICY "Enable read access for all users on order_items"
  ON order_items FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users on order_items"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users on order_items"
  ON order_items FOR UPDATE
  USING (true);

-- Add indexes for better performance
CREATE INDEX idx_customer_orders_customer_id ON customer_orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);