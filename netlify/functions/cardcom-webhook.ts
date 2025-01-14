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
      console.error('Payment failed:', payload)
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: false, 
          message: 'Payment operation was not successful' 
        })
      }
    }

    // עדכון ההזמנה בסופאבייס
    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        transaction_id: payload.TranZactionId?.toString(),
        payment_method: 'credit_card',
        payment_reference: payload.TranZactionInfo?.ApprovalNumber,
        payment_details: {
          card_type: payload.TranZactionInfo?.CardName,
          card_issuer: payload.TranZactionInfo?.Issuer,
          auth_number: payload.TranZactionInfo?.ApprovalNumber,
          card_mask: payload.TranZactionInfo?.Last4CardDigits,
          payments: payload.TranZactionInfo?.NumberOfPayments,
          terminal_number: payload.TerminalNumber,
          amount: payload.TranZactionInfo?.Amount,
          document_url: payload.DocumentInfo?.DocumentUrl,
          card_owner: payload.UIValues?.CardOwnerName,
          card_owner_phone: payload.UIValues?.CardOwnerPhone,
          card_owner_email: payload.UIValues?.CardOwnerEmail,
          card_owner_id: payload.UIValues?.CardOwnerIdentityNumber,
          transaction_date: payload.TranZactionInfo?.CreateDate,
          token: payload.TranZactionInfo?.Token,
          brand: payload.TranZactionInfo?.Brand,
          acquire: payload.TranZactionInfo?.Acquire,
          payment_type: payload.TranZactionInfo?.PaymentType,
          deal_type: payload.TranZactionInfo?.DealType
        }
      })
      .eq('id', payload.ReturnValue)
      .select()

    if (error) {
      console.error('Error updating order:', error)
      throw error
    }

    console.log('Order updated successfully:', data)

    // שליחת תשובה חיובית ל-Cardcom
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Payment processed successfully',
        order: data?.[0]
      })
    }

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
