import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// יצירת קליינט של Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const handler: Handler = async (event) => {
  try {
    // קבלת כל ה-webhooks שבסטטוס pending
    const { data: pendingWebhooks, error: fetchError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(10); // מגביל ל-10 בכל פעם

    if (fetchError) {
      console.error('Error fetching pending webhooks:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching pending webhooks' })
      };
    }

    if (!pendingWebhooks || pendingWebhooks.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending webhooks' })
      };
    }

    // עיבוד כל ה-webhooks
    const results = await Promise.all(pendingWebhooks.map(async (webhook) => {
      try {
        // קבלת ה-URL מטבלת business_webhooks
        const { data: businessWebhook, error: webhookError } = await supabase
          .from('business_webhooks')
          .select('url')
          .eq('business_id', webhook.business_id)
          .eq('on_order_paid', true)
          .single();

        if (webhookError || !businessWebhook) {
          throw new Error(`No webhook URL found for business ${webhook.business_id}`);
        }

        // שליחת ה-webhook
        const response = await fetch(businessWebhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-ID': webhook.id,
            'X-Event-Type': webhook.event_type
          },
          body: JSON.stringify(webhook.payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // עדכון הסטטוס ל-completed
        await supabase
          .from('webhook_queue')
          .update({
            status: 'completed',
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', webhook.id);

        return {
          id: webhook.id,
          status: 'success'
        };
      } catch (error) {
        console.error(`Error processing webhook ${webhook.id}:`, error);

        const attempts = (webhook.attempts || 0) + 1;
        const maxAttempts = 3;

        // עדכון מספר הניסיונות והסטטוס
        await supabase
          .from('webhook_queue')
          .update({
            status: attempts >= maxAttempts ? 'failed' : 'pending',
            attempts: attempts,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', webhook.id);

        return {
          id: webhook.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ results })
    };
  } catch (error) {
    console.error('Error in process-webhook function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
