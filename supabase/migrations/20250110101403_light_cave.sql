/*
  # Fix quote items structure

  1. Changes
    - Remove foreign key constraint from quote_items.product_id
    - Add product_name column to store the product name directly
    - Make product_id nullable

  2. Security
    - Maintain existing RLS policies
*/

-- Remove the foreign key constraint and make product_id nullable
ALTER TABLE quote_items
DROP CONSTRAINT quote_items_product_id_fkey,
ALTER COLUMN product_id DROP NOT NULL,
ADD COLUMN product_name text NOT NULL DEFAULT '';

-- Update existing records to include product name
UPDATE quote_items
SET product_name = products.name
FROM products
WHERE quote_items.product_id = products.id;