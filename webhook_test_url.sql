-- עדכון כתובת ה-webhook לשירות בדיקה
-- צור קודם כתובת ב-webhook.site ושנה את ה-URL למטה

-- בדיקת הרשומות הקיימות בטבלת business_webhooks
SELECT * FROM business_webhooks;

-- עדכון כתובת ה-webhook לשירות בדיקה
-- החלף את 'your-unique-id' במזהה שקיבלת מ-webhook.site
UPDATE business_webhooks 
SET url = 'https://webhook.site/your-unique-id' 
WHERE on_order_paid = TRUE;

-- בדיקה שהעדכון הצליח
SELECT * FROM business_webhooks WHERE on_order_paid = TRUE;
