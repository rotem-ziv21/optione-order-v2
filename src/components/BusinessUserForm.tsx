import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BusinessUserFormProps {
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BusinessUserForm({ businessId, onClose, onSuccess }: BusinessUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First check if we have permission to add staff to this business
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const { data: { user } } = await supabase.auth.getUser();
      
      // בדיקת הרשאות לפי מייל
      const isAdmin = user?.email === 'rotemziv7766@gmail.com' || user?.email === 'rotem@optionecrm.com';
      
      if (!user || (!isAdmin && business.owner_id !== user.id)) {
        throw new Error('אין לך הרשאה להוסיף משתמשים לעסק זה');
      }

      console.log('Starting user creation process...');
      
      // בדיקה אם המשתמש כבר קיים
      const { data: existingUsers, error: existingError } = await supabase
        .from('business_staff_with_users')
        .select('*')
        .eq('email', formData.email)
        .eq('business_id', businessId);

      if (existingError) throw existingError;

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('משתמש זה כבר קיים בעסק');
      }

      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role
          }
        }
      });

      console.log('Auth signup result:', { authData, authError });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('לא ניתן ליצור משתמש');
      }

      console.log('Adding user to business_staff...');
      // Add the user to business_staff
      const { error: staffError } = await supabase
        .from('business_staff')
        .insert({
          business_id: businessId,
          user_id: authData.user.id,
          role: formData.role,
          status: 'active',
          permissions: {
            can_view_customers: true,
            can_edit_customers: formData.role === 'admin',
            can_view_products: true,
            can_edit_products: formData.role === 'admin',
            can_view_orders: true,
            can_edit_orders: formData.role === 'admin',
            can_manage_staff: formData.role === 'admin'
          }
        });

      console.log('Insert result:', { staffError });

      if (staffError) {
        console.error('Staff error details:', staffError);
        throw staffError;
      }

      console.log('Successfully added user to business_staff');

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding user:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בהוספת המשתמש');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-xl font-semibold mb-4">הוספת משתמש חדש לעסק</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              אימייל
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיסמה
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תפקיד
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'staff' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="staff">צוות</option>
              <option value="admin">מנהל</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                הוסף משתמש
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}