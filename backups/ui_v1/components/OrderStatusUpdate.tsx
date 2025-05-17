import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { addContactNote } from '../lib/crm-api';
import { useOrderSubscription } from '../hooks/useOrderSubscription';
import toast from 'react-hot-toast';

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: string;
  businessId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const OrderStatusUpdate: React.FC<OrderStatusUpdateProps> = ({ orderId, currentStatus, onClose, onUpdate, businessId }) => {
  console.log('OrderStatusUpdate props:', { orderId, businessId });

  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    // טעינת פרטי ההזמנה כולל קישור לחשבונית
    const fetchOrderDetails = async () => {
      const { data: order, error } = await supabase
        .from('customer_orders')
        .select('receipt_url')
        .eq('id', orderId)
        .single();

      if (!error && order?.receipt_url) {
        setReceiptUrl(order.receipt_url);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  // האזנה לשינויים בהזמנה
  useOrderSubscription(orderId, (updatedOrder) => {
    if (updatedOrder.payment_status === 'paid' && status !== 'paid') {
      setStatus('paid');
      if (updatedOrder.receipt_url) {
        setReceiptUrl(updatedOrder.receipt_url);
      }
      toast.success('התשלום התקבל בהצלחה!');
      onUpdate();
    }
  });

  const statusOptions = [
    { value: 'pending', label: 'ממתין' },
    { value: 'completed', label: 'הושלם' },
    { value: 'cancelled', label: 'בוטל' },
    { value: 'paid', label: 'שולם' }
  ];

  const handleUpdateStatus = async () => {
    if (!orderId || !status) {
      console.error('Missing orderId or status');
      return;
    }
    if (!businessId) {
      console.error('Missing businessId');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting order status update:', {
        orderId,
        status,
        businessId
      });

      // עדכון סטטוס ההזמנה
      const { error } = await supabase
        .from('customer_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
      console.log('Order status updated successfully');

      // אם העדכון הוא למצב 'paid', שלח הערה ל-CRM
      if (status === 'paid') {
        console.log('Status is paid, fetching order details...');
        
        const { data: order, error: orderError } = await supabase
          .from('customer_orders')
          .select(`
            id,
            customer_id,
            total_amount,
            items (
              name,
              quantity
            )
          `)
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('Error fetching order details:', orderError);
          throw orderError;
        }
        console.log('Order details:', order);

        if (order.customer_id) {
          console.log('Found customer_id:', order.customer_id);
          const itemsList = order.items.map((item: any) => `${item.name} (${item.quantity})`).join(', ');
          
          const noteBody = `✅ תשלום התקבל\n` +
                          `סכום: ₪${order.total_amount}\n` +
                          `פריטים: ${itemsList}\n` +
                          `מספר הזמנה: ${orderId}`;

          console.log('Sending note to CRM:', {
            contactId: order.customer_id,
            body: noteBody,
            businessId: businessId
          });

          await addContactNote({
            contactId: order.customer_id,
            body: noteBody,
            businessId: businessId
          });
          
          console.log('Note sent to CRM successfully');
        } else {
          console.log('No customer_id found for order');
        }
      }

      onUpdate();
      setMessage({ type: 'success', text: 'סטטוס ההזמנה עודכן בהצלחה' });
    } catch (error) {
      console.error('Error in handleUpdateStatus:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס ההזמנה'
      });
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">עדכון סטטוס הזמנה</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateStatus(); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              סטטוס
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {receiptUrl && (
            <div className="mt-4">
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                צפה בחשבונית
              </a>
            </div>
          )}

          {message && (
            <div className={`text-${message.type === 'success' ? 'green' : 'red'}-600 text-sm`}>{message.text}</div>
          )}

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
              <Check className="w-5 h-5" />
              <span>{loading ? 'מעדכן...' : 'עדכן סטטוס'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OrderStatusUpdate;