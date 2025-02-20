import { supabase } from './supabase';

// האזנה לשינויים בטבלת webhook_queue
export function initWebhooks() {
  console.log('Initializing webhook listener...');
  
  const channel = supabase.channel('webhooks', {
    config: {
      broadcast: { self: true },
      presence: { key: '' },
    }
  });

  channel
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'webhook_queue',
        filter: 'status=eq.pending'
      }, 
      async (payload) => {
        console.log('Got webhook queue change:', payload);
        
        if (payload.new && payload.new.status === 'pending') {
          console.log('Processing webhook:', payload.new);
          
          try {
            // קודם נקבל את ה-URL מטבלת business_webhooks
            const { data: businessWebhook, error: webhookError } = await supabase
              .from('business_webhooks')
              .select('url')
              .eq('business_id', payload.new.business_id)
              .eq('on_order_paid', true)
              .single();

            if (webhookError) {
              console.error('Error fetching webhook URL:', webhookError);
              throw webhookError;
            }

            if (!businessWebhook) {
              console.error(`No webhook URL found for business ${payload.new.business_id}`);
              throw new Error(`No webhook URL found for business ${payload.new.business_id}`);
            }

            console.log(`Found webhook URL: ${businessWebhook.url}`);
            console.log(`Sending webhook to ${businessWebhook.url}`, payload.new);
            
            const response = await fetch(businessWebhook.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-ID': payload.new.id,
                'X-Event-Type': payload.new.event_type
              },
              body: JSON.stringify(payload.new.payload)
            });

            console.log('Webhook response:', response.status);

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const { error: updateError } = await supabase
              .from('webhook_queue')
              .update({
                status: 'completed',
                last_attempt_at: new Date().toISOString()
              })
              .eq('id', payload.new.id);

            if (updateError) {
              console.error('Error updating webhook status:', updateError);
              throw updateError;
            }

            console.log(`Successfully processed webhook ${payload.new.id}`);
          } catch (error) {
            console.error(`Failed to process webhook ${payload.new.id}:`, error);

            const attempts = (payload.new.attempts || 0) + 1;
            const maxAttempts = 3;

            const { error: updateError } = await supabase
              .from('webhook_queue')
              .update({
                status: attempts >= maxAttempts ? 'failed' : 'pending',
                attempts: attempts,
                last_attempt_at: new Date().toISOString()
              })
              .eq('id', payload.new.id);

            if (updateError) {
              console.error('Error updating webhook status:', updateError);
            }
          }
        }
      }
    );

  channel.subscribe((status, err) => {
    if (err) {
      console.error('Error subscribing to webhook channel:', err);
    } else {
      console.log('Webhook channel status:', status);
    }
  });

  return channel; // מחזיר את הערוץ כדי שנוכל לסגור אותו אם צריך
}

// פונקציה לאתחול כל המערכת
export function initializeApp() {
  console.log('Starting app initialization...');
  const webhookChannel = initWebhooks();
  console.log('App initialization completed');

  // מחזיר את הערוץ כדי שנוכל לסגור אותו כשצריך
  return {
    webhookChannel
  };
}
