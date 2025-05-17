import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { createPaymentPage } from '../lib/cardcom';
import { supabase } from '../lib/supabase';
import CardcomPaymentModal from './CardcomPaymentModal';
import { getTeamByBusinessId } from '../api/teamApi';

interface StaffMember {
  id: string;
  name: string;
  business_id: string;
}

interface PaymentButtonProps {
  quote: {
    id: string;
    total_amount: number;
    currency: string;
    business_id: string;
    customers: {
      name: string;
      email: string;
    };
  };
  items: Array<{
    description: string;
    price: number;
    quantity: number;
  }>;
}

export default function PaymentButton({ quote, items }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [showStaffSelection, setShowStaffSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quote.business_id) {
      loadStaffMembers();
    }
  }, [quote.business_id]);

  const loadStaffMembers = async () => {
    try {
      const data = await getTeamByBusinessId(quote.business_id);
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error loading staff members:', error);
    }
  };

  const handlePayment = async () => {
    if (staffMembers.length > 0 && !selectedStaffId) {
      setShowStaffSelection(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Get Cardcom settings
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('cardcom_terminal, cardcom_api_name')
        .single();

      if (settingsError) throw new Error('שגיאה בטעינת הגדרות קארדקום');
      
      if (!settings?.cardcom_terminal || !settings?.cardcom_api_name) {
        throw new Error('חסרים פרטי התחברות לקארדקום. אנא הגדר אותם בהגדרות המערכת.');
      }

      // Validate customer email
      if (!quote.customers.email) {
        throw new Error('חסרה כתובת אימייל של הלקוח');
      }

      // Create payment request with quote data
      const paymentData = {
        terminalNumber: parseInt(settings.cardcom_terminal, 10),
        apiName: settings.cardcom_api_name,
        amount: quote.total_amount,
        successUrl: `${window.location.origin}/quotes?payment=success&quote=${quote.id}`,
        failureUrl: `${window.location.origin}/quotes?payment=failure&quote=${quote.id}`,
        customer: {
          name: quote.customers.name,
          email: quote.customers.email
        },
        items: items.map(item => ({
          description: item.description,
          price: item.price,
          quantity: item.quantity
        }))
      };

      const { url, lowProfileId } = await createPaymentPage(paymentData);
      
      // Store the lowProfileId in the database for later reference
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ 
          payment_id: lowProfileId,
          payment_status: 'pending',
          staff_id: selectedStaffId || null
        })
        .eq('id', quote.id);

      if (updateError) {
        console.error('Error updating quote with payment ID:', updateError);
      }

      // Open payment modal instead of new window
      setPaymentUrl(url);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error initiating payment:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בפתיחת דף התשלום. אנא נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Reload the page to show updated status
    window.location.reload();
  };

  const handleStaffSelection = () => {
    if (!selectedStaffId && staffMembers.length > 0) {
      setError('נא לבחור איש צוות לשיוך המכירה');
      return;
    }
    
    setShowStaffSelection(false);
    handlePayment();
  };

  return (
    <>
      <button
        onClick={handlePayment}
        disabled={loading}
        className="text-green-600 hover:text-green-700 ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
        title="תשלום"
      >
        <CreditCard className={`w-5 h-5 ${loading ? 'animate-pulse' : ''}`} />
      </button>

      {/* Staff selection modal */}
      {showStaffSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">שיוך מכירה לאיש צוות</h2>
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                בחר איש צוות
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">בחר איש צוות</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowStaffSelection(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ביטול
              </button>
              <button
                onClick={handleStaffSelection}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                המשך לתשלום
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && (
        <CardcomPaymentModal
          url={paymentUrl}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
          orderId={quote.id}
          staffId={selectedStaffId}
        />
      )}
    </>
  );
}