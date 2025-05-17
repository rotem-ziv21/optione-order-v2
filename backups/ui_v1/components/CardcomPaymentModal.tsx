import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CardcomPaymentModalProps {
  url: string;
  onClose: () => void;
  onSuccess?: () => void;
  orderId: string;
  staffId?: string;
}

export default function CardcomPaymentModal({ url, onClose, onSuccess, orderId, staffId }: CardcomPaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Reset states when URL changes
    setError(null);
    setLoading(true);
  }, [url]);

  const handleSuccess = async () => {
    try {
      setIsLoading(true);
      
      // אם יש מזהה של איש צוות, נסה לעדכן את ההזמנה
      if (staffId) {
        try {
          // בדוק אם העמודה staff_id קיימת
          const { error: testError } = await supabase
            .from('customer_orders')
            .select('staff_id')
            .limit(1);
            
          if (!testError) {
            // העמודה קיימת, עדכן אותה
            const { error: updateError } = await supabase
              .from('customer_orders')
              .update({ staff_id: staffId })
              .eq('id', orderId);
              
            if (updateError) {
              console.error('Error updating order with staff ID:', updateError);
            }
          }
        } catch (error) {
          console.error('Error checking staff_id column:', error);
          // המשך גם אם זה נכשל
        }
      }
      
      const { data: updatedOrder, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (updatedOrder.receipt_url) {
        window.open(updatedOrder.receipt_url, '_blank');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error fetching updated order:', error);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl min-h-[1000px] flex flex-col relative">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">דף תשלום</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        <div className="flex-1 relative" style={{ minHeight: '1000px' }}>
          <iframe
            src={url}
            className="absolute inset-0 w-full h-full border-0"
            style={{ minHeight: '1000px', width: '100%' }}
            title="Cardcom Payment Page"
            onLoad={(e) => {
              setLoading(false);
              // בדיקה אם הדף שנטען הוא דף ההצלחה של Cardcom
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentWindow?.location.href.includes('Success')) {
                handleSuccess();
              }
            }}
            onError={() => setError('שגיאה בטעינת דף התשלום')}
            allow="payment *; fullscreen *"
            referrerPolicy="origin"
            sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups allow-popups-to-escape-sandbox"
          />
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                סגור
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}