import { supabase } from '../lib/supabase';

interface WebhookPayload {
  event: string;
  order_id: string;
  product_id?: string;
  business_id: string;
  timestamp: string;
  product?: {
    id: string;
    name: string;
    price: number;
    sku?: string;
    currency?: string;
  };
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    contact_id?: string;
  };
  order?: {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
  };
  order_item?: {
    quantity: number;
    price_at_time: number;
  };
}

/**
 * שולח webhook כאשר מוצר נרכש
 * @param orderId מזהה ההזמנה
 * @param productId מזהה המוצר
 * @param businessId מזהה העסק
 */
export const triggerProductPurchasedWebhooks = async (orderId: string, productId: string, businessId: string) => {
  try {
    console.log(`Triggering product purchased webhooks for order ${orderId}, product ${productId}, business ${businessId}`);
    
    // שליפת כל ה-webhooks הרלוונטיים למוצר זה
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
      console.log('No webhooks found for this product/business');
      return;
    }
    
    console.log(`Found ${webhooks.length} webhooks for product ${productId}`);
    
    // שליפת פרטי המוצר
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    
    if (productError) {
      console.error('Error fetching product details:', productError);
      // נמשיך עם מוצר ברירת מחדל במקום לצאת מהפונקציה
      const defaultProduct = {
        id: productId,
        name: 'מוצר לא ידוע',
        price: 0,
        sku: 'UNKNOWN',
        currency: 'ILS',
        business_id: businessId
      };
      // המשך עם המוצר ברירת המחדל
      return await sendWebhooksWithDefaultData(webhooks, orderId, productId, businessId, defaultProduct);
    }
    
    // שליפת פרטי ההזמנה
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error('Error fetching order details:', orderError);
      // נמשיך עם הזמנה ברירת מחדל במקום לצאת מהפונקציה
      const defaultOrder = {
        id: orderId,
        total_amount: product.price || 0,
        status: 'unknown',
        created_at: new Date().toISOString(),
        customer_id: 'unknown'
      };
      // המשך עם ההזמנה ברירת המחדל
      return await sendWebhooksWithDefaultData(webhooks, orderId, productId, businessId, product, defaultOrder);
    }
    
    // שליפת פרטי פריט ההזמנה
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .single();
    
    if (orderItemError) {
      console.error('Error fetching order item details:', orderItemError);
      // נמשיך עם פריט הזמנה ברירת מחדל
      const defaultOrderItem = {
        quantity: 1,
        price_at_time: product.price || 0
      };
      // המשך עם פריט ההזמנה ברירת המחדל
      return await sendWebhooksWithDefaultData(webhooks, orderId, productId, businessId, product, order, defaultOrderItem);
    }
    
    // שליפת פרטי הלקוח
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', order.customer_id)
      .single();
    
    if (customerError) {
      console.error('Error fetching customer details:', customerError);
      // נמשיך עם לקוח ברירת מחדל
      const defaultCustomer = {
        id: order.customer_id || 'unknown',
        name: 'לקוח לא ידוע',
        email: 'unknown@example.com',
        phone: 'unknown',
        contact_id: 'unknown'
      };
      // המשך עם הלקוח ברירת המחדל
      return await sendWebhooksWithDefaultData(webhooks, orderId, productId, businessId, product, order, orderItem, defaultCustomer);
    }
    
        // יצירת ה-payload עם כל הנתונים האמיתיים
    return await sendWebhooksWithDefaultData(webhooks, orderId, productId, businessId, product, order, orderItem, customer);
  } catch (error) {
    console.error('Error in triggerProductPurchasedWebhooks:', error);
  }
};

/**
 * פונקציה פנימית לשליחת webhooks עם נתוני ברירת מחדל במקרה שחלק מהנתונים חסרים
 */
