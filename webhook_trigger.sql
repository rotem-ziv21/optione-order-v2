-- פונקציה שתופעל כאשר הזמנה מסומנת כמשולמת
CREATE OR REPLACE FUNCTION public.handle_order_paid()
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
  -- בדיקה אם השדה status השתנה ל-'paid'
  IF (NEW.status = 'paid' AND OLD.status != 'paid') THEN
    -- שליפת מזהה העסק מההזמנה
    business_id := NEW.business_id;
    
    -- שליפת כל ה-webhooks המוגדרים לתשלום הזמנה
    FOR webhook_url, webhook_id IN 
      SELECT url, id FROM business_webhooks 
      WHERE business_id = NEW.business_id AND on_order_paid = TRUE
    LOOP
      -- שליפת פרטי הלקוח
      BEGIN
        SELECT * INTO customer_record FROM customers WHERE id = NEW.customer_id;
      EXCEPTION WHEN OTHERS THEN
        -- אם יש שגיאה, נשתמש בערכי ברירת מחדל
        customer_record := NULL;
      END;
      
      -- שליפת פרטי פריטי ההזמנה
      BEGIN
        SELECT * INTO order_item_record FROM order_items 
        WHERE order_id = NEW.id 
        LIMIT 1;
        
        IF order_item_record IS NOT NULL THEN
          product_id := order_item_record.product_id;
          
          -- שליפת פרטי המוצר
          BEGIN
            SELECT * INTO product_record FROM products WHERE id = product_id;
          EXCEPTION WHEN OTHERS THEN
            product_record := NULL;
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
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
      
      -- שליחת ה-webhook
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
      EXCEPTION WHEN OTHERS THEN
        response_status := NULL;
        response_body := 'Error: ' || SQLERRM;
      END;
      
      -- שמירת לוג של ה-webhook
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
    END LOOP;
    
    -- שליחת webhooks לרכישת מוצרים
    FOR order_item_record IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      product_id := order_item_record.product_id;
      
      -- שליפת כל ה-webhooks המוגדרים לרכישת מוצרים
      FOR webhook_url, webhook_id IN 
        SELECT url, id FROM business_webhooks 
        WHERE business_id = NEW.business_id 
          AND on_product_purchased = TRUE
          AND (product_id IS NULL OR product_id = order_item_record.product_id)
      LOOP
        -- שליפת פרטי המוצר
        BEGIN
          SELECT * INTO product_record FROM products WHERE id = product_id;
        EXCEPTION WHEN OTHERS THEN
          product_record := NULL;
        END;
        
        -- יצירת ה-payload
        payload := jsonb_build_object(
          'event', 'product_purchased',
          'order_id', NEW.id,
          'product_id', product_id,
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
        
        -- הוספת פרטי פריט הזמנה
        payload := payload || jsonb_build_object(
          'order_item', jsonb_build_object(
            'quantity', order_item_record.quantity,
            'price_at_time', order_item_record.price_at_time
          )
        );
        
        -- שליחת ה-webhook
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
        EXCEPTION WHEN OTHERS THEN
          response_status := NULL;
          response_body := 'Error: ' || SQLERRM;
        END;
        
        -- שמירת לוג של ה-webhook
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
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- טריגר שיפעיל את הפונקציה כאשר הזמנה מתעדכנת
DROP TRIGGER IF EXISTS trigger_order_paid ON orders;
CREATE TRIGGER trigger_order_paid
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_paid();

-- הפעלת ההרחבה http אם היא לא מופעלת
CREATE EXTENSION IF NOT EXISTS http;
