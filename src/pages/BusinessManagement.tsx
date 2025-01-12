import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Database,
  AlertCircle,
  Settings as SettingsIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BusinessUserForm from '../components/BusinessUserForm';
import DateRangeFilter from '../components/DateRangeFilter';
import { startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface Business {
  id: string;
  name: string;
  active: boolean;
}

interface Statistics {
  totalBusinesses: number;
  activeBusinesses: number;
  totalUsers: number;
  totalQuotes: number;
}

interface SystemLog {
  id: number;
  created_at: string;
  event_type: string;
  description: string;
  metadata: any;
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
}

export default function BusinessManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [activeTab, setActiveTab] = useState<'businesses' | 'statistics' | 'logs' | 'settings'>('statistics');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0
  });

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  useEffect(() => {
    checkUserAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchBusinesses();
    }
    fetchStatistics();
    fetchSystemLogs();
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'statistics') {
      fetchOrderStats();
    }
  }, [dateRange, activeTab]);

  const checkUserAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא נמצא משתמש מחובר');

      // בדיקת הרשאות לפי אימייל
      setIsAdmin(user.email === 'rotemziv7766@gmail.com');
      setIsLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה בבדיקת הרשאות');
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת העסקים');
    }
  };

  const fetchStatistics = async () => {
    try {
      const [businessesResult, usersResult, quotesResult] = await Promise.all([
        supabase.from('businesses').select('*', { count: 'exact' }),
        supabase.from('user_profiles').select('*', { count: 'exact' }),
        supabase.from('quotes').select('*', { count: 'exact' })
      ]);

      const activeBusinesses = businessesResult.data?.filter(b => b.active).length || 0;

      setStatistics({
        totalBusinesses: businessesResult.count || 0,
        activeBusinesses,
        totalUsers: usersResult.count || 0,
        totalQuotes: quotesResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת הסטטיסטיקות');
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSystemLogs(data || []);
    } catch (error) {
      console.error('Error fetching system logs:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת הלוגים');
    }
  };

  const fetchOrderStats = async () => {
    try {
      let query = supabase
        .from('customer_orders')
        .select('*', { count: 'exact' });

      // Add date range filter if selected
      if (dateRange?.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data: orders, error: ordersError, count } = await query;

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const averageOrderValue = count ? totalRevenue / count : 0;
      const completedOrders = orders?.filter(order => order.status === 'completed').length || 0;
      const pendingOrders = orders?.filter(order => order.status === 'pending').length || 0;
      const cancelledOrders = orders?.filter(order => order.status === 'cancelled').length || 0;

      setOrderStats({
        totalOrders: count || 0,
        totalRevenue,
        averageOrderValue,
        completedOrders,
        pendingOrders,
        cancelledOrders
      });
    } catch (error) {
      console.error('Error fetching order stats:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת הנתונים');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // פונקציה ליצירת משתמש חדש
  const createUser = async (email: string, password: string, businessId: string) => {
    try {
      // יצירת משתמש חדש
      const { data: authUser, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;

      if (!authUser.user) throw new Error('שגיאה ביצירת המשתמש');

      // הוספת המשתמש לעסק
      const { error: staffError } = await supabase
        .from('business_staff')
        .insert([
          { user_id: authUser.user.id, business_id: businessId }
        ]);
      if (staffError) throw staffError;

      // רענון הנתונים
      fetchBusinesses();
      fetchStatistics();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה ביצירת משתמש');
    }
  };

  // פונקציה ליצירת עסק חדש
  const createBusiness = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert([
          { name, active: true }
        ])
        .select()
        .single();
      
      if (error) throw error;
      
      // רענון הנתונים
      fetchBusinesses();
      fetchStatistics();
      
      return data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה ביצירת עסק');
      return null;
    }
  };

  // פונקציה להשהיית/הפעלת עסק
  const toggleBusinessStatus = async (businessId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ active })
        .eq('id', businessId);
      
      if (error) throw error;
      
      // רענון הנתונים
      fetchBusinesses();
      fetchStatistics();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס העסק');
    }
  };

  // פונקציה לאיפוס הטופס וסגירת המודל
  const handleCloseUserModal = () => {
    setShowAddUserModal(false);
    setSelectedBusiness(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ אין גישה</div>
          <p className="text-gray-600">אין לך הרשאות לצפות בדף זה</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('businesses')}
              className={`${
                activeTab === 'businesses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              עסקים
            </button>
          )}
          <button
            onClick={() => setActiveTab('statistics')}
            className={`${
              activeTab === 'statistics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            סטטיסטיקות
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('logs')}
                className={`${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                לוגים
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                הגדרות
              </button>
            </>
          )}
        </nav>
      </div>

      {activeTab === 'businesses' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">רשימת עסקים</h2>
              <BusinessUserForm onSuccess={fetchBusinesses} />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      שם העסק
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      סטטוס
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {businesses.map((business) => (
                    <tr key={business.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {business.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            business.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {business.active ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* General Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">סה"כ עסקים</h3>
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold">{statistics?.totalBusinesses}</div>
              <div className="text-sm text-gray-500 mt-2">
                {statistics?.activeBusinesses} פעילים
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">סה"כ משתמשים</h3>
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-3xl font-bold">{statistics?.totalUsers}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">סה"כ הצעות מחיר</h3>
                <Database className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-3xl font-bold">{statistics?.totalQuotes}</div>
            </div>
          </div>

          {/* Order Statistics */}
          <div>
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900">סטטיסטיקות הזמנות</h2>
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">סה"כ הזמנות</h3>
                <p className="text-3xl font-bold text-blue-600">{orderStats.totalOrders}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">סה"כ הכנסות</h3>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(orderStats.totalRevenue)}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">ממוצע להזמנה</h3>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(orderStats.averageOrderValue)}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">הזמנות שהושלמו</h3>
                <p className="text-3xl font-bold text-green-600">{orderStats.completedOrders}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">הזמנות בהמתנה</h3>
                <p className="text-3xl font-bold text-yellow-600">{orderStats.pendingOrders}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">הזמנות שבוטלו</h3>
                <p className="text-3xl font-bold text-red-600">{orderStats.cancelledOrders}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">לוגים אחרונים</h2>
            <div className="space-y-4">
              {systemLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {log.event_type}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {log.description}
                      </p>
                    </div>
                    <time className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString('he-IL')}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 text-yellow-600 bg-yellow-50 p-4 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5" />
            <span>הגדרות המערכת יתווספו בקרוב</span>
          </div>
        </div>
      )}
      {/* כפתורים ראשיים */}
      <div className="flex justify-end space-x-4 mb-6">
        <button
          onClick={() => setShowAddBusinessModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Building2 className="mr-2 h-5 w-5" />
          הוסף עסק חדש
        </button>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
        >
          <Users className="mr-2 h-5 w-5" />
          הוסף משתמש חדש
        </button>
      </div>

      {/* טאבים */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('businesses')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'businesses' ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          עסקים
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'statistics' ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          סטטיסטיקות
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'logs' ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          לוגים
        </button>
      </div>

      {/* תצוגת עסקים */}
      {activeTab === 'businesses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{business.name}</h3>
                <span
                  className={`px-2 py-1 rounded-full text-sm ${
                    business.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {business.active ? 'פעיל' : 'מושהה'}
                </span>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => toggleBusinessStatus(business.id, !business.active)}
                  className={`w-full px-4 py-2 rounded-lg ${
                    business.active
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {business.active ? 'השהה עסק' : 'הפעל עסק'}
                </button>
                <button
                  onClick={() => {
                    setSelectedBusiness(business);
                    setShowAddUserModal(true);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  הוסף משתמש לעסק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* מודל הוספת משתמש */}
      {showAddUserModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseUserModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
            {/* כפתור סגירה */}
            <button
              onClick={handleCloseUserModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="סגור"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-semibold mb-4 pl-6">הוספת משתמש {selectedBusiness ? `ל${selectedBusiness.name}` : 'חדש'}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createUser(
                formData.get('email') as string,
                formData.get('password') as string,
                formData.get('businessId') as string
              );
              handleCloseUserModal();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    אימייל
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס אימייל"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    סיסמה
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="הכנס סיסמה (לפחות 6 תווים)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    עסק
                  </label>
                  <select
                    name="businessId"
                    required
                    defaultValue={selectedBusiness?.id || ''}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">בחר עסק</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseUserModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                >
                  הוסף משתמש
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* מודל הוספת עסק */}
      {showAddBusinessModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddBusinessModal(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
            {/* כפתור סגירה */}
            <button
              onClick={() => setShowAddBusinessModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="סגור"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-semibold mb-4 pl-6">הוספת עסק חדש</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const business = await createBusiness(formData.get('name') as string);
              if (business) {
                setShowAddBusinessModal(false);
              }
            }}>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  שם העסק
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="הכנס שם עסק"
                  autoFocus
                />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddBusinessModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                >
                  הוסף עסק
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}