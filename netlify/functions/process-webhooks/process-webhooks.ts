import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // נצטרך להוסיף את זה ב-environment variables
)

const processWebhook = async (webhook: any) => {
  try {
    console.log(`Processing webhook ${webhook.id} to ${webhook.webhook_url}`)
    
    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhook.id,
        'X-Event-Type': webhook.event_type
      },
      body: JSON.stringify(webhook.payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // עדכון סטטוס ל-completed
    await supabase
      .from('webhook_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', webhook.id)

    console.log(`Successfully processed webhook ${webhook.id}`)
  } catch (error: any) {
    console.error(`Failed to process webhook ${webhook.id}:`, error)

    // עדכון מונה הניסיונות והסטטוס
    const retryCount = (webhook.retry_count || 0) + 1
    const maxRetries = 3

    await supabase
      .from('webhook_queue')
      .update({
        status: retryCount >= maxRetries ? 'failed' : 'pending',
        retry_count: retryCount,
        last_error: error.message
      })
      .eq('id', webhook.id)
  }
}

export const handler: Handler = async (event, context) => {
  // בדיקה שזו קריאה מורשית
  const authHeader = event.headers['x-webhook-secret']
  if (authHeader !== process.env.WEBHOOK_SECRET) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    }
  }

  try {
    // קבלת webhooks ממתינים מהתור
    const { data: pendingWebhooks, error } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) throw error

    // עיבוד כל ה-webhooks
    await Promise.all(pendingWebhooks.map(processWebhook))

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        processed: pendingWebhooks.length,
        message: 'Webhooks processed successfully' 
      })
    }
  } catch (error: any) {
    console.error('Error processing webhooks:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
