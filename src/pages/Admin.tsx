import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Business = Database['public']['Tables']['businesses']['Row'];
type BusinessStaff = Database['public']['Tables']['business_staff']['Row'];

interface NewUserData {
  email: string;
  password: string;
  name: string;
  businessId: string;
}

export default function Admin() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [staffByBusiness, setStaffByBusiness] = useState<Record<string, BusinessStaff[]>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<NewUserData>({
    email: '',
    password: '',
    name: '',
    businessId: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === 'rotemziv7766@gmail.com') {
        setIsAdmin(true);
        fetchBusinesses();
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    const { data: businessesData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .order('name');

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      return;
    }

    setBusinesses(businessesData || []);

    // Fetch staff for each business
    for (const business of businessesData || []) {
      const { data: staffData } = await supabase
        .from('business_staff_with_users')
        .select('*')
        .eq('business_id', business.id);

      setStaffByBusiness(prev => ({
        ...prev,
        [business.id]: staffData || []
      }));
    }
  };

  const handleAddUser = async () => {
    try {
      // 1. Create new user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (authError) throw authError;

      // 2. Add user to business_staff
      if (authData.user) {
        const { error: staffError } = await supabase
          .from('business_staff')
          .insert({
            user_id: authData.user.id,
            business_id: selectedBusiness!,
            role: 'staff',
            status: 'active',
            permissions: {}
          });

        if (staffError) throw staffError;
      }

      // 3. Refresh data
      await fetchBusinesses();
      setOpenDialog(false);
      setNewUser({ email: '', password: '', name: '', businessId: '' });

    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user. Please try again.');
    }
  };

  const handleRemoveUser = async (userId: string, businessId: string) => {
    try {
      // 1. Deactivate user in business_staff
      const { error: staffError } = await supabase
        .from('business_staff')
        .update({ status: 'inactive' })
        .eq('user_id', userId)
        .eq('business_id', businessId);

      if (staffError) throw staffError;

      // 2. Refresh data
      await fetchBusinesses();

    } catch (error) {
      console.error('Error removing user:', error);
      alert('Error removing user. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-xl mb-4">אין לך גישה לאזור זה</div>
        <a href="/" className="text-blue-500 hover:text-blue-600">חזור לדף הראשי</a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold mb-8">פאנל ניהול</h1>

      {businesses.map(business => (
        <div key={business.id} className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium">{business.name}</h2>
            <button 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => {
                setSelectedBusiness(business.id);
                setOpenDialog(true);
              }}
            >
              הוסף משתמש
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">אימייל</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תפקיד</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffByBusiness[business.id]?.map((staff) => (
                  <tr key={staff.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{staff.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{staff.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{staff.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleRemoveUser(staff.user_id, staff.business_id)}
                      >
                        הסר
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {openDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">הוסף משתמש חדש</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמא</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
                onClick={() => setOpenDialog(false)}
              >
                ביטול
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                onClick={handleAddUser}
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
