import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

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
  TerminalNumber: string;
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
  console.log('Received webhook from Cardcom:', {
    method: event.httpMethod,
    body: event.body,
    headers: event.headers
  });

  // וודא שזו קריאת POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    // פענוח ה-JSON שהתקבל מ-Cardcom
    const payload = JSON.parse(event.body || '{}') as CardcomWebhookPayload;
    console.log('Received webhook payload:', payload);

    // Get order ID from ReturnValue
    const orderId = payload.ReturnValue;
    if (!orderId) {
      throw new Error('Order ID not found in ReturnValue');
    }

    // וידוא שהתשלום הצליח
    if (payload.ResponseCode !== 0) {
      throw new Error(`Payment failed: ${payload.Description}`);
    }

    // עדכון סטטוס ההזמנה ל-completed
    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        status: 'completed',
        payment_method: 'credit_card',
        payment_reference: payload.TranzactionInfo?.ApprovalNumber,
        paid_at: new Date().toISOString(),
        transaction_id: payload.TranzactionId?.toString()
      })
      .eq('id', payload.ReturnValue)
      .select();

    if (error) {
      console.error('Error updating order:', error);
      throw error;
    }

    console.log('Order updated successfully:', data);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment processed successfully' })
    };

  } catch (error) {
    console.error('Error processing Cardcom webhook:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'Internal server error processing payment' 
      })
    }
  }
}
