import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, CreditCard, DollarSign } from 'lucide-react';

interface StaffStats {
  user_id: string;
  email: string;
  total_orders: number;
  total_amount: number;
  avg_order_value: number;
  largest_order: number;
}

export default function StaffStats() {
  const [stats, setStats] = useState<StaffStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchStaffStats();
    }
  }, [currentBusinessId]);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // בדיקה אם המשתמש הוא סופר-אדמין
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      const isSuperAdmin = profile?.role === 'super_admin';
      
      if (isSuperAdmin) {
        setHasAccess(true);
        return;
      }

      if (!currentBusinessId) return;

      const { data: staffMember } = await supabase
        .from('business_staff')
        .select('user_id')
        .eq('business_id', currentBusinessId)
        .eq('user_id', user?.id)
        .single();

      setHasAccess(!!staffMember);
    };

    checkAccess();
  }, [currentBusinessId]);

  const getCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('משתמש לא מחובר');
        return;
      }

      if (user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com') {
        const { data: businesses } = await supabase
          .from('businesses')
          .select('id')
          .limit(1)
          .single();
        
        if (businesses) {
          setCurrentBusinessId(businesses.id);
        }
      } else {
        const { data: staffBusiness } = await supabase
          .from('business_staff')
          .select('business_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        if (staffBusiness) {
          setCurrentBusinessId(staffBusiness.business_id);
        }
      }
    } catch (error) {
      console.error('Error getting current business:', error);
      setError('שגיאה בטעינת העסק');
    }
  };

  const fetchStaffStats = async () => {
    if (!hasAccess) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isSuperAdmin = user?.email === 'rotemziv7766@gmail.com';

      // קבלת כל ההזמנות ששולמו עם פרטי המשתמש
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select('created_by, total_amount, status, business_id')
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      // סינון הזמנות לפי הרשאות
      const filteredOrders = isSuperAdmin 
        ? orders 
        : orders.filter(order => order.business_id === currentBusinessId);

      // קבלת פרטי המשתמשים
      const userIds = [...new Set(filteredOrders.map(order => order.created_by))];
      const { data: users, error: usersError } = await supabase
        .rpc('get_users_by_ids', {
          user_ids: userIds
        });

      if (usersError) throw usersError;

      // יצירת מפה של משתמשים לגישה מהירה
      const userMap = new Map(users.map(user => [user.id, user]));

      // עיבוד הנתונים לסטטיסטיקות לפי נציג
      const statsMap = new Map<string, StaffStats>();

      filteredOrders.forEach(order => {
        const userId = order.created_by;
        const user = userMap.get(userId);
        const email = user?.email || 'לא ידוע';
        const amount = Number(order.total_amount || 0);
        
        if (!statsMap.has(userId)) {
          statsMap.set(userId, {
            user_id: userId,
            email: email,
            total_orders: 0,
            total_amount: 0,
            avg_order_value: 0,
            largest_order: 0
          });
        }

        const stats = statsMap.get(userId)!;
        stats.total_orders++;
        stats.total_amount += amount;
        stats.largest_order = Math.max(stats.largest_order, amount);
      });

      // חישוב ממוצע לכל נציג
      statsMap.forEach(stats => {
        stats.avg_order_value = stats.total_amount / stats.total_orders;
      });

      // מיון לפי סכום כולל
      const sortedStats = Array.from(statsMap.values())
        .sort((a, b) => b.total_amount - a.total_amount);

      setStats(sortedStats);
    } catch (error) {
      console.error('Error fetching staff stats:', error);
      setError('שגיאה בטעינת הסטטיסטיקות');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hasAccess ? (
        <div className="text-center p-4">
          <h2 className="text-xl font-bold text-red-600">אין הרשאות גישה</h2>
          <p className="text-gray-600">אין לך הרשאות לצפות בדף זה</p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-900">סטטיסטיקות מכירות לפי נציג</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {stats.map((stat) => (
              <div
                key={stat.user_id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">{stat.email}</h3>
                  <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {stat.total_orders} הזמנות
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">סה"כ מכירות</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₪{stat.total_amount.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">ממוצע להזמנה</p>
                    <p className="text-lg font-semibold text-gray-800">
                      ₪{stat.avg_order_value.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">הזמנה גדולה ביותר</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      ₪{stat.largest_order.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
