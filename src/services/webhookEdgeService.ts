import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Initialize Supabase client
// נשתמש בערכים מהסביבה של Vite במקום process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * שולח webhooks עבור הזמנה באמצעות פונקציית Edge
 */
export const sendOrderWebhooks = async (orderId: string) => {
  try {
    console.log(`Sending webhooks for order ${orderId} via Edge Function`);
    
    // קריאה לפונקציית ה-Edge
    const { data, error } = await supabase.functions.invoke('send-webhook', {
      body: { orderId }
    });
    
    if (error) {
      console.error('Error calling send-webhook function:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Webhooks sent successfully via Edge Function:', data);
    return data;
  } catch (error) {
    console.error('Error sending order webhooks via Edge Function:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * מקבל את הלוגים של ה-webhooks לצורך דיבוג
 */
export const getWebhookLogs = async (businessId: string, limit = 50) => {
  try {
    // קבלת מזהי ה-webhooks עבור העסק
    const { data: webhooks, error: webhooksError } = await supabase
      .from('business_webhooks')
      .select('id')
      .eq('business_id', businessId);

    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      return [];
    }

    if (!webhooks || webhooks.length === 0) {
      return [];
    }

    const webhookIds = webhooks.map(webhook => webhook.id);

    // קבלת הלוגים עבור ה-webhooks
    const { data: logs, error: logsError } = await supabase
      .from('webhook_logs')
      .select('*, webhook:webhook_id(url)')
      .in('webhook_id', webhookIds)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error('Error fetching webhook logs:', logsError);
      return [];
    }

    return logs || [];
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    return [];
  }
};

/**
 * מקבל את הלוגים של הדיבוג
 */
export const getDebugLogs = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('debug_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching debug logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting debug logs:', error);
    return [];
  }
};

export default {
  sendOrderWebhooks,
  getWebhookLogs,
  getDebugLogs
};
