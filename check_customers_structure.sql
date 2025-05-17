-- בדיקת מבנה טבלת customers

-- בדיקת העמודות בטבלת customers
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' 
ORDER BY ordinal_position;

-- בדיקת תוכן הטבלה
SELECT * FROM customers LIMIT 5;

-- בדיקה ספציפית של הלקוח
SELECT * FROM customers WHERE id::TEXT = 'Xz2TM4XrHWm1FTW7q0ru';

-- בדיקת עמודות שעשויות להכיל אימייל
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND (column_name LIKE '%mail%' OR column_name LIKE '%email%' OR column_name LIKE '%contact%');

-- בדיקת כל הטבלאות שעשויות להכיל מידע על לקוחות
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%customer%' OR table_name LIKE '%user%' OR table_name LIKE '%profile%';

-- בדיקת טבלת auth.users
SELECT * FROM auth.users WHERE id::TEXT = 'Xz2TM4XrHWm1FTW7q0ru' LIMIT 1;
