-- בדיקת מבנה טבלת הלקוחות
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
ORDER BY ordinal_position;

-- בדיקת תוכן טבלת הלקוחות
SELECT * FROM customers LIMIT 10;
