-- הפעלת ההרחבה http אם היא לא מופעלת
CREATE EXTENSION IF NOT EXISTS http;

-- טבלת לוגים לדיבוג
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- פונקציה שאפשר לקרוא לה ישירות מהקוד
CREATE OR REPLACE FUNCTION public.send_order_webhook(order_id UUID)
RETURNS JSONB AS $$
DECLARE
  webhook_url TEXT;
  webhook_id UUID;
  business_id UUID;
  product_id UUID;
  customer_record RECORD;
  product_record RECORD;
  order_item_record RECORD;
  order_record RECORD;
  payload JSONB;
  response_status INT;
  response_body TEXT;
  results JSONB := '[]'::JSONB;
  result JSONB;
BEGIN
  -- לוג התחלת הפונקציה
  INSERT INTO debug_logs (message) VALUES ('Starting send_order_webhook function for order_id=' || order_id);
  
  -- שליפת פרטי ההזמנה
  BEGIN
    SELECT * INTO order_record FROM orders WHERE id = order_id;
    IF order_record IS NULL THEN
      INSERT INTO debug_logs (message) VALUES ('Order not found for ID=' || order_id);
      RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    INSERT INTO debug_logs (message) VALUES ('Order found: status=' || order_record.status);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (message) VALUES ('Error fetching order: ' || SQLERRM);
    RETURN jsonb_build_object('success', false, 'error', 'Error fetching order: ' || SQLERRM);
  END;
  
  -- שליפת מזהה העסק מההזמנה
  business_id := order_record.business_id;
  INSERT INTO debug_logs (message) VALUES ('Business ID=' || business_id);
  
  -- שליפת כל ה-webhooks המוגדרים לתשלום הזמנה
  FOR webhook_url, webhook_id IN 
    SELECT url, id FROM business_webhooks 
    WHERE business_id = order_record.business_id AND on_order_paid = TRUE
  LOOP
    INSERT INTO debug_logs (message) VALUES ('Found webhook: URL=' || webhook_url || ', ID=' || webhook_id);
    
    -- שליפת פרטי הלקוח
    BEGIN
      SELECT * INTO customer_record FROM customers WHERE id = order_record.customer_id;
      IF customer_record IS NULL THEN
        INSERT INTO debug_logs (message) VALUES ('Customer not found for ID=' || order_record.customer_id);
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
      WHERE order_id = order_id 
      LIMIT 1;
      
      IF order_item_record IS NULL THEN
        INSERT INTO debug_logs (message) VALUES ('No order items found for order ID=' || order_id);
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
      'order_id', order_id,
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
    
    -- שליחת ה-webhook
    BEGIN
      INSERT INTO debug_logs (message) VALUES ('Sending webhook to: ' || webhook_url);
      
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
      
      -- הוספת התוצאה למערך התוצאות
      result := jsonb_build_object(
        'webhook_id', webhook_id,
        'url', webhook_url,
        'status', response_status,
        'success', response_status >= 200 AND response_status < 300
      );
      
      results := results || result;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO debug_logs (message) VALUES ('Error sending webhook: ' || SQLERRM);
      response_status := NULL;
      response_body := 'Error: ' || SQLERRM;
      
      -- הוספת השגיאה למערך התוצאות
      result := jsonb_build_object(
        'webhook_id', webhook_id,
        'url', webhook_url,
        'status', 0,
        'success', false,
        'error', SQLERRM
      );
      
      results := results || result;
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
        order_id,
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
  END LOOP;
  
  -- שליחת webhooks לרכישת מוצרים
  INSERT INTO debug_logs (message) VALUES ('Checking for product purchase webhooks');
  
  FOR order_item_record IN 
    SELECT * FROM order_items WHERE order_id = order_id
  LOOP
    INSERT INTO debug_logs (message) VALUES ('Processing order item: product_id=' || order_item_record.product_id);
    product_id := order_item_record.product_id;
    
    -- שליפת כל ה-webhooks המוגדרים לרכישת מוצרים
    FOR webhook_url, webhook_id IN 
      SELECT url, id FROM business_webhooks 
      WHERE business_id = order_record.business_id 
        AND on_product_purchased = TRUE
        AND (product_id IS NULL OR product_id = order_item_record.product_id)
    LOOP
      INSERT INTO debug_logs (message) VALUES ('Found product webhook: URL=' || webhook_url || ', ID=' || webhook_id);
      
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
      
      -- יצירת ה-payload
      payload := jsonb_build_object(
        'event', 'product_purchased',
        'order_id', order_id,
        'product_id', product_id,
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
      
      INSERT INTO debug_logs (message) VALUES ('Product webhook payload created: ' || payload::text);
      
      -- שליחת ה-webhook
      BEGIN
        INSERT INTO debug_logs (message) VALUES ('Sending product webhook to: ' || webhook_url);
        
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
          
        INSERT INTO debug_logs (message) VALUES ('Product webhook response: status=' || response_status || ', body=' || response_body);
        
        -- הוספת התוצאה למערך התוצאות
        result := jsonb_build_object(
          'webhook_id', webhook_id,
          'url', webhook_url,
          'product_id', product_id,
          'status', response_status,
          'success', response_status >= 200 AND response_status < 300
        );
        
        results := results || result;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO debug_logs (message) VALUES ('Error sending product webhook: ' || SQLERRM);
        response_status := NULL;
        response_body := 'Error: ' || SQLERRM;
        
        -- הוספת השגיאה למערך התוצאות
        result := jsonb_build_object(
          'webhook_id', webhook_id,
          'url', webhook_url,
          'product_id', product_id,
          'status', 0,
          'success', false,
          'error', SQLERRM
        );
        
        results := results || result;
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
          order_id,
          product_id,
          payload,
          response_status,
          response_body,
          now()
        );
        
        INSERT INTO debug_logs (message) VALUES ('Product webhook log saved');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO debug_logs (message) VALUES ('Error saving product webhook log: ' || SQLERRM);
      END;
    END LOOP;
  END LOOP;
  
  INSERT INTO debug_logs (message) VALUES ('Finished send_order_webhook function');
  RETURN jsonb_build_object('success', true, 'results', results);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
