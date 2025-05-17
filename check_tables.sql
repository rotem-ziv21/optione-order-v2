-- בדיקת הטבלאות הקיימות במערכת
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- בדיקת המבנה של טבלת customer_orders
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customer_orders'
ORDER BY ordinal_position;

-- בדיקת המבנה של טבלת business_webhooks
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'business_webhooks'
ORDER BY ordinal_position;

-- בדיקת הרשומות בטבלת business_webhooks
SELECT * FROM business_webhooks;

-- בדיקת ההרחבות המותקנות
SELECT * FROM pg_extension;
