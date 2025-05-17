-- טריגר פשוט יותר שישלח webhook לכתובת המתאימה לפי סוג המוצר

-- הוספת רשומת בדיקה לטבלת הלוגים
INSERT INTO debug_logs (message) VALUES ('Starting simplified webhook trigger setup');

-- פונקציה משופרת שתופעל כאשר הזמנה בטבלת customer_orders מסומנת כ-completed
CREATE OR REPLACE FUNCTION public.handle_customer_orders_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  webhook_id UUID;
  business_id_var UUID;
  product_id UUID;
  product_name TEXT;
  customer_record RECORD;
  product_record RECORD;
  order_item_record RECORD;
  payload JSONB;
  response_status INT;
  response_body TEXT;
BEGIN
  -- לוג התחלת הפונקציה
  INSERT INTO debug_logs (message) VALUES ('Starting simplified webhook function. NEW.status=' || NEW.status);
  
  -- בדיקה אם הסטטוס הוא 'completed'
  IF (NEW.status = 'completed') THEN
    -- לוג שהתנאי התקיים
    INSERT INTO debug_logs (message) VALUES ('Status is completed. Order ID=' || NEW.id);
    
    -- שליפת מזהה העסק מההזמנה
    business_id_var := NEW.business_id;
    INSERT INTO debug_logs (message) VALUES ('Business ID=' || business_id_var);
    
    -- שליפת פרטי פריטי ההזמנה
    BEGIN
      SELECT * INTO order_item_record FROM order_items oi
      WHERE oi.order_id = NEW.id 
      LIMIT 1;
      
      IF order_item_record IS NULL THEN
        INSERT INTO debug_logs (message) VALUES ('No order items found for order ID=' || NEW.id);
      ELSE
        INSERT INTO debug_logs (message) VALUES ('Order item found: product_id=' || order_item_record.product_id);
        product_id := order_item_record.product_id;
        
        -- שליפת פרטי המוצר
        BEGIN
          SELECT * INTO product_record FROM products p WHERE p.id = product_id;
          IF product_record IS NULL THEN
            INSERT INTO debug_logs (message) VALUES ('Product not found for ID=' || product_id);
          ELSE
            INSERT INTO debug_logs (message) VALUES ('Product found: ' || product_record.name);
            product_name := product_record.name;
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
    
    -- שליפת פרטי הלקוח
    BEGIN
      INSERT INTO debug_logs (message) VALUES ('Trying to find customer with customer_id=' || NEW.customer_id);
      
      -- ניסיון לשלוף את הלקוח לפי customer_id
      SELECT * INTO customer_record 
      FROM customers c 
      WHERE c.customer_id = NEW.customer_id;
      
      IF customer_record IS NULL THEN
        INSERT INTO debug_logs (message) VALUES ('Customer not found with customer_id. Trying with id field');
        
        -- ניסיון נוסף - אולי customer_id הוא id
        SELECT * INTO customer_record 
        FROM customers c 
        WHERE c.id::TEXT = NEW.customer_id::TEXT;
        
        IF customer_record IS NULL THEN
          INSERT INTO debug_logs (message) VALUES ('Customer still not found after trying id field');
        ELSE
          INSERT INTO debug_logs (message) VALUES ('Customer found with id field: ' || customer_record.name);
        END IF;
      ELSE
        INSERT INTO debug_logs (message) VALUES ('Customer found with customer_id: ' || customer_record.name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO debug_logs (message) VALUES ('Error fetching customer: ' || SQLERRM);
      customer_record := NULL;
    END;
    
    -- יצירת ה-payload
    payload := jsonb_build_object(
      'event', 'order_paid',
      'order_id', NEW.id,
      'business_id', business_id_var,
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
    
    -- בחירת webhook מתאים לפי שם המוצר
    -- שליפת כל ה-webhooks המוגדרים לתשלום הזמנה
    FOR webhook_url, webhook_id IN 
      SELECT bw.url, bw.id 
      FROM business_webhooks bw
      WHERE bw.business_id = NEW.business_id AND bw.on_order_paid = TRUE
    LOOP
      INSERT INTO debug_logs (message) VALUES ('Found webhook: URL=' || webhook_url || ', ID=' || webhook_id);
      
      -- בדיקה אם זה מוצר מיוחד שצריך webhook ספציפי
      IF product_name = 'עגיל זהב' AND webhook_url = 'https://n8n-2-ghql.onrender.com/webhook/order' THEN
        -- שינוי ה-URL לכתובת הספציפית לתכשיטים
        webhook_url := 'https://n8n-2-ghql.onrender.com/webhook/jewelry';
        INSERT INTO debug_logs (message) VALUES ('Redirecting to jewelry-specific webhook: ' || webhook_url);
      ELSIF product_name LIKE '%זהב%' AND webhook_url = 'https://n8n-2-ghql.onrender.com/webhook/order' THEN
        -- שינוי ה-URL לכתובת הספציפית לתכשיטים
        webhook_url := 'https://n8n-2-ghql.onrender.com/webhook/jewelry';
        INSERT INTO debug_logs (message) VALUES ('Redirecting to jewelry-specific webhook: ' || webhook_url);
      END IF;
      
      -- שליחת ה-webhook
      BEGIN
        INSERT INTO debug_logs (message) VALUES ('Sending webhook to: ' || webhook_url);
        
        -- ניסיון לשלוח את ה-webhook
        BEGIN
          SELECT
            status,
            content
          INTO
            response_status,
            response_body
          FROM
            http_post(
              webhook_url,
              payload::text,
              'application/json'
            );
            
          INSERT INTO debug_logs (message) VALUES ('Webhook response: status=' || response_status || ', body=' || response_body);
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error in http_post: ' || SQLERRM);
          
          -- ניסיון חלופי עם פונקציית http
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
              
            INSERT INTO debug_logs (message) VALUES ('Alternative webhook response: status=' || response_status || ', body=' || response_body);
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error in alternative http method: ' || SQLERRM);
            response_status := NULL;
            response_body := 'Error: ' || SQLERRM;
          END;
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
  
  INSERT INTO debug_logs (message) VALUES ('Finished simplified webhook function');
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
INSERT INTO debug_logs (message) VALUES ('Simplified webhook trigger created successfully');

-- בדיקת הטריגר
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_customer_orders_webhook';
