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

    const updateParams = {
      status: 'completed',
      payment_method: 'credit_card',
      payment_reference: payload.TranZactionInfo?.ApprovalNumber,
      paid_at: new Date().toISOString(),
      transaction_id: payload.TranZactionId?.toString(),
      receipt_url: payload.DocumentInfo?.DocumentUrl,
      payment_details: {
        cardOwnerName: payload.UIValues?.CardOwnerName,
        cardOwnerPhone: payload.UIValues?.CardOwnerPhone,
        cardOwnerEmail: payload.UIValues?.CardOwnerEmail,
        cardOwnerIdentityNumber: payload.UIValues?.CardOwnerIdentityNumber,
        cardMask: payload.TranZactionInfo?.Last4CardDigits,
        cardBrand: payload.TranZactionInfo?.Brand,
        cardIssuer: payload.TranZactionInfo?.Issuer,
        paymentType: payload.TranZactionInfo?.PaymentType,
        dealType: payload.TranZactionInfo?.DealType,
        numberOfPayments: payload.TranZactionInfo?.NumberOfPayments
      }
    };

    console.log('Update params:', updateParams);

    // עדכון סטטוס ההזמנה ל-paid
    const { error: orderError } = await supabase
      .from('customer_orders')
      .update(updateParams)
      .eq('id', orderId);

    if (orderError) {
      console.error('Error updating order:', orderError);
      throw orderError;
    }

    // הוספת הערה ב-CRM
    try {
      const { data: orderData, error: fetchError } = await supabase
        .from('customer_orders')
        .select('customer_id, total_amount')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        console.error('Error fetching order details:', fetchError);
      } else if (orderData) {
        const noteText = `תשלום בסך ${orderData.total_amount} ₪ התקבל בהצלחה.\nמספר אישור: ${payload.TranZactionInfo?.ApprovalNumber}\nקישור לחשבונית: ${payload.DocumentInfo?.DocumentUrl}`;
        
        await addContactNote(orderData.customer_id, noteText);
      }
    } catch (crmError) {
      console.error('Error adding CRM note:', crmError);
      // לא נזרוק שגיאה כאן כדי לא לפגוע בתהליך העדכון
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' })
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
