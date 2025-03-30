import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, CreditCard, DollarSign } from 'lucide-react';

interface StaffStats {
  staff_id: string;
  staff_name: string;
  total_orders: number;
  total_amount: number;
  avg_order_value: number;
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
        .select('role')
        .eq('user_id', user?.id)
        .eq('business_id', currentBusinessId)
        .single();
      
      // בדיקה אם המשתמש הוא מנהל עסק
      const isBusinessAdmin = staffMember?.role === 'admin';
      
      setHasAccess(isBusinessAdmin || isSuperAdmin);
    };
    
    checkAccess();
  }, [currentBusinessId]);

  const getCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
    }
  };

  const fetchStaffStats = async () => {
    if (!currentBusinessId) return;
    
    try {
      setLoading(true);
      
      // שימוש בפונקציה החדשה get_staff_sales_stats
      const { data, error: statsError } = await supabase
        .rpc('get_staff_sales_stats', {
          p_business_id: currentBusinessId
        });
      
      if (statsError) {
        throw statsError;
      }
      
      setStats(data || []);
    } catch (error) {
      console.error('Error fetching staff stats:', error);
      setError('שגיאה בטעינת נתוני אנשי צוות');
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ביצועי אנשי צוות</h2>
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-gray-400">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ביצועי אנשי צוות</h2>
        <div className="text-red-500 p-4 text-center">{error}</div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ביצועי אנשי צוות</h2>
        <div className="text-gray-500 p-4 text-center">אין נתונים להצגה</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">ביצועי אנשי צוות</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                איש צוות
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מספר מכירות
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                סה"כ מכירות
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                ממוצע להזמנה
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stats.map((staff) => (
              <tr key={staff.staff_id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{staff.staff_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff.total_orders}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ₪{staff.total_amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ₪{staff.avg_order_value.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Top Seller */}
        {stats.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">איש צוות מוביל</p>
                <p className="text-sm font-semibold">{stats[0].staff_name}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-blue-600">₪{stats[0].total_amount.toFixed(2)}</p>
          </div>
        )}
        
        {/* Most Orders */}
        {stats.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-full">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">הכי הרבה מכירות</p>
                <p className="text-sm font-semibold">
                  {stats.sort((a, b) => b.total_orders - a.total_orders)[0].staff_name}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-green-600">
              {stats.sort((a, b) => b.total_orders - a.total_orders)[0].total_orders} מכירות
            </p>
          </div>
        )}
        
        {/* Highest Avg */}
        {stats.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-full">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">ממוצע מכירה גבוה</p>
                <p className="text-sm font-semibold">
                  {stats.filter(s => s.total_orders > 0).sort((a, b) => b.avg_order_value - a.avg_order_value)[0]?.staff_name || 'אין נתונים'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-purple-600">
              ₪{stats.filter(s => s.total_orders > 0).sort((a, b) => b.avg_order_value - a.avg_order_value)[0]?.avg_order_value.toFixed(2) || '0.00'}
            </p>
          </div>
        )}
        
        {/* Total Sales */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-2 rounded-full">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-yellow-600 font-medium">סה"כ מכירות צוות</p>
              <p className="text-sm font-semibold">כל אנשי הצוות</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-yellow-600">
            ₪{stats.reduce((sum, staff) => sum + Number(staff.total_amount), 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
