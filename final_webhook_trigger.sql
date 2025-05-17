-- הפעלת ההרחבה http אם היא לא מופעלת
CREATE EXTENSION IF NOT EXISTS http;

-- טבלת לוגים לדיבוג
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- הוספת רשומת בדיקה לטבלת הלוגים
INSERT INTO debug_logs (message) VALUES ('Starting final webhook trigger setup');

-- פונקציה משופרת שתופעל כאשר הזמנה בטבלת customer_orders מסומנת כ-completed
CREATE OR REPLACE FUNCTION public.handle_customer_orders_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  webhook_id UUID;
  business_id UUID;
  product_id UUID;
  customer_record RECORD;
  product_record RECORD;
  order_item_record RECORD;
  payload JSONB;
  response_status INT;
  response_body TEXT;
BEGIN
  -- לוג התחלת הפונקציה
  INSERT INTO debug_logs (message) VALUES ('Starting handle_customer_orders_webhook function. NEW.status=' || NEW.status);
  
  -- בדיקה אם הסטטוס הוא 'completed'
  -- שים לב: אנחנו לא בודקים אם הסטטוס השתנה, רק אם הוא 'completed'
  IF (NEW.status = 'completed') THEN
    -- לוג שהתנאי התקיים
    INSERT INTO debug_logs (message) VALUES ('Status is completed. Order ID=' || NEW.id);
    
    -- שליפת מזהה העסק מההזמנה
    business_id := NEW.business_id;
    INSERT INTO debug_logs (message) VALUES ('Business ID=' || business_id);
    
    -- שליפת כל ה-webhooks המוגדרים לתשלום הזמנה
    FOR webhook_url, webhook_id IN 
      SELECT url, id FROM business_webhooks 
      WHERE business_id = NEW.business_id AND on_order_paid = TRUE
    LOOP
      INSERT INTO debug_logs (message) VALUES ('Found webhook: URL=' || webhook_url || ', ID=' || webhook_id);
      
      -- שליפת פרטי הלקוח
      BEGIN
        SELECT * INTO customer_record FROM customers WHERE id = NEW.customer_id;
        IF customer_record IS NULL THEN
          INSERT INTO debug_logs (message) VALUES ('Customer not found for ID=' || NEW.customer_id);
        ELSE
          INSERT INTO debug_logs (message) VALUES ('Customer found: ' || customer_record.name);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- אם יש שגיאה, נשתמש בערכי ברירת מחדל
        INSERT INTO debug_logs (message) VALUES ('Error fetching customer: ' || SQLERRM);
        customer_record := NULL;
      END;
      
      -- שליפת פרטי פריטי ההזמנה
      BEGIN
        SELECT * INTO order_item_record FROM order_items 
        WHERE order_id = NEW.id 
        LIMIT 1;
        
        IF order_item_record IS NULL THEN
          INSERT INTO debug_logs (message) VALUES ('No order items found for order ID=' || NEW.id);
        ELSE
          INSERT INTO debug_logs (message) VALUES ('Order item found: product_id=' || order_item_record.product_id);
          product_id := order_item_record.product_id;
          
          -- שליפת פרטי המוצר
          BEGIN
            SELECT * INTO product_record FROM products WHERE id = product_id;
            IF product_record IS NULL THEN
              INSERT INTO debug_logs (message) VALUES ('Product not found for ID=' || product_id);
            ELSE
              INSERT INTO debug_logs (message) VALUES ('Product found: ' || product_record.name);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error fetching product: ' || SQLERRM);
            product_record := NULL;
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO debug_logs (message) VALUES ('Error fetching order item: ' || SQLERRM);
        order_item_record := NULL;
      END;
      
      -- יצירת ה-payload
      payload := jsonb_build_object(
        'event', 'order_paid',
        'order_id', NEW.id,
        'business_id', business_id,
        'timestamp', now()
      );
      
      -- הוספת פרטי הזמנה
      payload := payload || jsonb_build_object(
        'order', jsonb_build_object(
          'id', NEW.id,
          'total_amount', NEW.total_amount,
          'status', NEW.status,
          'created_at', NEW.created_at
        )
      );
      
      -- הוספת פרטי לקוח אם קיימים
      IF customer_record IS NOT NULL THEN
        payload := payload || jsonb_build_object(
          'customer', jsonb_build_object(
            'id', customer_record.id,
            'name', customer_record.name,
            'email', customer_record.email,
            'phone', customer_record.phone,
            'contact_id', customer_record.contact_id
          )
        );
      END IF;
      
      -- הוספת פרטי מוצר אם קיימים
      IF product_record IS NOT NULL THEN
        payload := payload || jsonb_build_object(
          'product', jsonb_build_object(
            'id', product_record.id,
            'name', product_record.name,
            'price', product_record.price,
            'sku', product_record.sku,
            'currency', COALESCE(product_record.currency, 'ILS')
          )
        );
      END IF;
      
      -- הוספת פרטי פריט הזמנה אם קיימים
      IF order_item_record IS NOT NULL THEN
        payload := payload || jsonb_build_object(
          'order_item', jsonb_build_object(
            'quantity', order_item_record.quantity,
            'price_at_time', order_item_record.price_at_time
          )
        );
      END IF;
      
      INSERT INTO debug_logs (message) VALUES ('Payload created: ' || payload::text);
      
      -- שליחת ה-webhook בצורה בטוחה יותר
      BEGIN
        INSERT INTO debug_logs (message) VALUES ('Sending webhook to: ' || webhook_url);
        
        -- ניסיון לשלוח את ה-webhook, אבל בצורה שלא תחסום את התהליך אם יש שגיאה
        BEGIN
          SELECT
            status,
            content
          INTO
            response_status,
            response_body
          FROM
            http((
              'POST',
              webhook_url,
              ARRAY[http_header('Content-Type', 'application/json')],
              payload::text,
              NULL
            )::http_request);
            
          INSERT INTO debug_logs (message) VALUES ('Webhook response: status=' || response_status || ', body=' || response_body);
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error sending webhook: ' || SQLERRM);
          response_status := NULL;
          response_body := 'Error: ' || SQLERRM;
        END;
        
        -- שמירת לוג של ה-webhook
        BEGIN
          INSERT INTO webhook_logs (
            webhook_id,
            order_id,
            product_id,
            request_payload,
            response_status,
            response_body,
            sent_at
          ) VALUES (
            webhook_id,
            NEW.id,
            product_id,
            payload,
            response_status,
            response_body,
            now()
          );
          
          INSERT INTO debug_logs (message) VALUES ('Webhook log saved');
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error saving webhook log: ' || SQLERRM);
        END;
      EXCEPTION WHEN OTHERS THEN
        -- לוג של שגיאה כללית, אבל לא נפסיק את התהליך
        INSERT INTO debug_logs (message) VALUES ('General error in webhook processing: ' || SQLERRM);
      END;
    END LOOP;
  ELSE
    INSERT INTO debug_logs (message) VALUES ('Status is not completed. Current status=' || NEW.status);
  END IF;
  
  INSERT INTO debug_logs (message) VALUES ('Finished handle_customer_orders_webhook function');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- לוג של שגיאה כללית, אבל לא נפסיק את התהליך
  INSERT INTO debug_logs (message) VALUES ('Critical error in trigger function: ' || SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- הסרת הטריגרים הקודמים אם קיימים
DROP TRIGGER IF EXISTS trigger_customer_orders_completed ON customer_orders;
DROP TRIGGER IF EXISTS trigger_customer_orders_webhook ON customer_orders;

-- טריגר משופר שיפעיל את הפונקציה כאשר הזמנה בטבלת customer_orders מתעדכנת
CREATE TRIGGER trigger_customer_orders_webhook
AFTER UPDATE ON customer_orders
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION handle_customer_orders_webhook();

-- לוג שהטריגר נוצר בהצלחה
INSERT INTO debug_logs (message) VALUES ('Final trigger created successfully');

-- בדיקת הטריגר
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_customer_orders_webhook';