async function sendWebhooksWithDefaultData(
  webhooks: any[],
  orderId: string,
  productId: string,
  businessId: string,
  product: any,
  order?: any,
  orderItem?: any,
  customer?: any
) {
  try {
    // יצירת ה-payload
    const payload: WebhookPayload = {
      event: 'product_purchased',
      order_id: orderId,
      product_id: productId,
      business_id: businessId,
      timestamp: new Date().toISOString(),
      
      // פרטי מוצר
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        sku: product.sku,
        currency: product.currency || 'ILS'
      }
    };
    
    // הוספת פרטי הזמנה אם קיימים
    if (order) {
      payload.order = {
        id: order.id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at
      };
    }
    
    // הוספת פרטי לקוח אם קיימים
    if (customer) {
      payload.customer = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contact_id: customer.contact_id
      };
    }
    
    // הוספת פרטי פריט הזמנה אם קיימים
    if (orderItem) {
      payload.order_item = {
        quantity: orderItem.quantity,
        price_at_time: orderItem.price_at_time
      };
    }
    
    console.log('Webhook payload:', payload);
    
    // שליחת ה-webhooks
    for (const webhook of webhooks) {
      try {
        console.log(`Sending webhook to ${webhook.url}`);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        const responseStatus = response.status;
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (error) {
          console.error('Error reading response:', error);
        }
        
        console.log(`Webhook response from ${webhook.url}: Status ${responseStatus}, Body: ${responseText}`);
        
        // שמירת לוג של ה-webhook
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          product_id: productId,
          request_payload: payload,
          response_status: responseStatus,
          response_body: responseText,
          sent_at: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Error sending webhook to ${webhook.url}:`, error);
        
        // שמירת לוג של השגיאה
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          product_id: productId,
          request_payload: payload,
          response_status: null,
          response_body: `Error: ${error.message}`,
          sent_at: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error in sendWebhooksWithDefaultData:', error);
  }
}

/**
 * שולח webhook כאשר הזמנה נוצרת
 * @param orderId מזהה ההזמנה
 * @param businessId מזהה העסק
 */
export const triggerOrderCreatedWebhooks = async (orderId: string, businessId: string) => {
  try {
    console.log(`Triggering order created webhooks for order ${orderId}, business ${businessId}`);
    
    // שליפת כל ה-webhooks הרלוונטיים
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
      console.log('No webhooks found for order creation');
      return;
    }
    
    console.log(`Found ${webhooks.length} webhooks for order creation`);
    
    // שליפת פרטי ההזמנה
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error('Error fetching order details:', orderError);
      return;
    }
    
    // שליפת פרטי הלקוח
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', order.customer_id)
      .single();
    
    if (customerError) {
      console.error('Error fetching customer details:', customerError);
      return;
    }
    
    // שליפת פרטי פריטי ההזמנה
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*, products(*)')
      .eq('order_id', orderId);
    
    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return;
    }
    
    // יצירת ה-payload
    const payload = {
      event: 'order_created',
      order_id: orderId,
      business_id: businessId,
      timestamp: new Date().toISOString(),
      
      // פרטי הזמנה
      order: {
        id: order.id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at
      },
      
      // פרטי לקוח
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contact_id: customer.contact_id
      },
      
      // פרטי פריטי הזמנה
      order_items: orderItems.map(item => ({
        product_id: item.product_id,
        product_name: item.products?.name,
        quantity: item.quantity,
        price_at_time: item.price_at_time
      }))
    };
    
    console.log('Webhook payload:', payload);
    
    // שליחת ה-webhooks
    for (const webhook of webhooks) {
      try {
        console.log(`Sending webhook to ${webhook.url}`);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        const responseStatus = response.status;
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (error) {
          console.error('Error reading response:', error);
        }
        
        console.log(`Webhook response from ${webhook.url}: Status ${responseStatus}, Body: ${responseText}`);
        
        // שמירת לוג של ה-webhook
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          request_payload: payload,
          response_status: responseStatus,
          response_body: responseText,
          sent_at: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Error sending webhook to ${webhook.url}:`, error);
        
        // שמירת לוג של השגיאה
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          request_payload: payload,
          response_status: null,
          response_body: `Error: ${error.message}`,
          sent_at: new Date().toISOString()
        });
      }
    }
    
  } catch (error) {
    console.error('Error in triggerOrderCreatedWebhooks:', error);
  }
};

