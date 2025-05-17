-- טבלת לוגים לדיבוג
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- פונקציה פשוטה שתופעל בכל פעם שהזמנה מתעדכנת
CREATE OR REPLACE FUNCTION public.simple_order_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- לוג פשוט שמראה שהטריגר הופעל
  INSERT INTO debug_logs (message) VALUES (
    'Order updated: ID=' || NEW.id || 
    ', OLD.status=' || OLD.status || 
    ', NEW.status=' || NEW.status
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר פשוט שיפעיל את הפונקציה בכל פעם שהזמנה מתעדכנת
DROP TRIGGER IF EXISTS simple_order_update_trigger ON orders;
CREATE TRIGGER simple_order_update_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION simple_order_update_trigger();
