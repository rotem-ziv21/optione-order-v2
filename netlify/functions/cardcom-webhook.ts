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
    const payload = JSON.parse(event.body)
    console.log('Parsed Cardcom payload:', payload);

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

    // חילוץ מזהה ההזמנה מה-ReturnValue
    const orderId = payload.ReturnValue

    // עדכון ההזמנה בסופאבייס
    const { data, error } = await supabase
      .from('customer_orders')
      .update({ 
        status: 'paid',
        transaction_id: payload.TranzactionId?.toString(),
        paid_at: new Date().toISOString(),
        payment_details: {
          card_type: payload.TranzactionInfo?.CardName,
          card_issuer: payload.TranzactionInfo?.Issuer,
          auth_number: payload.TranzactionInfo?.ApprovalNumber,
          card_mask: payload.TranzactionInfo?.Last4CardDigits,
          payments: payload.TranzactionInfo?.NumberOfPayments,
          terminal_number: payload.TerminalNumber,
          amount: payload.TranzactionInfo?.Amount,
          document_url: payload.DocumentInfo?.DocumentUrl
        }
      })
      .eq('id', orderId)
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
