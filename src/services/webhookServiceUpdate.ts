import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * Validates that the webhooks table exists and has the required columns
 */
export const validateWebhooksTable = async (): Promise<boolean> => {
  try {
    // Check if the table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'business_webhooks')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('Error checking webhooks table:', tablesError);
      return false;
    }

    if (!tables || tables.length === 0) {
      console.error('Webhooks table does not exist. Please run the following SQL:');
      console.error(`
        CREATE TABLE public.business_webhooks (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          on_order_created BOOLEAN DEFAULT FALSE,
          on_order_paid BOOLEAN DEFAULT FALSE,
          on_product_purchased BOOLEAN DEFAULT FALSE,
          product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      return false;
    }

    // Check if the webhook_logs table exists
    const { data: logTables, error: logTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'webhook_logs')
      .eq('table_schema', 'public');

    if (logTablesError) {
      console.error('Error checking webhook_logs table:', logTablesError);
      return false;
    }

    if (!logTables || logTables.length === 0) {
      console.error('Webhook logs table does not exist. Please run the following SQL:');
      console.error(`
        CREATE TABLE public.webhook_logs (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          webhook_id UUID REFERENCES public.business_webhooks(id) ON DELETE CASCADE,
          order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
          product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
          request_payload JSONB,
          response_status INTEGER,
          response_body TEXT,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating webhooks table:', error);
    return false;
  }
};

/**
 * Triggers webhooks when an order is created
 */
export const triggerOrderCreatedWebhooks = async (orderId: string, businessId: string) => {
  try {
    // Get webhooks for this business that should be triggered on order creation
    const { data: webhooks, error: webhooksError } = await supabase
      .from('business_webhooks')
      .select('*')
      .eq('business_id', businessId)
      .eq('on_order_created', true);

    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks configured for order creation for this business');
      return;
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return;
    }

    // Get customer details if available
    let customer = null;
    if (order.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();

      if (!customerError) {
        customer = customerData;
      } else {
        console.error('Error fetching customer:', customerError);
      }
    }

    // Get order items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', orderId);

    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return;
    }

    // Send webhook for each configured webhook
    for (const webhook of webhooks) {
      try {
        // Prepare payload
        const payload = {
          event: 'order_created',
          order_id: orderId,
          business_id: businessId,
          timestamp: new Date().toISOString(),
          order: order,
          customer: customer,
          order_items: orderItems
        };

        // Send webhook
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const responseStatus = response.status;
        const responseBody = await response.text();

        // Log webhook
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            request_payload: payload,
            response_status: responseStatus,
            response_body: responseBody
          });

        console.log(`Webhook sent to ${webhook.url}, status: ${responseStatus}`);
      } catch (error) {
        console.error(`Error sending webhook to ${webhook.url}:`, error);
        
        // Log failed webhook
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            request_payload: {
              event: 'order_created',
              order_id: orderId,
              business_id: businessId,
              timestamp: new Date().toISOString(),
              error: 'Failed to send webhook'
            },
            response_status: 0,
            response_body: error instanceof Error ? error.message : String(error)
          });
      }
    }
  } catch (error) {
    console.error('Error triggering order created webhooks:', error);
  }
};

/**
 * Triggers webhooks when a product is purchased
 */
export const triggerProductPurchasedWebhooks = async (orderId: string, productId: string, businessId: string) => {
  try {
    // Get webhooks for this business that should be triggered on product purchase
    const { data: webhooks, error: webhooksError } = await supabase
      .from('business_webhooks')
      .select('*')
      .eq('business_id', businessId)
      .eq('on_product_purchased', true)
      .or(`product_id.is.null,product_id.eq.${productId}`);

    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks configured for product purchase for this business');
      return;
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      // Use default values if order not found
      const defaultOrder = {
        id: orderId,
        business_id: businessId,
        status: 'unknown',
        total_amount: 0,
        created_at: new Date().toISOString()
      };
      console.log('Using default order data:', defaultOrder);
      order = defaultOrder;
    }

    // Get customer details if available
    let customer = null;
    if (order.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();

      if (!customerError) {
        customer = customerData;
      } else {
        console.error('Error fetching customer:', customerError);
      }
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) {
      console.error('Error fetching product:', productError);
      return;
    }

    // Get order item
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .single();

    if (orderItemError) {
      console.error('Error fetching order item:', orderItemError);
    }

    // Send webhook for each configured webhook
    for (const webhook of webhooks) {
      try {
        // Prepare payload
        const payload = {
          event: 'product_purchased',
          order_id: orderId,
          product_id: productId,
          business_id: businessId,
          timestamp: new Date().toISOString(),
          order: order,
          customer: customer,
          product: product,
          order_item: orderItem
        };

        // Send webhook
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const responseStatus = response.status;
        const responseBody = await response.text();

        // Log webhook
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            product_id: productId,
            request_payload: payload,
            response_status: responseStatus,
            response_body: responseBody
          });

        console.log(`Webhook sent to ${webhook.url}, status: ${responseStatus}`);
      } catch (error) {
        console.error(`Error sending webhook to ${webhook.url}:`, error);
        
        // Log failed webhook
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            product_id: productId,
            request_payload: {
              event: 'product_purchased',
              order_id: orderId,
              product_id: productId,
              business_id: businessId,
              timestamp: new Date().toISOString(),
              error: 'Failed to send webhook'
            },
            response_status: 0,
            response_body: error instanceof Error ? error.message : String(error)
          });
      }
    }
  } catch (error) {
    console.error('Error triggering product purchased webhooks:', error);
  }
};

/**
 * Manually send webhooks for a completed order
 * This can be called from the application when an order is marked as completed
 */
export const sendOrderCompletedWebhooks = async (orderId: string) => {
  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return;
    }

    // Call the database function to send webhooks
    const { data, error } = await supabase.rpc('send_order_webhooks', { order_id: orderId });
    
    if (error) {
      console.error('Error calling send_order_webhooks function:', error);
      
      // Fallback: Try to call the function directly from JavaScript
      await triggerProductPurchasedWebhooks(orderId, '', order.business_id);
      
      return;
    }
    
    console.log('Webhooks sent successfully via database function:', data);
    return data;
  } catch (error) {
    console.error('Error sending order completed webhooks:', error);
  }
};

/**
 * Get webhook logs for debugging
 */
export const getWebhookLogs = async (businessId: string, limit = 50) => {
  try {
    // Get webhook IDs for this business
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

    // Get logs for these webhooks
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

export default {
  validateWebhooksTable,
  triggerOrderCreatedWebhooks,
  triggerProductPurchasedWebhooks,
  sendOrderCompletedWebhooks,
  getWebhookLogs
};
