import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { addContactNote } from './crm-api';

// יצירת חיבור לסופאבייס
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface CardcomWebhookPayload {
  terminalnumber: string;
  lowprofilecode: string;
  operation: string;
  dealid: string;
  cardtype: string;
  cardissuer: string;
  cardaquirer: string;
  dealsum: string;
  paymentsnum: string;
  firstpayment: string;
  periodical_payment: string;
  validation: string;
  authnum: string;
  cardmask: string;
  order_id: string;
  ReturnValue: string;
  ResponseCode: number;
  TranZactionId: string;
  TranZactionInfo: {
    CardName: string;
    Issuer: string;
    ApprovalNumber: string;
    Last4CardDigits: string;
    NumberOfPayments: string;
    Amount: string;
    CreateDate: string;
    Token: string;
    Brand: string;
    Acquire: string;
    PaymentType: string;
    DealType: string;
  };
  TerminalNumber: string | number;
  LowProfileId: string;
  Description: string;
  DocumentInfo: {
    DocumentUrl: string;
  };
  UIValues: {
    CardOwnerName: string;
    CardOwnerPhone: string;
    CardOwnerEmail: string;
    CardOwnerIdentityNumber: string;
  };
}

export const handler: Handler = async (event) => {
  // בדיקה שזו בקשת POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  console.log('Webhook received:', event.body);

  try {
    // פענוח ה-JSON שהתקבל מ-Cardcom
    const payload = JSON.parse(event.body || '{}') as CardcomWebhookPayload;
    console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2));

    // וידוא שהתשלום הצליח
    if (payload.ResponseCode !== 0) {
      console.error('Payment failed:', payload.Description);
      throw new Error(`Payment failed: ${payload.Description}`);
    }

    // Get order ID from ReturnValue
    const orderId = payload.ReturnValue;
    if (!orderId) {
      console.error('No order ID in payload');
      throw new Error('Order ID not found in ReturnValue');
    }

    console.log('Processing payment for order:', orderId);

    // עדכון סטטוס ההזמנה ל-completed
    const { data: orderData, error: orderError } = await supabase
      .from('customer_orders')
      .update({
        status: 'completed',
        payment_method: 'credit_card',
        payment_reference: payload.TranzactionInfo?.ApprovalNumber,
        paid_at: new Date().toISOString(),
        transaction_id: payload.TranzactionId?.toString(),
        receipt_url: payload.DocumentInfo?.DocumentUrl || null
      })
      .eq('id', orderId)
      .select();

    if (orderError) {
      console.error('Error updating order:', orderError);
      console.error('Update params:', {
        orderId,
        status: 'completed',
        payment_method: 'credit_card',
        payment_reference: payload.TranzactionInfo?.ApprovalNumber,
        paid_at: new Date().toISOString(),
        transaction_id: payload.TranzactionId?.toString(),
        receipt_url: payload.DocumentInfo?.DocumentUrl || null
      });
      throw orderError;
    }

    if (!orderData || orderData.length === 0) {
      console.error('No order found with ID:', orderId);
      throw new Error(`Order not found: ${orderId}`);
    }

    console.log('Order updated successfully:', orderData);

    // Get customer details in a separate query if needed
    const { data: customerData, error: customerError } = await supabase
      .from('customer_orders')
      .select(`
        *,
        customers!inner (
          contact_id,
          name,
          email
        ),
        order_items!inner (
          quantity,
          products!inner (
            name
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (customerError) {
      console.error('Error fetching customer details:', customerError);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Payment processed successfully, but failed to send CRM note',
          orderId,
          orderData
        })
      };
    }

    // שליחת הודעה ל-CRM
    if (customerData?.customers?.contact_id) {
      try {
        console.log('Preparing CRM note for contact:', customerData.customers.contact_id);

        const itemsList = customerData.order_items
          ?.map(item => `${item.products.name} (${item.quantity})`)
          .join(', ');

        const noteBody = `✅ תשלום התקבל בכרטיס אשראי\n` +
          `סכום: ₪${customerData.total_amount}\n` +
          `פריטים: ${itemsList}\n` +
          `מספר הזמנה: ${customerData.id}\n` +
          `מספר אישור: ${payload.TranzactionInfo?.ApprovalNumber}\n` +
          `סוג כרטיס: ${payload.TranzactionInfo?.CardName}\n` +
          `4 ספרות אחרונות: ${payload.TranzactionInfo?.Last4CardDigits}\n` +
          `מספר תשלומים: ${payload.TranzactionInfo?.NumberOfPayments}\n` +
          `קישור לקבלה: ${payload.DocumentInfo?.DocumentUrl}`;

        console.log('Sending note to CRM:', noteBody);

        await addContactNote(customerData.customers.contact_id, noteBody);
        console.log('CRM note added successfully');
      } catch (crmError) {
        console.error('Error adding CRM note:', crmError);
        // לא נזרוק שגיאה כי התשלום כבר עבר בהצלחה
      }
    } else {
      console.warn('No contact_id found for order:', customerData);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Payment processed successfully',
        orderId,
        orderData
      })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error processing webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
