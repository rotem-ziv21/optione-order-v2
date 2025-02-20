import React, { useState } from 'react';
import { X, CreditCard, Building2, Banknote, Receipt, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPaymentPage } from '../lib/cardcom';
import { addContactNote } from '../lib/crm-api';

interface PaymentOptionsModalProps {
  customer: {
    id: string;
    contact_id: string;
    name: string;
    email: string;
  };
  orders: Array<{
    id: string;
    total_amount: number;
    currency: string;
    items: Array<{
      product_name: string;
      quantity: number;
      price: number;
    }>;
  }>;
  onClose: () => void;
  onSuccess: () => void;
  onPaymentComplete?: () => void;
}

export default function PaymentOptionsModal({ customer, orders, onClose, onSuccess, onPaymentComplete }: PaymentOptionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payments, setPayments] = useState<number>(1);

  // Calculate total amount from all orders with proper decimal handling
  const totalAmount = orders.reduce((sum, order) => 
    sum + Number(order.total_amount), 0);
  const currency = orders[0]?.currency || 'ILS';

  const handleCardcomPayment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('cardcom_terminal, cardcom_api_name')
        .single();

      if (settingsError) throw new Error('שגיאה בטעינת הגדרות קארדקום');
      
      if (!settings?.cardcom_terminal || !settings?.cardcom_api_name) {
        throw new Error('חסרים פרטי התחברות לקארדקום. אנא הגדר אותם בהגדרות המערכת.');
      }

      // Combine all items from all orders
      const items = orders.flatMap(order => 
        order.items.map(item => ({
          description: item.product_name,
          price: item.price,
          quantity: item.quantity
        }))
      );

      const paymentData = {
        terminalNumber: parseInt(settings.cardcom_terminal, 10),
        apiName: settings.cardcom_api_name,
        amount: totalAmount,
        payments,
        orderId: orders[0].id, // שימוש במזהה ההזמנה הראשונה
        successUrl: `${window.location.origin}/customers?payment=success&orders=${orders.map(o => o.id).join(',')}`,
        failureUrl: `${window.location.origin}/customers?payment=failure`,
        customer: {
          name: customer.name,
          email: customer.email
        },
        items
      };

      const { url } = await createPaymentPage(paymentData);
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (error) {
      console.error('Error initiating Cardcom payment:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בפתיחת דף התשלום');
    } finally {
      setLoading(false);
    }
  };

  const handleManualPayment = async () => {
    if (!paymentMethod || !paymentReference) {
      setError('נא למלא את כל השדות');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // עדכון כל ההזמנות
      for (const order of orders) {
        // עדכון סטטוס ההזמנה
        const { data: updatedOrder, error: updateError } = await supabase
          .from('customer_orders')
          .update({
            status: 'completed',
            payment_method: paymentMethod,
            payment_reference: paymentReference,
            paid_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating order:', updateError);
          throw updateError;
        }

        // שליחת הערה ל-CRM
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            quantity,
            products (name)
          `)
          .eq('order_id', order.id);

        const itemsList = orderItems?.map(item => 
          `${item.products.name} (${item.quantity})`
        ).join(', ');

        const noteBody = `הזמנה ${order.id} שולמה\n` +
                        `פריטים: ${itemsList}\n` +
                        `סכום: ${order.total_amount} ${order.currency}\n` +
                        `אמצעי תשלום: ${paymentMethod}\n` +
                        `אסמכתא: ${paymentReference}`;

        await addContactNote({
          contactId: customer.contact_id,
          body: noteBody,
          type: 'payment'
        });

        // עדכון מלאי
        const { error: stockError } = await supabase
          .rpc('update_product_stock', {
            p_order_id: order.id
          });

        if (stockError) {
          console.error('Error updating stock:', stockError);
          throw stockError;
        }

        // שליחת webhook
        await triggerWebhooks({
          event: 'order_paid',
          business_id: order.business_id,
          data: {
            ...updatedOrder,
            status: 'completed',
            payment_method: paymentMethod,
            payment_reference: paymentReference,
            paid_at: new Date().toISOString(),
            is_paid: true
          }
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating payment status:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס התשלום');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">אפשרויות תשלום</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">סיכום הזמנות</h3>
            <div className="mt-2 space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">הזמנה #{order.id.slice(0, 8)}</span>
                  <span className="font-medium">{currency} {order.total_amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-medium">
                <span>סה"כ לתשלום:</span>
                <span>{currency} {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {!showManualPayment ? (
            <div className="space-y-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מספר תשלומים
                </label>
                <select
                  value={payments}
                  onChange={(e) => setPayments(parseInt(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                    <option key={num} value={num}>{num} תשלומים</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCardcomPayment}
                disabled={loading}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">כרטיס אשראי</span>
                </div>
                <span className="text-sm text-gray-500">Cardcom</span>
              </button>

              <button
                onClick={() => setShowManualPayment(true)}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium">תשלום ידני</span>
                </div>
                <span className="text-sm text-gray-500">העברה / מזומן / צ'ק</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  אמצעי תשלום
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">בחר אמצעי תשלום</option>
                  <option value="bank_transfer">העברה בנקאית</option>
                  <option value="cash">מזומן</option>
                  <option value="check">צ'ק</option>
                  <option value="invoice">כנגד חשבונית</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  אסמכתא
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="מספר העברה / צ'ק / חשבונית"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowManualPayment(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  חזור
                </button>
                <button
                  onClick={handleManualPayment}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'מעדכן...' : 'עדכן תשלום'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}