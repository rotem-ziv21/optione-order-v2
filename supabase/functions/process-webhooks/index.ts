import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function processWebhook(webhook: any) {
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
  } catch (error) {
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

serve(async (req) => {
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

    return new Response(
      JSON.stringify({ 
        processed: pendingWebhooks.length,
        message: 'Webhooks processed successfully' 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhooks:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