/**
 * שולח webhook כאשר הזמנה משולמת
 * @param orderId מזהה ההזמנה
 * @param businessId מזהה העסק
 */
export const triggerOrderPaidWebhooks = async (orderId: string, businessId: string) => {
  try {
    console.log(`Triggering order paid webhooks for order ${orderId}, business ${businessId}`);
    
    // שליפת כל ה-webhooks הרלוונטיים
    const { data: webhooks, error: webhooksError } = await supabase
      .from('business_webhooks')
      .select('*')
      .eq('business_id', businessId)
      .eq('on_order_paid', true);
    
    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      return;
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks found for order payment');
      return;
    }
    
    console.log(`Found ${webhooks.length} webhooks for order payment`);
    
    // שליפת פרטי ההזמנה
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error('Error fetching order details:', orderError);
      return;
    }
    
    // שליפת פרטי הלקוח
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', order.customer_id)
      .single();
    
    if (customerError) {
      console.error('Error fetching customer details:', customerError);
      return;
    }
    
    // שליפת פרטי פריטי ההזמנה
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*, products(*)')
      .eq('order_id', orderId);
    
    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return;
    }
    
    // יצירת ה-payload
    const payload = {
      event: 'order_paid',
      order_id: orderId,
      business_id: businessId,
      timestamp: new Date().toISOString(),
      
      // פרטי הזמנה
      order: {
        id: order.id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        paid_at: order.paid_at
      },
      
      // פרטי לקוח
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contact_id: customer.contact_id
      },
      
      // פרטי פריטי הזמנה
      order_items: orderItems.map(item => ({
        product_id: item.product_id,
        product_name: item.products?.name,
        quantity: item.quantity,
        price_at_time: item.price_at_time
      }))
    };
    
    console.log('Webhook payload:', payload);
    
    // שליחת ה-webhooks
    for (const webhook of webhooks) {
      try {
        console.log(`Sending webhook to ${webhook.url}`);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        const responseStatus = response.status;
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (error) {
          console.error('Error reading response:', error);
        }
        
        console.log(`Webhook response from ${webhook.url}: Status ${responseStatus}, Body: ${responseText}`);
        
        // שמירת לוג של ה-webhook
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          request_payload: payload,
          response_status: responseStatus,
          response_body: responseText,
          sent_at: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Error sending webhook to ${webhook.url}:`, error);
        
        // שמירת לוג של השגיאה
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          order_id: orderId,
          request_payload: payload,
          response_status: null,
          response_body: `Error: ${error.message}`,
          sent_at: new Date().toISOString()
        });
      }
    }
    
  } catch (error) {
    console.error('Error in triggerOrderPaidWebhooks:', error);
  }
};

/**
 * בודק אם טבלת ה-webhooks קיימת ותקינה
 */
export const validateWebhooksTable = async (): Promise<boolean> => {
  try {
    // בדיקה ישירה אם הטבלה קיימת ע"י ניסיון לשלוף שורה אחת
    const { error: tableError } = await supabase
      .from('business_webhooks')
      .select('id')
      .limit(1);
    
    if (tableError) {
      // אם יש שגיאה, ייתכן שהטבלה לא קיימת
      console.error('Error checking webhooks table:', tableError);
      return false;
    }
    
    // בדיקת העמודות הנדרשים ע"י ניסיון לבצע שאילתה עם כל העמודות
    const { error: columnsError } = await supabase
      .from('business_webhooks')
      .select('id, business_id, url, on_order_created, on_order_paid, on_product_purchased, product_id')
      .limit(1);
    
    if (columnsError) {
      // אם יש שגיאה, ייתכן שחלק מהעמודות חסרים
      console.error('Error checking webhooks table columns:', columnsError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating webhooks table:', error);
    return false;
  }
};
