-- הסרת הטריגר שיצרנו
DROP TRIGGER IF EXISTS trigger_customer_orders_completed ON customer_orders;

-- הסרת הפונקציה שיצרנו
DROP FUNCTION IF EXISTS handle_customer_orders_completed();

-- בדיקה שהטריגר הוסר
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_customer_orders_completed';

-- הוספת לוג על הסרת הטריגר
INSERT INTO debug_logs (message) VALUES ('Webhook trigger removed successfully');
