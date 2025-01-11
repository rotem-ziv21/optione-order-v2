import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { addContactNote } from '../lib/crm-api';

export function useCardcomCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handlePaymentCallback = async () => {
      const payment = searchParams.get('payment');
      const orders = searchParams.get('orders');

      if (payment === 'success' && orders) {
        const orderIds = orders.split(',');
        
        // Update all orders status to 'completed'
        for (const orderId of orderIds) {
          // Get order details
          const { data: order, error: orderError } = await supabase
            .from('customer_orders')
            .select(`
              id,
              total_amount,
              business_id,
              customer_id
            `)
            .eq('id', orderId)
            .single();

          if (orderError) {
            console.error('Error fetching order:', orderError);
            continue;
          }

          // Get customer details
          const { data: customer, error: customerError } = await supabase
            .from('business_customers')
            .select('contact_id')
            .eq('id', order.customer_id)
            .single();

          if (customerError) {
            console.error('Error fetching customer:', customerError);
            continue;
          }

          // Update order status
          const { error: updateError } = await supabase
            .from('customer_orders')
            .update({
              status: 'completed',
              payment_method: 'credit_card',
              payment_reference: 'Cardcom',
              paid_at: new Date().toISOString()
            })
            .eq('id', orderId);

          if (updateError) {
            console.error('Error updating order status:', updateError);
            continue;
          }

          // Get order items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select(`
              quantity,
              products (
                name
              )
            `)
            .eq('order_id', orderId);

          // Create note for CRM
          const itemsList = orderItems?.map(item => 
            `${item.products.name} (${item.quantity})`
          ).join(', ');

          const noteBody = `✅ תשלום התקבל\n` +
                          `סכום: ₪${order.total_amount}\n` +
                          `פריטים: ${itemsList}\n` +
                          `מספר הזמנה: ${orderId}\n` +
                          `אמצעי תשלום: כרטיס אשראי\n` +
                          `אסמכתא: Cardcom`;

          // Send note to CRM
          await addContactNote({
            contactId: customer.contact_id,
            body: noteBody,
            businessId: order.business_id
          });
        }
      }
    };

    handlePaymentCallback();
  }, [searchParams]);
}
