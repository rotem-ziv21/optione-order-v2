-- קודם כל נשנה את הסטטוס למשהו אחר כדי שנוכל לשנות אותו חזרה ל-completed
UPDATE customer_orders 
SET status = 'paid' 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';

-- בדיקה שהעדכון הצליח
SELECT id, status FROM customer_orders 
WHERE id = '04044063-2275-4232-8759-5977cfcdf54f';
