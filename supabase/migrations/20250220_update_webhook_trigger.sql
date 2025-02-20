CREATE OR REPLACE FUNCTION process_webhook_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- אם אין business_id, פשוט נחזיר
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- אם השתנה הסטטוס ל-completed
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
    -- נשלח ישירות לפונקציה הקיימת
    PERFORM pg_notify(
      'webhooks',
      json_build_object(
        'event', 'order_paid',
        'business_id', NEW.business_id,
        'data', json_build_object(
          'id', NEW.id,
          'status', NEW.status,
          'payment_method', NEW.payment_method,
          'payment_reference', NEW.payment_reference,
          'paid_at', NEW.paid_at,
          'is_paid', true
        )
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
