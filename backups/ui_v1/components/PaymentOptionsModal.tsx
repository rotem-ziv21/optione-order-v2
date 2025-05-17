import React, { useState, useEffect } from 'react';
import { X, CreditCard, Building2, Banknote, Receipt, Check, UserCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPaymentPage } from '../lib/cardcom';
import { addContactNote } from '../lib/crm-api';
import { getTeamByBusinessId } from '../api/teamApi';

interface StaffMember {
  id: string;
  name: string;
  business_id: string;
}

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
}

export default function PaymentOptionsModal({ customer, orders, onClose, onSuccess }: PaymentOptionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payments, setPayments] = useState<number>(1);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  // Calculate total amount from all orders with proper decimal handling
  const totalAmount = orders.reduce((sum, order) => 
    sum + Number(order.total_amount), 0);
  const currency = orders[0]?.currency || 'ILS';

  useEffect(() => {
    // Get business ID from the first order
    if (orders.length > 0) {
      getOrderBusinessId(orders[0].id);
    }
  }, [orders]);

  useEffect(() => {
    // Load staff members when business ID is available
    if (currentBusinessId) {
      loadStaffMembers();
    }
  }, [currentBusinessId]);

  const getOrderBusinessId = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('business_id')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      if (data?.business_id) {
        setCurrentBusinessId(data.business_id);
      }
    } catch (error) {
      console.error('Error fetching business ID:', error);
    }
  };

  const loadStaffMembers = async () => {
    try {
      if (!currentBusinessId) return;
      
      const data = await getTeamByBusinessId(currentBusinessId);
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error loading staff members:', error);
    }
  };

  const updateStock = async (orderId: string) => {
    try {
      // Get order items with their quantities
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity
        `)
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Update stock for each product
      for (const item of orderItems || []) {
        const { error: stockError } = await supabase
          .rpc('update_product_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity
          });

        if (stockError) {
          console.error('Error updating stock for product:', item.product_id, stockError);
          throw new Error('שגיאה בעדכון המלאי');
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleCardcomPayment = async () => {
    if (!validateStaffSelection()) return;
    
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

      // Try to update staff_id if selected, but don't fail if column doesn't exist
      if (selectedStaffId) {
        try {
          for (const order of orders) {
            await supabase
              .from('customer_orders')
              .update({ status: 'pending' }) // Update only status first to verify it works
              .eq('id', order.id);
          }
        } catch (error) {
          console.error('Error updating order status:', error);
          // Continue even if this fails
        }
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

    if (!validateStaffSelection()) return;

    setLoading(true);
    setError(null);

    try {
      // Update all orders status and update stock
      for (const order of orders) {
        // Get order details with business info
        const { data: orderDetails, error: orderError } = await supabase
          .from('customer_orders')
          .select(`
            id,
            total_amount,
            business_id
          `)
          .eq('id', order.id)
          .single();

        if (orderError) throw orderError;

        // Update order status without staff_id first
        const updateData: any = {
          status: 'completed',
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          paid_at: new Date().toISOString()
        };
        
        // Try to add staff_id if selected
        if (selectedStaffId) {
          try {
            // Test if staff_id column exists
            const { error: testError } = await supabase
              .from('customer_orders')
              .select('staff_id')
              .limit(1);
              
            if (!testError) {
              // Column exists, add it to update data
              updateData.staff_id = selectedStaffId;
            }
          } catch (error) {
            console.error('Error checking staff_id column:', error);
            // Continue without staff_id
          }
        }
        
        // Update the order
        const { error: updateError } = await supabase
          .from('customer_orders')
          .update(updateData)
          .eq('id', order.id);

        if (updateError) throw updateError;

        // Get order items
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            quantity,
            products (
              name
            )
          `)
          .eq('order_id', order.id);

        // Get staff name
        let staffName = 'לא צוין';
        if (selectedStaffId) {
          const selectedStaff = staffMembers.find(staff => staff.id === selectedStaffId);
          if (selectedStaff) {
            staffName = selectedStaff.name;
          }
        }

        // Create note for CRM
        const itemsList = orderItems?.map(item => 
          `${item.products.name} (${item.quantity})`
        ).join(', ');

        const noteBody = `✅ תשלום התקבל\n` +
                        `סכום: ₪${orderDetails.total_amount}\n` +
                        `פריטים: ${itemsList}\n` +
                        `מספר הזמנה: ${order.id}\n` +
                        `אמצעי תשלום: ${paymentMethod}\n` +
                        `אסמכתא: ${paymentReference}\n` +
                        `איש צוות: ${staffName}`;

        // Send note to CRM
        await addContactNote({
          contactId: customer.contact_id,
          body: noteBody,
          businessId: orderDetails.business_id
        });

        // Update stock for this order
        await updateStock(order.id);
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

  const validateStaffSelection = () => {
    // Don't require staff selection if we don't have any staff members
    if (!selectedStaffId && staffMembers.length > 0) {
      setError('נא לבחור איש צוות לשיוך המכירה');
      return false;
    }
    return true;
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

          {/* Staff selection */}
          {staffMembers.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שייך מכירה לאיש צוות
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <UserCircle className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">בחר איש צוות</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

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