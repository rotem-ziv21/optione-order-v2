import { supabase } from '../lib/supabase';

export interface SalesByStaff {
  staff_id: string;
  staff_name: string;
  total_sales: number;
  percentage: number;
}

export interface ProductsByStaff {
  product_id: string;
  product_name: string;
  staff_id: string;
  staff_name: string;
  quantity: number;
  total_amount: number;
}

export interface MonthlySalesProgress {
  current_month: string;
  target_amount: number;
  current_amount: number;
  percentage: number;
  remaining_amount: number;
  days_remaining: number;
  daily_target: number;
}

export async function getSalesByStaff(
  businessId: string,
  startDate: Date,
  endDate: Date
): Promise<SalesByStaff[]> {
  try {
    // נסה להשתמש בפונקציה החדשה
    const { data, error } = await supabase.rpc('get_sales_by_staff', {
      p_business_id: businessId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      console.error('Error fetching sales by staff with RPC:', error);
      
      // אם הפונקציה לא קיימת, נשתמש בשאילתה רגילה
      const { data: ordersData, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          id,
          total_amount,
          staff_id,
          team(name)
        `)
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return [];
      }

      // חישוב סך המכירות
      const totalSales = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);

      // קיבוץ לפי איש צוות
      const staffMap = new Map<string, SalesByStaff>();
      
      for (const order of ordersData) {
        if (!order.staff_id) continue;
        
        const staffId = order.staff_id;
        const staffName = order.team?.name || 'לא ידוע';
        const amount = order.total_amount || 0;
        
        if (staffMap.has(staffId)) {
          const staff = staffMap.get(staffId)!;
          staff.total_sales += amount;
        } else {
          staffMap.set(staffId, {
            staff_id: staffId,
            staff_name: staffName,
            total_sales: amount,
            percentage: 0
          });
        }
      }
      
      // חישוב אחוזים
      const result = Array.from(staffMap.values());
      for (const staff of result) {
        staff.percentage = totalSales > 0 ? Math.round((staff.total_sales / totalSales) * 100 * 100) / 100 : 0;
      }
      
      return result.sort((a, b) => b.total_sales - a.total_sales);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSalesByStaff:', error);
    return [];
  }
}

export async function getProductsByStaff(
  businessId: string,
  startDate: Date,
  endDate: Date
): Promise<ProductsByStaff[]> {
  try {
    // נסה להשתמש בפונקציה החדשה
    const { data, error } = await supabase.rpc('get_products_by_staff', {
      p_business_id: businessId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      console.error('Error fetching products by staff with RPC:', error);
      
      // אם הפונקציה לא קיימת, נשתמש בשאילתה רגילה
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price_at_time,
          product_id,
          products(name),
          order_id,
          customer_orders(staff_id, team(name))
        `)
        .eq('customer_orders.business_id', businessId)
        .eq('customer_orders.status', 'completed')
        .gte('customer_orders.created_at', startDate.toISOString())
        .lte('customer_orders.created_at', endDate.toISOString());

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        return [];
      }

      // קיבוץ לפי מוצר ואיש צוות
      const productStaffMap = new Map<string, ProductsByStaff>();
      
      for (const item of orderItems) {
        if (!item.product_id) continue;
        
        const productId = item.product_id;
        const productName = item.products?.name || 'לא ידוע';
        const staffId = item.customer_orders?.staff_id || 'unknown';
        const staffName = item.customer_orders?.team?.name || 'לא ידוע';
        const quantity = item.quantity || 0;
        const amount = (item.quantity || 0) * (item.price_at_time || 0);
        
        const key = `${productId}-${staffId}`;
        
        if (productStaffMap.has(key)) {
          const productStaff = productStaffMap.get(key)!;
          productStaff.quantity += quantity;
          productStaff.total_amount += amount;
        } else {
          productStaffMap.set(key, {
            product_id: productId,
            product_name: productName,
            staff_id: staffId,
            staff_name: staffName,
            quantity: quantity,
            total_amount: amount
          });
        }
      }
      
      return Array.from(productStaffMap.values()).sort((a, b) => b.total_amount - a.total_amount);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getProductsByStaff:', error);
    return [];
  }
}

export async function getMonthlySalesProgress(
  businessId: string
): Promise<MonthlySalesProgress | null> {
  try {
    // נסה להשתמש בפונקציה החדשה
    const { data, error } = await supabase.rpc('get_monthly_sales_progress', {
      p_business_id: businessId,
    });

    if (error) {
      console.error('Error fetching monthly sales progress with RPC:', error);
      
      // אם הפונקציה לא קיימת, נחשב את הנתונים בצד הלקוח
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // קבל את היעד החודשי
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('monthly_sales_target')
        .eq('id', businessId)
        .single();
      
      if (businessError) {
        console.error('Error fetching business data:', businessError);
        // אם אין עמודת monthly_sales_target, נשתמש בערך ברירת מחדל
        const targetAmount = 0;
        
        // קבל את סך המכירות החודשי
        const { data: salesData, error: salesError } = await supabase
          .from('customer_orders')
          .select('total_amount')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        if (salesError) {
          console.error('Error fetching sales data:', salesError);
          return null;
        }
        
        const currentAmount = salesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const percentage = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100 * 100) / 100 : 0;
        const remainingAmount = Math.max(0, targetAmount - currentAmount);
        
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemaining = daysInMonth - now.getDate() + 1;
        const dailyTarget = daysRemaining > 0 && remainingAmount > 0 ? remainingAmount / daysRemaining : 0;
        
        return {
          current_month: now.toLocaleString('he-IL', { month: 'long', year: 'numeric' }),
          target_amount: targetAmount,
          current_amount: currentAmount,
          percentage: percentage,
          remaining_amount: remainingAmount,
          days_remaining: daysRemaining,
          daily_target: dailyTarget
        };
      }
      
      const targetAmount = businessData.monthly_sales_target || 0;
      
      // קבל את סך המכירות החודשי
      const { data: salesData, error: salesError } = await supabase
        .from('customer_orders')
        .select('total_amount')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      
      if (salesError) {
        console.error('Error fetching sales data:', salesError);
        return null;
      }
      
      const currentAmount = salesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const percentage = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100 * 100) / 100 : 0;
      const remainingAmount = Math.max(0, targetAmount - currentAmount);
      
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - now.getDate() + 1;
      const dailyTarget = daysRemaining > 0 && remainingAmount > 0 ? remainingAmount / daysRemaining : 0;
      
      return {
        current_month: now.toLocaleString('he-IL', { month: 'long', year: 'numeric' }),
        target_amount: targetAmount,
        current_amount: currentAmount,
        percentage: percentage,
        remaining_amount: remainingAmount,
        days_remaining: daysRemaining,
        daily_target: dailyTarget
      };
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Error in getMonthlySalesProgress:', error);
    return null;
  }
}

