import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Users, Settings as SettingsIcon, Edit2, Trash2, UserPlus, X,
  BarChart2, Eye, EyeOff, Activity, Database, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BusinessUserForm from '../components/BusinessUserForm';

interface Business {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  owner_id: string;
  settings: Record<string, any>;
}

interface Staff {
  id: string;
  user_id: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  email: string;
  permissions: Record<string, boolean>;
  user_created_at: string;
}

interface Statistics {
  totalBusinesses: number;
  activeBusinesses: number;
  totalUsers: number;
  totalQuotes: number;
}

interface SystemLog {
  id: string;
  action: string;
  details: string;
  created_at: string;
  user_email: string;
}

export default function BusinessManagement() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessStaff, setBusinessStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [activeTab, setActiveTab] = useState<'businesses' | 'statistics' | 'logs' | 'settings'>('businesses');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    // רק אם המשתמש הוא אדמין, טען את העסקים
    if (isAdmin) {
      fetchBusinesses();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user details:', {
        email: user?.email,
        id: user?.id,
        role: user?.role,
        metadata: user?.user_metadata
      });

      if (!user) {
        console.log('No user logged in');
        setIsLoading(false);
        return;
      }

      // בדיקת הרשאות לפי מייל
      const isAdminByEmail = user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com';
      setIsAdmin(isAdminByEmail);
      
      console.log('Is admin by email:', isAdminByEmail);
    } catch (error) {
      console.error('Detailed error checking admin access:', error);
      setError('שגיאה בבדיקת הרשאות: ' + (error instanceof Error ? error.message : 'שגיאה לא ידועה'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // אם המשתמש הוא אדמין, הוא יכול לראות את כל העסקים
      const isAdminUser = user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com';
      
      if (isAdminUser) {
        // אדמין רואה את כל העסקים
        const { data: businessesData, error: businessesError } = await supabase
          .from('businesses')
          .select('*')
          .order('created_at', { ascending: false });

        if (businessesError) {
          console.error('Detailed error:', businessesError);
          throw businessesError;
        }
        
        console.log('Fetched businesses:', businessesData);
        setBusinesses(businessesData || []);
      } else {
        // משתמש רגיל רואה רק את העסקים שלו
        const { data: staffBusinesses, error: staffError } = await supabase
          .from('business_staff')
          .select('business_id')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (staffError) {
          console.error('Error fetching staff businesses:', staffError);
          throw staffError;
        }

        if (staffBusinesses && staffBusinesses.length > 0) {
          const businessIds = staffBusinesses.map(sb => sb.business_id);
          const { data: businessesData, error: businessesError } = await supabase
            .from('businesses')
            .select('*')
            .in('id', businessIds)
            .order('created_at', { ascending: false });

          if (businessesError) throw businessesError;
          setBusinesses(businessesData || []);
        } else {
          setBusinesses([]);
        }
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setError('שגיאה בטעינת העסקים');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessStaff = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('business_staff_with_users')
        .select('*')
        .eq('business_id', businessId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business staff:', error);
      setError('שגיאה בטעינת צוות העסק');
      return [];
    }
  };

  const handleSelectBusiness = async (business: Business) => {
    try {
      const staff = await fetchBusinessStaff(business.id);
      setSelectedBusiness(business);
      setBusinessStaff(staff);
    } catch (error) {
      console.error('Error selecting business:', error);
      setError('שגיאה בטעינת פרטי העסק');
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('business_staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      // רענן את רשימת הצוות
      if (selectedBusiness) {
        const staff = await fetchBusinessStaff(selectedBusiness.id);
        setBusinessStaff(staff);
      }
    } catch (error) {
      console.error('Error removing staff:', error);
      setError('שגיאה בהסרת איש צוות');
    }
  };

  const fetchStatistics = async () => {
    try {
      // Get total businesses count
      const { count: totalBusinesses } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true });

      // Get active businesses count
      const { count: activeBusinesses } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total users count
      const { count: totalUsers } = await supabase
        .from('business_staff')
        .select('*', { count: 'exact', head: true });

      // Get total quotes count
      const { count: totalQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true });

      setStatistics({
        totalBusinesses: totalBusinesses || 0,
        activeBusinesses: activeBusinesses || 0,
        totalUsers: totalUsers || 0,
        totalQuotes: totalQuotes || 0
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSystemLogs(data || []);
    } catch (error) {
      console.error('Error fetching system logs:', error);
    }
  };

  const toggleBusinessStatus = async (business: Business) => {
    try {
      const newStatus = business.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('businesses')
        .update({ status: newStatus })
        .eq('id', business.id);

      if (error) throw error;

      // Update local state
      setBusinesses(businesses.map(b => 
        b.id === business.id ? { ...b, status: newStatus } : b
      ));

      // Log the action
      await supabase.from('system_logs').insert({
        action: 'update_business_status',
        details: `Changed business ${business.name} status to ${newStatus}`,
        user_email: (await supabase.auth.getUser()).data.user?.email
      });

      // Refresh statistics
      fetchStatistics();
    } catch (error) {
      console.error('Error toggling business status:', error);
      setError('שגיאה בעדכון סטטוס העסק');
    }
  };

  const handleAddBusiness = async () => {
    if (!newBusinessName.trim()) {
      setError('נא להזין שם עסק');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('משתמש לא מחובר');
        return;
      }

      // הוספת העסק
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert([{
          name: newBusinessName.trim(),
          status: 'active',
          owner_id: user.id,
          settings: {}
        }])
        .select('*')
        .single();

      if (businessError) {
        console.error('Business creation error:', businessError);
        throw businessError;
      }
      
      if (!newBusiness) {
        throw new Error('לא נוצר עסק חדש');
      }

      console.log('Created new business:', newBusiness);

      // הוספת המשתמש כאדמין בעסק
      const { error: staffError } = await supabase
        .from('business_staff')
        .insert([{
          user_id: user.id,
          business_id: newBusiness.id,
          role: 'admin',
          status: 'active',
          permissions: {
            can_view_customers: true,
            can_edit_customers: true,
            can_view_products: true,
            can_edit_products: true,
            can_view_orders: true,
            can_edit_orders: true,
            can_manage_staff: true
          }
        }]);

      if (staffError) {
        console.error('Staff creation error:', staffError);
        throw staffError;
      }

      // לוג הפעולה
      await supabase.from('system_logs').insert({
        action: 'create_business',
        details: `Created new business: ${newBusiness.name}`,
        user_email: user.email
      });

      setShowAddBusiness(false);
      setNewBusinessName('');
      fetchBusinesses();
      fetchStatistics();
    } catch (error) {
      console.error('Error adding business:', error);
      setError('שגיאה בהוספת העסק: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStatistics();
      fetchSystemLogs();
    }
  }, [isAdmin]);

  // אם עדיין טוען, הצג מסך טעינה
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  // אם המשתמש לא אדמין, הצג הודעת שגיאה
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-600 mb-4">
          <X className="w-16 h-16" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">אין גישה</h1>
        <p className="text-gray-600">אין לך הרשאות לצפות בדף זה</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tabs */}
      <div className="flex space-x-4 mb-8">
        <button
          onClick={() => setActiveTab('businesses')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
            activeTab === 'businesses' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span>עסקים</span>
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
            activeTab === 'statistics' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span>סטטיסטיקות</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
            activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span>לוגים</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
            activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span>הגדרות</span>
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'businesses' && (
        <div className="space-y-6">
          {/* Add Business Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddBusiness(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>הוסף עסק</span>
            </button>
          </div>

          {/* Businesses List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((business) => (
              <div key={business.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{business.name}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleBusinessStatus(business)}
                      className={`p-2 rounded-lg ${
                        business.status === 'active' 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title={business.status === 'active' ? 'חסום עסק' : 'הפעל עסק'}
                    >
                      {business.status === 'active' ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleSelectBusiness(business)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="ערוך עסק"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  נוצר ב-{new Date(business.created_at).toLocaleDateString('he-IL')}
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{businessStaff.filter(s => s.id === business.id).length} משתמשים</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'statistics' && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">סה"כ עסקים</h3>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold">{statistics.totalBusinesses}</div>
            <div className="text-sm text-gray-500 mt-2">
              {statistics.activeBusinesses} פעילים
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">סה"כ משתמשים</h3>
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold">{statistics.totalUsers}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">סה"כ הצעות מחיר</h3>
              <Database className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold">{statistics.totalQuotes}</div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פרטים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    משתמש
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {systemLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.details}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.user_email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-2 text-yellow-600 bg-yellow-50 p-4 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5" />
            <span>הגדרות המערכת יתווספו בקרוב</span>
          </div>
        </div>
      )}

      {/* Add Business Modal */}
      {showAddBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowAddBusiness(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-xl font-semibold mb-4">הוספת עסק חדש</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם העסק
                </label>
                <input
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="הכנס שם עסק"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddBusiness(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  ביטול
                </button>
                <button
                  onClick={handleAddBusiness}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  הוסף עסק
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Business Staff */}
      {selectedBusiness && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              צוות - {selectedBusiness.name}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddUser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
              >
                <UserPlus className="w-5 h-5" />
                <span>הוסף משתמש</span>
              </button>
              <button
                onClick={() => setSelectedBusiness(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {businessStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex justify-between items-center p-4 border border-gray-200 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">{staff.email}</div>
                  <div className="text-sm text-gray-500">
                    {staff.role === 'admin' ? 'מנהל' : 'צוות'}
                  </div>
                  <div className="text-sm text-gray-500">
                    נוצר ב-{new Date(staff.user_created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    className={`text-sm px-2 py-1 rounded-full ${
                      staff.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {staff.status === 'active' ? 'פעיל' : 'לא פעיל'}
                  </button>
                  <button 
                    onClick={() => handleRemoveStaff(staff.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && selectedBusiness && (
        <BusinessUserForm
          businessId={selectedBusiness.id}
          onClose={() => setShowAddUser(false)}
          onSuccess={() => {
            handleSelectBusiness(selectedBusiness);
            setShowAddUser(false);
          }}
        />
      )}
    </div>
  );
}