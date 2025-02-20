import { supabase } from './supabase';

interface WebhookPayload {
  event: 'order_created' | 'order_paid';
  business_id: string;
  data: any;
}

async function getCustomerDetails(customerId: string) {
  if (!customerId) {
    console.log('No customer ID provided');
    return null;
  }

  console.log('Fetching customer details for ID:', customerId);
  try {
    // נסה קודם לפי contact_id
    const { data: customerByContact, error: contactError } = await supabase
      .from('customers')
      .select('*')
      .eq('contact_id', customerId)
      .single();

    if (!contactError && customerByContact) {
      console.log('Found customer by contact_id:', customerByContact);
      return customerByContact;
    }

    // אם לא נמצא, נסה לפי id
    if (customerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      const { data: customerById, error: idError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (!idError && customerById) {
        console.log('Found customer by id:', customerById);
        return customerById;
      }
    }

    console.log('Customer not found by any method');
    return null;
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}

async function getOrderItems(orderId: string) {
  if (!orderId) {
    console.log('No order ID provided');
    return [];
  }

  console.log('Getting items for order:', orderId);
  const { data: items, error } = await supabase
    .from('customer_order_items')
    .select(`
      quantity,
      unit_price,
      order_id,
      products (
        id,
        name,
        description,
        price
      )
    `)
    .eq('order_id', orderId);

  if (error) {
    console.error('Error fetching order items:', error);
    return [];
  }

  console.log('Found items:', items);
  
  if (!items || items.length === 0) {
    // אם אין פריטים, ננסה לקבל אותם מטבלת ההזמנות
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select(`
        products
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return [];
    }

    if (order?.products) {
      console.log('Found products in order:', order.products);
      return order.products.map((item: any) => ({
        product_name: item.name || 'Unknown Product',
        product_description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.price || 0,
        total: (item.quantity || 1) * (item.price || 0)
      }));
    }
  }
  
  return items?.map(item => ({
    product_name: item.products?.name || 'Unknown Product',
    product_description: item.products?.description || '',
    quantity: item.quantity,
    unit_price: item.unit_price || item.products?.price || 0,
    total: item.quantity * (item.unit_price || item.products?.price || 0)
  })) || [];
}

async function formatWebhookPayload(order: any) {
  console.log('Formatting payload for order:', order);
  
  // נסה להשיג את פרטי הלקוח
  let customer = order.customer;
  if (!customer?.name) {
    customer = await getCustomerDetails(order.customer_id || order.customer?.id || order.customer?.contact_id);
  }
  
  // שימוש בפריטים שנשלחו או קבלתם מהדאטהבייס
  const items = order.products || order.items || await getOrderItems(order.id || order.order_id);
  console.log('Items for webhook:', items);
  
  const formattedPayload = {
    event_type: order.event,
    order_id: order.id || order.order_id,
    order_status: order.status,
    created_at: new Date(order.created_at).toLocaleString('he-IL'),
    
    customer: {
      id: customer?.id || customer?.contact_id || order.customer_id,
      name: customer?.name || '',
      email: customer?.email || '',
      phone: customer?.phone || ''
    },
    
    items: items.map((item: any) => ({
      product_id: item.id || item.product_id,
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      price: item.price || item.price_at_time,
      currency: item.currency || 'ILS',
      total: item.quantity * (item.price || item.price_at_time)
    })),
    
    totals: {
      amount: order.total_amount,
      currency: order.currency || 'ILS'
    },
    
    payment: {
      status: order.paid_at ? 'paid' : 'pending',
      paid_at: order.paid_at ? new Date(order.paid_at).toLocaleString('he-IL') : null,
      method: order.payment_method,
      reference: order.payment_reference
    }
  };

  console.log('Formatted payload:', formattedPayload);
  return formattedPayload;
}

export async function processWebhook(webhook: any) {
  try {
    // קודם נקבל את ה-URL מטבלת business_webhooks
    const { data: businessWebhook, error: webhookError } = await supabase
      .from('business_webhooks')
      .select('url')
      .eq('business_id', webhook.business_id)
      .eq('on_order_paid', true)
      .single();

    if (webhookError || !businessWebhook) {
      throw new Error(`No webhook URL found for business ${webhook.business_id}`);
    }

    console.log(`Processing webhook to ${businessWebhook.url}`, webhook);
    
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

    await supabase
      .from('webhook_queue')
      .update({
        status: 'completed',
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', webhook.id);

    console.log(`Successfully processed webhook ${webhook.id}`);
  } catch (error) {
    console.error(`Failed to process webhook ${webhook.id}:`, error);

    const attempts = (webhook.attempts || 0) + 1;
    const maxAttempts = 3;

    await supabase
      .from('webhook_queue')
      .update({
        status: attempts >= maxAttempts ? 'failed' : 'pending',
        attempts: attempts,
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', webhook.id);
  }
}

export async function triggerWebhooks(payload: WebhookPayload) {
  try {
    const { data: webhooks, error } = await supabase
      .from('business_webhooks')
      .select('*')
      .eq('business_id', payload.business_id)
      .eq(payload.event === 'order_created' ? 'on_order_created' : 'on_order_paid', true);

    if (error) throw error;

    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks found for this event');
      return;
    }

    console.log(`Found ${webhooks.length} webhooks to process`);
    console.log('Payload data:', payload.data);

    const enrichedPayload = {
      ...payload.data,
      event: payload.event,
      business_id: payload.business_id,
      customer: await getCustomerDetails(payload.data.customer_id),
      items: await getOrderItems(payload.data.id || payload.data.order_id)
    };

    console.log('Enriched payload:', enrichedPayload);

    const insertPromises = webhooks.map(webhook => 
      supabase.from('webhook_queue').insert({
        webhook_url: webhook.url,
        event_type: payload.event,
        payload: enrichedPayload,
        business_id: payload.business_id,
        status: 'pending'
      }).select()
    );

    const results = await Promise.all(insertPromises);
    console.log('Webhooks added to queue:', results);

    const webhooksToProcess = results
      .filter(result => !result.error && result.data)
      .map(result => result.data[0]);

    await Promise.all(webhooksToProcess.map(processWebhook));
  } catch (error) {
    console.error('Error handling webhooks:', error);
  }
}

supabase
  .channel('webhooks')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'webhook_queue' }, async (payload) => {
    if (payload.new && payload.new.status === 'pending') {
      console.log('Got new webhook to process:', payload.new);
      await processWebhook(payload.new);
    }
  })
  .subscribe((status) => {
    console.log('Webhook channel status:', status);
  });
