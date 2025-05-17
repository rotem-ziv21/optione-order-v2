-- פונקציה שתופעל כאשר נוצר פריט הזמנה חדש (כלומר, כאשר מוצר נרכש)
CREATE OR REPLACE FUNCTION public.handle_product_purchased()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  webhook_id UUID;
  business_id UUID;
  order_record RECORD;
  customer_record RECORD;
  product_record RECORD;
  payload JSONB;
  response_status INT;
  response_body TEXT;
BEGIN
  -- שליפת פרטי ההזמנה
  BEGIN
    SELECT * INTO order_record FROM orders WHERE id = NEW.order_id;
    IF order_record IS NULL THEN
      -- אם ההזמנה לא נמצאה, לא נמשיך
      RETURN NEW;
    END IF;
    
    -- שליפת מזהה העסק מההזמנה
    business_id := order_record.business_id;
  EXCEPTION WHEN OTHERS THEN
    -- אם יש שגיאה, לא נמשיך
    RETURN NEW;
  END;
  
  -- שליפת פרטי המוצר
  BEGIN
    SELECT * INTO product_record FROM products WHERE id = NEW.product_id;
    IF product_record IS NULL THEN
      -- אם המוצר לא נמצא, לא נמשיך
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- אם יש שגיאה, לא נמשיך
    RETURN NEW;
  END;
  
  -- שליפת פרטי הלקוח
  BEGIN
    SELECT * INTO customer_record FROM customers WHERE id = order_record.customer_id;
  EXCEPTION WHEN OTHERS THEN
    -- אם יש שגיאה, נשתמש בערכי ברירת מחדל
    customer_record := NULL;
  END;
  
  -- שליפת כל ה-webhooks המוגדרים לרכישת מוצרים
  FOR webhook_url, webhook_id IN 
    SELECT url, id FROM business_webhooks 
    WHERE business_id = business_id 
      AND on_product_purchased = TRUE
      AND (product_id IS NULL OR product_id = NEW.product_id)
  LOOP
    -- יצירת ה-payload
    payload := jsonb_build_object(
      'event', 'product_purchased',
      'order_id', NEW.order_id,
      'product_id', NEW.product_id,
      'business_id', business_id,
      'timestamp', now()
    );
    
    -- הוספת פרטי הזמנה
    payload := payload || jsonb_build_object(
      'order', jsonb_build_object(
        'id', order_record.id,
        'total_amount', order_record.total_amount,
        'status', order_record.status,
        'created_at', order_record.created_at
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
    
    -- הוספת פרטי מוצר
    payload := payload || jsonb_build_object(
      'product', jsonb_build_object(
        'id', product_record.id,
        'name', product_record.name,
        'price', product_record.price,
        'sku', product_record.sku,
        'currency', COALESCE(product_record.currency, 'ILS')
      )
    );
    
    -- הוספת פרטי פריט הזמנה
    payload := payload || jsonb_build_object(
      'order_item', jsonb_build_object(
        'quantity', NEW.quantity,
        'price_at_time', NEW.price_at_time
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
      NEW.order_id,
      NEW.product_id,
      payload,
      response_status,
      response_body,
      now()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- טריגר שיפעיל את הפונקציה כאשר נוצר פריט הזמנה חדש
DROP TRIGGER IF EXISTS trigger_product_purchased ON order_items;
CREATE TRIGGER trigger_product_purchased
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION handle_product_purchased();

-- הפעלת ההרחבה http אם היא לא מופעלת
CREATE EXTENSION IF NOT EXISTS http;
