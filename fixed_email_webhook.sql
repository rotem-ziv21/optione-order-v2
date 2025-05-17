-- פתרון ספציפי לשליחת אימייל של לקוח ב-webhook - גרסה מתוקנת

-- הוספת רשומת בדיקה לטבלת הלוגים
INSERT INTO debug_logs (message) VALUES ('Starting fixed email webhook solution setup');

-- שאילתה לבדיקת מבנה טבלת הלקוחות
DO $$
DECLARE
  email_column_exists BOOLEAN;
  col_name TEXT;
BEGIN
  -- בדיקה אם קיימת עמודת אימייל בטבלת הלקוחות
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'email'
  ) INTO email_column_exists;
  
  IF email_column_exists THEN
    INSERT INTO debug_logs (message) VALUES ('Email column exists in customers table');
  ELSE
    INSERT INTO debug_logs (message) VALUES ('Email column does not exist in customers table');
  END IF;
  
  -- בדיקה אם קיימות עמודות אחרות שעשויות להכיל אימייל
  FOR col_name IN
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND (column_name LIKE '%email%' OR column_name LIKE '%mail%')
  LOOP
    INSERT INTO debug_logs (message) VALUES ('Potential email column found: ' || col_name);
  END LOOP;
END $$;

-- פונקציה משופרת לשליחת webhook עם אימייל של לקוח
CREATE OR REPLACE FUNCTION public.handle_customer_orders_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  webhook_id UUID;
  business_id_var UUID;
  product_id_var UUID;
  product_name TEXT;
  customer_record RECORD;
  product_record RECORD;
  order_item_record RECORD;
  payload JSONB;
  response_status INT;
  response_body TEXT;
  product_specific_webhook_found BOOLEAN := FALSE;
  category_specific_webhook_found BOOLEAN := FALSE;
  customer_email TEXT;
  auth_user_record RECORD;
