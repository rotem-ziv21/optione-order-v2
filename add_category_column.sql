-- הוספת עמודת category לטבלת business_webhooks
ALTER TABLE business_webhooks ADD COLUMN IF NOT EXISTS category TEXT;

-- לוג שהעמודה נוספה
INSERT INTO debug_logs (message) VALUES ('Added category column to business_webhooks table');

-- עדכון ה-webhook הקיים לכתובת הכללית
UPDATE business_webhooks 
SET category = 'default' 
WHERE category IS NULL;

-- לוג שהעמודה עודכנה
INSERT INTO debug_logs (message) VALUES ('Updated existing webhooks with default category');

-- בדיקה שהעמודה נוספה
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_webhooks' AND column_name = 'category';
