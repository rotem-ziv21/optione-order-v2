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
      
      if (!user || business.owner_id !== user.id) {
        throw new Error('אין לך הרשאה להוסיף משתמשים לעסק זה');
      }

      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('לא ניתן ליצור משתמש');
      }

      // Add the user to business_staff
      const { error: staffError } = await supabase
        .from('business_staff')
        .insert({
          business_id: businessId,
          user_id: authData.user.id,
          role: formData.role,
          status: 'active',
          permissions: {
            can_view_inventory: true,
            can_manage_inventory: formData.role === 'admin',
            can_view_customers: true,
            can_manage_customers: formData.role === 'admin',
            can_view_quotes: true,
            can_manage_quotes: formData.role === 'admin',
            can_manage_staff: formData.role === 'admin'
          }
        });

      if (staffError) throw staffError;

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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">הוספת משתמש חדש</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              אימייל
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              סיסמא
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              תפקיד
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'staff' }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="staff">צוות</option>
              <option value="admin">מנהל</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'מוסיף...' : 'הוסף משתמש'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}