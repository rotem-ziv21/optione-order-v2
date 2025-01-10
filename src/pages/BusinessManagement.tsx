import React, { useState, useEffect } from 'react';
import { Building2, Plus, Users, Settings as SettingsIcon, Edit2, Trash2, UserPlus, X } from 'lucide-react';
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

  useEffect(() => {
    checkAdminAccess();
    if (isAdmin) {
      fetchBusinesses();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(user?.email === 'rotem@optionecrm.com');
    } catch (error) {
      console.error('Error checking admin access:', error);
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
      throw error;
    }
  };

  const handleAddBusiness = async () => {
    if (!newBusinessName.trim()) {
      setError('נא להזין שם עסק');
      return;
    }

    try {
      const { error } = await supabase
        .from('businesses')
        .insert([{
          name: newBusinessName.trim(),
          status: 'active'
        }]);

      if (error) throw error;

      setShowAddBusiness(false);
      setNewBusinessName('');
      fetchBusinesses();
    } catch (error) {
      console.error('Error adding business:', error);
      setError('שגיאה בהוספת העסק');
    }
  };

  const handleSelectBusiness = async (business: Business) => {
    try {
      const staff = await fetchBusinessStaff(business.id);
      setSelectedBusiness(business);
      setBusinessStaff(staff);
    } catch (error) {
      setError('שגיאה בטעינת פרטי העסק');
    }
  };

  const handleUpdateBusinessStatus = async (businessId: string, newStatus: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ status: newStatus })
        .eq('id', businessId);

      if (error) throw error;

      fetchBusinesses();
    } catch (error) {
      console.error('Error updating business status:', error);
      setError('שגיאה בעדכון סטטוס העסק');
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('business_staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      if (selectedBusiness) {
        handleSelectBusiness(selectedBusiness);
      }
    } catch (error) {
      console.error('Error removing staff:', error);
      setError('שגיאה בהסרת איש צוות');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">אין לך גישה לאזור זה</div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול עסקים</h1>
        <button
          onClick={() => setShowAddBusiness(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>הוסף עסק</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Business Form */}
      {showAddBusiness && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="שם העסק"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <button
              onClick={handleAddBusiness}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              <span>הוסף</span>
            </button>
            <button
              onClick={() => {
                setShowAddBusiness(false);
                setNewBusinessName('');
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Businesses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => (
          <div
            key={business.id}
            className={`bg-white rounded-lg shadow-sm p-6 border ${
              selectedBusiness?.id === business.id ? 'border-blue-500' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  business.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    business.status === 'active' ? 'text-green-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{business.name}</h3>
                  <p className="text-sm text-gray-500">
                    נוצר ב-{new Date(business.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUpdateBusinessStatus(
                  business.id,
                  business.status === 'active' ? 'inactive' : 'active'
                )}
                className={`text-sm px-2 py-1 rounded-full ${
                  business.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {business.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </button>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => handleSelectBusiness(business)}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <Users className="w-4 h-4" />
                <span>ניהול צוות</span>
              </button>
              <div className="flex space-x-2">
                <button className="text-gray-600 hover:text-gray-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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