BEGIN
  -- לוג התחלת הפונקציה
  INSERT INTO debug_logs (message) VALUES ('Starting email webhook function. NEW.status=' || NEW.status);
  
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
        product_id_var := order_item_record.product_id;
        
        -- שליפת פרטי המוצר
        BEGIN
          SELECT * INTO product_record FROM products p WHERE p.id = product_id_var;
          IF product_record IS NULL THEN
            INSERT INTO debug_logs (message) VALUES ('Product not found for ID=' || product_id_var);
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
    
    -- שליפת פרטי הלקוח והאימייל שלו
    BEGIN
      INSERT INTO debug_logs (message) VALUES ('Trying to find customer with customer_id=' || NEW.customer_id);
      
      -- ניסיון 1: שליפת לקוח מטבלת customers
      BEGIN
        SELECT * INTO customer_record 
        FROM customers c 
        WHERE c.id::TEXT = NEW.customer_id::TEXT;
        
        IF customer_record IS NOT NULL THEN
          INSERT INTO debug_logs (message) VALUES ('Customer found by id in customers table');
          
          -- ניסיון לשלוף את האימייל מהרשומה
          BEGIN
            -- בדיקה אם יש עמודת אימייל
            EXECUTE 'SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = ''customers'' AND column_name = ''email''
            )' INTO STRICT webhook_url;
            
            IF webhook_url = 'true' THEN
              INSERT INTO debug_logs (message) VALUES ('Email column exists, trying to get email');
              EXECUTE 'SELECT email FROM customers WHERE id::TEXT = $1::TEXT' 
              INTO customer_email 
              USING NEW.customer_id;
              
              IF customer_email IS NOT NULL THEN
                INSERT INTO debug_logs (message) VALUES ('Found customer email: ' || customer_email);
              ELSE
                INSERT INTO debug_logs (message) VALUES ('Customer email is NULL');
              END IF;
            ELSE
              INSERT INTO debug_logs (message) VALUES ('Email column does not exist in customers table');
            END IF;
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error getting email from customers table: ' || SQLERRM);
          END;
        ELSE
          INSERT INTO debug_logs (message) VALUES ('Customer not found in customers table');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO debug_logs (message) VALUES ('Error fetching from customers table: ' || SQLERRM);
      END;
      
      -- ניסיון 2: אם לא נמצא אימייל, נסה לשלוף מטבלת auth.users
      IF customer_email IS NULL THEN
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Trying to find email in auth.users table');
          
          -- בדיקה אם טבלת auth.users קיימת
          EXECUTE 'SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = ''auth'' AND table_name = ''users''
          )' INTO STRICT webhook_url;
          
          IF webhook_url = 'true' THEN
            INSERT INTO debug_logs (message) VALUES ('auth.users table exists, trying to get email');
            
            -- ניסיון לשלוף את האימייל לפי id
            BEGIN
              EXECUTE 'SELECT * FROM auth.users WHERE id::TEXT = $1::TEXT' 
              INTO auth_user_record 
              USING NEW.customer_id;
              
              IF auth_user_record IS NOT NULL THEN
                INSERT INTO debug_logs (message) VALUES ('User found in auth.users table');
                
                -- שליפת האימייל
                EXECUTE 'SELECT email FROM auth.users WHERE id::TEXT = $1::TEXT' 
                INTO customer_email 
                USING NEW.customer_id;
                
                IF customer_email IS NOT NULL THEN
                  INSERT INTO debug_logs (message) VALUES ('Found email in auth.users: ' || customer_email);
                ELSE
                  INSERT INTO debug_logs (message) VALUES ('Email in auth.users is NULL');
                END IF;
              ELSE
                INSERT INTO debug_logs (message) VALUES ('User not found in auth.users table');
              END IF;
            EXCEPTION WHEN OTHERS THEN
              INSERT INTO debug_logs (message) VALUES ('Error fetching from auth.users table: ' || SQLERRM);
            END;
          ELSE
            INSERT INTO debug_logs (message) VALUES ('auth.users table does not exist');
          END IF;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error checking auth.users table: ' || SQLERRM);
        END;
      END IF;
      
      -- ניסיון 3: אם עדיין לא נמצא אימייל, נסה לשלוף מטבלת profiles
      IF customer_email IS NULL THEN
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Trying to find email in profiles table');
          
          -- בדיקה אם טבלת profiles קיימת
          EXECUTE 'SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = ''profiles''
          )' INTO STRICT webhook_url;
          
          IF webhook_url = 'true' THEN
            INSERT INTO debug_logs (message) VALUES ('profiles table exists, trying to get email');
            
            -- בדיקה אם יש עמודת אימייל
            EXECUTE 'SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = ''profiles'' AND column_name = ''email''
            )' INTO STRICT webhook_url;
            
            IF webhook_url = 'true' THEN
              INSERT INTO debug_logs (message) VALUES ('Email column exists in profiles table');
              
              -- ניסיון לשלוף את האימייל לפי id
              BEGIN
                EXECUTE 'SELECT email FROM profiles WHERE id::TEXT = $1::TEXT' 
                INTO customer_email 
                USING NEW.customer_id;
                
                IF customer_email IS NOT NULL THEN
                  INSERT INTO debug_logs (message) VALUES ('Found email in profiles: ' || customer_email);
                ELSE
                  INSERT INTO debug_logs (message) VALUES ('Email in profiles is NULL');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                INSERT INTO debug_logs (message) VALUES ('Error fetching email from profiles: ' || SQLERRM);
              END;
            ELSE
              INSERT INTO debug_logs (message) VALUES ('Email column does not exist in profiles table');
            END IF;
          ELSE
            INSERT INTO debug_logs (message) VALUES ('profiles table does not exist');
          END IF;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error checking profiles table: ' || SQLERRM);
        END;
      END IF;
      
      -- ניסיון 4: אם עדיין לא נמצא אימייל, נסה לשלוף מטבלת users
      IF customer_email IS NULL THEN
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Trying to find email in users table');
          
          -- בדיקה אם טבלת users קיימת
          EXECUTE 'SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = ''users''
          )' INTO STRICT webhook_url;
          
          IF webhook_url = 'true' THEN
            INSERT INTO debug_logs (message) VALUES ('users table exists, trying to get email');
            
            -- בדיקה אם יש עמודת אימייל
            EXECUTE 'SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = ''users'' AND column_name = ''email''
            )' INTO STRICT webhook_url;
            
            IF webhook_url = 'true' THEN
              INSERT INTO debug_logs (message) VALUES ('Email column exists in users table');
              
              -- ניסיון לשלוף את האימייל לפי id
              BEGIN
                EXECUTE 'SELECT email FROM users WHERE id::TEXT = $1::TEXT' 
                INTO customer_email 
                USING NEW.customer_id;
                
                IF customer_email IS NOT NULL THEN
                  INSERT INTO debug_logs (message) VALUES ('Found email in users: ' || customer_email);
                ELSE
                  INSERT INTO debug_logs (message) VALUES ('Email in users is NULL');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                INSERT INTO debug_logs (message) VALUES ('Error fetching email from users: ' || SQLERRM);
              END;
            ELSE
              INSERT INTO debug_logs (message) VALUES ('Email column does not exist in users table');
            END IF;
          ELSE
            INSERT INTO debug_logs (message) VALUES ('users table does not exist');
          END IF;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO debug_logs (message) VALUES ('Error checking users table: ' || SQLERRM);
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO debug_logs (message) VALUES ('Error in customer email lookup: ' || SQLERRM);
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
        'created_at', NEW.created_at,
        'customer_id', NEW.customer_id
      )
    );
    
    -- הוספת פרטי לקוח עם אימייל
    IF customer_email IS NOT NULL THEN
      payload := payload || jsonb_build_object(
        'customer', jsonb_build_object(
          'id', NEW.customer_id,
          'email', customer_email
        )
      );
      INSERT INTO debug_logs (message) VALUES ('Added customer with email to payload');
    ELSE
      payload := payload || jsonb_build_object(
        'customer', jsonb_build_object(
          'id', NEW.customer_id
        )
      );
      INSERT INTO debug_logs (message) VALUES ('Added customer without email to payload');
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
    
    -- 1. חיפוש webhook ספציפי למוצר
    IF product_id_var IS NOT NULL THEN
      FOR webhook_url, webhook_id IN 
        SELECT bw.url, bw.id 
        FROM business_webhooks bw
        WHERE bw.business_id = NEW.business_id 
          AND bw.on_product_purchased = TRUE
          AND bw.product_id = product_id_var
      LOOP
        product_specific_webhook_found := TRUE;
        INSERT INTO debug_logs (message) VALUES ('Found product-specific webhook: URL=' || webhook_url || ', ID=' || webhook_id || ', Product ID=' || product_id_var);
        
        -- שליחת ה-webhook
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Sending product-specific webhook to: ' || webhook_url);
          
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
              
            INSERT INTO debug_logs (message) VALUES ('Product-specific webhook response: status=' || response_status || ', body=' || response_body);
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
              product_id_var,
              payload,
              response_status,
              response_body,
              now()
            );
            
            INSERT INTO debug_logs (message) VALUES ('Product-specific webhook log saved');
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error saving product-specific webhook log: ' || SQLERRM);
          END;
        EXCEPTION WHEN OTHERS THEN
          -- לוג של שגיאה כללית, אבל לא נפסיק את התהליך
          INSERT INTO debug_logs (message) VALUES ('General error in product-specific webhook processing: ' || SQLERRM);
        END;
      END LOOP;
    END IF;
    
    -- 2. אם לא נמצא webhook ספציפי למוצר, חפש webhook לפי קטגוריה
    IF NOT product_specific_webhook_found AND product_record IS NOT NULL AND product_record.category IS NOT NULL THEN
      FOR webhook_url, webhook_id IN 
        SELECT bw.url, bw.id 
        FROM business_webhooks bw
        WHERE bw.business_id = NEW.business_id 
          AND bw.on_product_purchased = TRUE
          AND bw.category = product_record.category
          AND bw.product_id IS NULL
      LOOP
        category_specific_webhook_found := TRUE;
        INSERT INTO debug_logs (message) VALUES ('Found category-specific webhook: URL=' || webhook_url || ', ID=' || webhook_id || ', Category=' || product_record.category);
        
        -- שליחת ה-webhook
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Sending category-specific webhook to: ' || webhook_url);
          
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
              
            INSERT INTO debug_logs (message) VALUES ('Category-specific webhook response: status=' || response_status || ', body=' || response_body);
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
              product_id_var,
              payload,
              response_status,
              response_body,
              now()
            );
            
            INSERT INTO debug_logs (message) VALUES ('Category-specific webhook log saved');
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error saving category-specific webhook log: ' || SQLERRM);
          END;
        EXCEPTION WHEN OTHERS THEN
          -- לוג של שגיאה כללית, אבל לא נפסיק את התהליך
          INSERT INTO debug_logs (message) VALUES ('General error in category-specific webhook processing: ' || SQLERRM);
        END;
      END LOOP;
    END IF;
    
    -- 3. אם לא נמצא webhook ספציפי למוצר או לקטגוריה, שלח לכל ה-webhooks הכלליים
    IF NOT product_specific_webhook_found AND NOT category_specific_webhook_found THEN
      INSERT INTO debug_logs (message) VALUES ('No product or category specific webhook found. Sending to general webhooks.');
      
      FOR webhook_url, webhook_id IN 
        SELECT bw.url, bw.id 
        FROM business_webhooks bw
        WHERE bw.business_id = NEW.business_id 
          AND bw.on_order_paid = TRUE
          AND bw.product_id IS NULL
          AND bw.category IS NULL
      LOOP
        INSERT INTO debug_logs (message) VALUES ('Found general webhook: URL=' || webhook_url || ', ID=' || webhook_id);
        
        -- שליחת ה-webhook
        BEGIN
          INSERT INTO debug_logs (message) VALUES ('Sending general webhook to: ' || webhook_url);
          
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
              
            INSERT INTO debug_logs (message) VALUES ('General webhook response: status=' || response_status || ', body=' || response_body);
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
              product_id_var,
              payload,
              response_status,
              response_body,
              now()
            );
            
            INSERT INTO debug_logs (message) VALUES ('General webhook log saved');
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message) VALUES ('Error saving general webhook log: ' || SQLERRM);
          END;
        EXCEPTION WHEN OTHERS THEN
          -- לוג של שגיאה כללית, אבל לא נפסיק את התהליך
          INSERT INTO debug_logs (message) VALUES ('General error in general webhook processing: ' || SQLERRM);
        END;
      END LOOP;
    END IF;
  ELSE
    INSERT INTO debug_logs (message) VALUES ('Status is not completed. Current status=' || NEW.status);
  END IF;
  
  INSERT INTO debug_logs (message) VALUES ('Finished email webhook function');
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
INSERT INTO debug_logs (message) VALUES ('Fixed email webhook solution created successfully');

-- בדיקת הטריגר
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_customer_orders_webhook';
