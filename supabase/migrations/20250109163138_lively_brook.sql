/*
  # Fix products table RLS policies

  1. Changes
    - Allow public access to products table for all operations
    - Remove authentication requirement

  2. Security Note
    - This is a temporary solution
    - Should be updated to require authentication once user auth is implemented
*/

DROP POLICY IF EXISTS "Anyone can read products" ON products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;

CREATE POLICY "Enable read access for all users"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users"
  ON products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users"
  ON products FOR UPDATE
  USING (true);