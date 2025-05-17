import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchContacts, CRMContact } from '../lib/crm-api';
import { supabase } from '../lib/supabase';

interface CustomerSearchProps {
  onClose: () => void;
  onCustomerSelect: (contact: CRMContact) => void;
  businessId: string;
}

export default function CustomerSearch({ onClose, onCustomerSelect, businessId }: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const handleSearch = async () => {
    if (!searchTerm) return;
    if (!businessId) {
      setError('לא נמצא עסק פעיל');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const results = await searchContacts(searchTerm, businessId);
      setContacts(results || []);
      if (results?.length === 0) {
        setError('לא נמצאו לקוחות');
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בחיפוש. אנא נסה שוב.');
    } finally {
      setSearching(false);
    }
  };

  const handleCustomerSelect = async (contact: CRMContact) => {
    try {
      if (!businessId) {
        throw new Error('לא נמצא עסק פעיל');
      }

      // Get current user info for debugging
      const { data: userData } = await supabase.auth.getUser();
      console.log('Current user:', userData?.user);
      console.log('Business ID:', businessId);
      
      // Check if user has admin role for this business
      const { data: staffData, error: staffError } = await supabase
        .from('business_staff')
        .select('*')
        .eq('user_id', userData?.user?.id)
        .eq('business_id', businessId)
        .eq('status', 'active');
      
      console.log('Staff data:', staffData);
      if (staffError) console.error('Staff query error:', staffError);
      
      // Check if user is business owner
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .eq('owner_id', userData?.user?.id);
      
      console.log('Business owner data:', businessData);
      if (businessError) console.error('Business query error:', businessError);
      
      // Store debug info for display
      setDebugInfo({
        user: userData?.user,
        businessId,
        isStaff: staffData && staffData.length > 0,
        staffRole: staffData && staffData.length > 0 ? staffData[0].role : null,
        isOwner: businessData && businessData.length > 0
      });

      // First check if the customer already exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('business_id', businessId);
      
      if (existingCustomer && existingCustomer.length > 0) {
        console.log('Customer already exists:', existingCustomer[0]);
        // Even if customer exists, we should still notify the parent component
        onCustomerSelect(contact);
        return;
      }

      // Try using RPC function instead of direct insert to bypass RLS
      try {
        const { error: rpcError } = await supabase.rpc('add_customer', {
          p_contact_id: contact.id,
          p_name: `${contact.firstNameLowerCase} ${contact.lastNameLowerCase}`.trim(),
          p_email: contact.email,
          p_business_id: businessId
        });

        if (rpcError) {
          console.error('RPC error:', rpcError);
          throw rpcError;
        }
      } catch (rpcError) {
        console.log('RPC method failed, falling back to direct insert');
        
        // Fall back to direct insert if RPC fails
        const { error } = await supabase
          .from('customers')
          .insert([{
            contact_id: contact.id,
            name: `${contact.firstNameLowerCase} ${contact.lastNameLowerCase}`.trim(),
            email: contact.email,
            business_id: businessId
          }]);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      // Add a small delay to ensure the database has time to process the insert
      // before we fetch the customers again
      setTimeout(() => {
        onCustomerSelect(contact);
      }, 500);
    } catch (error) {
      console.error('Error adding customer:', error);
      setError('שגיאה בהוספת הלקוח. אנא נסה שוב.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">חיפוש לקוח ב-CRM</h2>
        </div>

        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="הקלד שם, אימייל או טלפון..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchTerm}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'חיפוש'
              )}
            </button>
          </div>

          {error && (
            <div className="text-red-600 mb-4">{error}</div>
          )}

          {debugInfo && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">תוצאות חיפוש</h3>
              <div className="divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="py-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleCustomerSelect(contact)}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {contact.firstNameLowerCase} {contact.lastNameLowerCase}
                      </div>
                      {contact.email && (
                        <div className="text-sm text-gray-500">{contact.email}</div>
                      )}
                      {contact.phone && (
                        <div className="text-sm text-gray-500">{contact.phone}</div>
                      )}
                    </div>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      בחר
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contacts.length === 0 && searchTerm && !searching && (
            <div className="text-center text-gray-500 py-8">
              לא נמצאו תוצאות
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}