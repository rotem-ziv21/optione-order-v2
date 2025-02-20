import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookQueueItem {
  id: string;
  event_type: string;
  business_id: string;
  order_id: string;
  payload: any;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending webhooks
    const { data: pendingWebhooks, error: fetchError } = await supabaseClient
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending webhooks:', fetchError);
      throw fetchError;
    }

    if (!pendingWebhooks || pendingWebhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending webhooks' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Process each webhook
    const results = await Promise.all(
      pendingWebhooks.map(async (webhook: WebhookQueueItem) => {
        try {
          // Get webhook URL from business_webhooks
          const { data: businessWebhook, error: webhookError } = await supabaseClient
            .from('business_webhooks')
            .select('url')
            .eq('business_id', webhook.business_id)
            .eq('on_order_paid', true)
            .single();

          if (webhookError) {
            throw webhookError;
          }

          if (!businessWebhook) {
            throw new Error(`No webhook URL found for business ${webhook.business_id}`);
          }

          // Send webhook
          const response = await fetch(businessWebhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-ID': webhook.id,
              'X-Event-Type': webhook.event_type,
            },
            body: JSON.stringify(webhook.payload),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Update webhook status to completed
          const { error: updateError } = await supabaseClient
            .from('webhook_queue')
            .update({
              status: 'completed',
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', webhook.id);

          if (updateError) {
            throw updateError;
          }

          return {
            id: webhook.id,
            status: 'success',
          };
        } catch (error) {
          console.error(`Error processing webhook ${webhook.id}:`, error);

          const attempts = (webhook.attempts || 0) + 1;
          const maxAttempts = 3;

          // Update attempts count and status
          await supabaseClient
            .from('webhook_queue')
            .update({
              status: attempts >= maxAttempts ? 'failed' : 'pending',
              attempts: attempts,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', webhook.id);

          return {
            id: webhook.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return new Response(
      JSON.stringify({ results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-webhooks function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
