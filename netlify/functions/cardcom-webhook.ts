import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// יצירת חיבור לסופאבייס
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

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
    // פענוח הפרמטרים שנשלחו מ-Cardcom
    const params = new URLSearchParams(event.body)
    const payload: Partial<CardcomWebhookPayload> = {}
    params.forEach((value, key) => {
      payload[key.toLowerCase()] = value
    })
    
    console.log('Parsed Cardcom payload:', payload);

    // וידוא שהתשלום הצליח
    if (payload.operation !== 'Success') {
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
        status: 'paid',
        transaction_id: payload.dealid,
        paid_at: new Date().toISOString(),
        payment_details: {
          card_type: payload.cardtype,
          card_issuer: payload.cardissuer,
          auth_number: payload.authnum,
          card_mask: payload.cardmask,
          payments: payload.paymentsnum,
          terminal_number: payload.terminalnumber
        }
      })
      .eq('id', payload.order_id)
      .select()

    if (error) {
      console.error('Error updating order:', error)
      throw error
    }

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
