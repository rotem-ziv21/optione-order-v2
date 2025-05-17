-- בדיקת מבנה טבלת הלקוחות ותוכן הרשומה הספציפית

-- בדיקת מבנה הטבלה
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- בדיקת תוכן הרשומה הספציפית
SELECT *
FROM customers
WHERE id::TEXT = 'Xz2TM4XrHWm1FTW7q0ru';

-- בדיקת כל העמודות שעשויות להכיל אימייל
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'customers'
AND (column_name LIKE '%mail%' OR column_name LIKE '%email%' OR column_name LIKE '%contact%');

-- בדיקת כל הערכים בשורה הספציפית כטקסט
DO $$
DECLARE
  col_name TEXT;
  col_value TEXT;
  customer_id TEXT := 'Xz2TM4XrHWm1FTW7q0ru';
BEGIN
  INSERT INTO debug_logs (message) VALUES ('Starting customer record debug for ID=' || customer_id);
  
  FOR col_name IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'customers'
  LOOP
    EXECUTE format('SELECT ($1.%I)::TEXT FROM customers WHERE id::TEXT = $2', col_name)
    INTO col_value
    USING ROW(customers.*), customer_id;
    
    INSERT INTO debug_logs (message) VALUES ('Customer column ' || col_name || ' = ' || COALESCE(col_value, 'NULL'));
  END LOOP;
  
  INSERT INTO debug_logs (message) VALUES ('Finished customer record debug');
END $$;
