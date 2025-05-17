-- בדיקת הרשומות בטבלת business_webhooks
SELECT * FROM business_webhooks;

-- עדכון כתובת ה-webhook לשירות בדיקה
-- החלף את 'your-unique-id' במזהה שקיבלת מ-webhook.site
UPDATE business_webhooks 
SET url = 'https://webhook.site/your-unique-id' 
WHERE on_order_paid = TRUE;

-- מחיקת הלוגים הקיימים לנקיון
TRUNCATE debug_logs;

-- הוספת לוג התחלה
INSERT INTO debug_logs (message) VALUES ('Starting webhook test');

-- שינוי הסטטוס למשהו אחר
UPDATE customer_orders 
SET status = 'paid' 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';

-- בדיקה שהעדכון הצליח
SELECT id, status FROM customer_orders 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';

-- המתנה קצרה
SELECT pg_sleep(1);

-- עכשיו נשנה את הסטטוס ל-completed כדי להפעיל את הטריגר
UPDATE customer_orders 
SET status = 'completed' 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';

-- בדיקה שהעדכון הצליח
SELECT id, status FROM customer_orders 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';

-- בדיקת הלוגים
SELECT * FROM debug_logs ORDER BY created_at DESC LIMIT 20;

-- בדיקת לוגי ה-webhook
SELECT * FROM webhook_logs ORDER BY sent_at DESC LIMIT 10;