export async function updateMonthlySalesTarget(
  businessId: string,
  targetAmount: number
): Promise<boolean> {
  try {
    // בדוק אם העמודה קיימת לפני שמנסים לעדכן אותה
    const { error: checkError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking business table:', checkError);
      throw new Error('Could not access business data');
    }
    
    try {
      // נסה לעדכן את העמודה
      const { error } = await supabase
        .from('businesses')
        .update({ monthly_sales_target: targetAmount })
        .eq('id', businessId);

      if (error) {
        // אם העמודה לא קיימת, נציג שגיאה ברורה
        if (error.message && error.message.includes("monthly_sales_target")) {
          throw new Error('העמודה monthly_sales_target לא קיימת בטבלה. יש להריץ את קובץ המיגרציה 20250330_add_sales_targets.sql');
        }
        throw error;
      }

      return true;
    } catch (updateError: any) {
      console.error('Error updating monthly sales target:', updateError);
      
      // אם העמודה לא קיימת, ננסה לשמור את הערך בלוקל סטורג' זמנית
      if (updateError.message && updateError.message.includes("monthly_sales_target")) {
        try {
          // שמירה זמנית בלוקל סטורג'
          localStorage.setItem(`business_${businessId}_target`, targetAmount.toString());
          alert('היעד נשמר באופן זמני בדפדפן. כדי לשמור אותו באופן קבוע, יש להריץ את קובץ המיגרציה.');
          return true;
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in updateMonthlySalesTarget:', error);
    return false;
  }
}
