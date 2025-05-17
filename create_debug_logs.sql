-- יצירת טבלת לוגים לדיבוג אם היא לא קיימת
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- הוספת רשומת בדיקה
INSERT INTO debug_logs (message) VALUES ('בדיקת טבלת לוגים');

-- בדיקת הרשאות HTTP
DO $$
BEGIN
  -- בדיקה אם ההרחבה HTTP מותקנת
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    INSERT INTO debug_logs (message) VALUES ('הרחבת HTTP מותקנת');
    
    -- בדיקה אם יש הרשאות לשליחת בקשות HTTP
    BEGIN
      PERFORM http_get('https://httpbin.org/get');
      INSERT INTO debug_logs (message) VALUES ('יש הרשאות לשליחת בקשות HTTP');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO debug_logs (message) VALUES ('אין הרשאות לשליחת בקשות HTTP: ' || SQLERRM);
    END;
  ELSE
    INSERT INTO debug_logs (message) VALUES ('הרחבת HTTP לא מותקנת');
  END IF;
END $$;

-- בדיקת טבלת webhook_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'webhook_logs'
  ) THEN
    INSERT INTO debug_logs (message) VALUES ('טבלת webhook_logs קיימת');
  ELSE
    INSERT INTO debug_logs (message) VALUES ('טבלת webhook_logs לא קיימת');
  END IF;
END $$;

-- בדיקת טבלת business_webhooks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'business_webhooks'
  ) THEN
    INSERT INTO debug_logs (message) VALUES ('טבלת business_webhooks קיימת');
    
    -- בדיקת רשומות בטבלה
    DECLARE
      webhook_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO webhook_count FROM business_webhooks;
      INSERT INTO debug_logs (message) VALUES ('מספר רשומות בטבלת business_webhooks: ' || webhook_count);
    END;
  ELSE
    INSERT INTO debug_logs (message) VALUES ('טבלת business_webhooks לא קיימת');
  END IF;
END $$;

-- בדיקת הרשומות בטבלת debug_logs
SELECT * FROM debug_logs ORDER BY created_at DESC LIMIT 20;
