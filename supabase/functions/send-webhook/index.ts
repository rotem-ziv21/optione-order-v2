// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      })
    }

    // Get the request body
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Create a debug log
    await supabaseClient
      .from('debug_logs')
      .insert({ message: `Starting send-webhook function for order_id=${orderId}` })

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError) {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Error fetching order: ${orderError.message}` })
      
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    await supabaseClient
      .from('debug_logs')
      .insert({ message: `Order found: status=${order.status}, business_id=${order.business_id}` })

    // Get webhooks for this business
    const { data: webhooks, error: webhooksError } = await supabaseClient
      .from('business_webhooks')
      .select('*')
      .eq('business_id', order.business_id)
      .eq('on_order_paid', true)

    if (webhooksError) {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Error fetching webhooks: ${webhooksError.message}` })
      
      return new Response(JSON.stringify({ error: 'Error fetching webhooks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!webhooks || webhooks.length === 0) {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: 'No webhooks found for this business' })
      
      return new Response(JSON.stringify({ message: 'No webhooks found for this business' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    await supabaseClient
      .from('debug_logs')
      .insert({ message: `Found ${webhooks.length} webhooks` })

    // Get customer details
    let customer = null
    if (order.customer_id) {
      const { data: customerData, error: customerError } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single()

      if (!customerError) {
        customer = customerData
        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Customer found: ${customer.name}` })
      } else {
        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Error fetching customer: ${customerError.message}` })
      }
    }

    // Get order items
    const { data: orderItems, error: orderItemsError } = await supabaseClient
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (orderItemsError) {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Error fetching order items: ${orderItemsError.message}` })
    } else {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Found ${orderItems?.length || 0} order items` })
    }

    // Process each webhook
    const results = []
    for (const webhook of webhooks) {
      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Processing webhook: ${webhook.url}` })

      // Get product details for the first order item (if any)
      let product = null
      let orderItem = null
      if (orderItems && orderItems.length > 0) {
        orderItem = orderItems[0]
        const { data: productData, error: productError } = await supabaseClient
          .from('products')
          .select('*')
          .eq('id', orderItem.product_id)
          .single()

        if (!productError) {
          product = productData
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `Product found: ${product.name}` })
        } else {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `Error fetching product: ${productError.message}` })
        }
      }

      // Create payload
      const payload = {
        event: 'order_paid',
        order_id: orderId,
        business_id: order.business_id,
        timestamp: new Date().toISOString(),
        order: {
          id: order.id,
          total_amount: order.total_amount,
          status: order.status,
          created_at: order.created_at
        }
      }

      // Add customer if available
      if (customer) {
        payload.customer = {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          contact_id: customer.contact_id
        }
      }

      // Add product if available
      if (product) {
        payload.product = {
          id: product.id,
          name: product.name,
          price: product.price,
          sku: product.sku,
          currency: product.currency || 'ILS'
        }
      }

      // Add order item if available
      if (orderItem) {
        payload.order_item = {
          quantity: orderItem.quantity,
          price_at_time: orderItem.price_at_time
        }
      }

      await supabaseClient
        .from('debug_logs')
        .insert({ message: `Payload created: ${JSON.stringify(payload)}` })

      try {
        // Send webhook
        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Sending webhook to: ${webhook.url}` })

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const responseStatus = response.status
        const responseBody = await response.text()

        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Webhook response: status=${responseStatus}, body=${responseBody}` })

        // Log webhook
        const { error: logError } = await supabaseClient
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            product_id: product?.id,
            request_payload: payload,
            response_status: responseStatus,
            response_body: responseBody
          })

        if (logError) {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `Error saving webhook log: ${logError.message}` })
        } else {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: 'Webhook log saved' })
        }

        results.push({
          webhook_id: webhook.id,
          url: webhook.url,
          status: responseStatus,
          success: responseStatus >= 200 && responseStatus < 300
        })
      } catch (error) {
        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Error sending webhook: ${error.message}` })

        // Log failed webhook
        await supabaseClient
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            order_id: orderId,
            product_id: product?.id,
            request_payload: payload,
            response_status: 0,
            response_body: error.message
          })

        results.push({
          webhook_id: webhook.id,
          url: webhook.url,
          status: 0,
          success: false,
          error: error.message
        })
      }
    }

    // Also process product purchased webhooks
    if (orderItems && orderItems.length > 0) {
      for (const orderItem of orderItems) {
        const productId = orderItem.product_id

        // Get webhooks for this product
        const { data: productWebhooks, error: productWebhooksError } = await supabaseClient
          .from('business_webhooks')
          .select('*')
          .eq('business_id', order.business_id)
          .eq('on_product_purchased', true)
          .or(`product_id.is.null,product_id.eq.${productId}`)

        if (productWebhooksError) {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `Error fetching product webhooks: ${productWebhooksError.message}` })
          continue
        }

        if (!productWebhooks || productWebhooks.length === 0) {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `No product webhooks found for product ${productId}` })
          continue
        }

        await supabaseClient
          .from('debug_logs')
          .insert({ message: `Found ${productWebhooks.length} product webhooks for product ${productId}` })

        // Get product details
        const { data: product, error: productError } = await supabaseClient
          .from('products')
          .select('*')
          .eq('id', productId)
          .single()

        if (productError) {
          await supabaseClient
            .from('debug_logs')
            .insert({ message: `Error fetching product: ${productError.message}` })
          continue
        }

        // Process each product webhook
        for (const webhook of productWebhooks) {
          // Create payload
          const payload = {
            event: 'product_purchased',
            order_id: orderId,
            product_id: productId,
            business_id: order.business_id,
            timestamp: new Date().toISOString(),
            order: {
              id: order.id,
              total_amount: order.total_amount,
              status: order.status,
              created_at: order.created_at
            },
            product: {
              id: product.id,
              name: product.name,
              price: product.price,
              sku: product.sku,
              currency: product.currency || 'ILS'
            },
            order_item: {
              quantity: orderItem.quantity,
              price_at_time: orderItem.price_at_time
            }
          }

          // Add customer if available
          if (customer) {
            payload.customer = {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              contact_id: customer.contact_id
            }
          }

          try {
            // Send webhook
            const response = await fetch(webhook.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })

            const responseStatus = response.status
            const responseBody = await response.text()

            // Log webhook
            await supabaseClient
              .from('webhook_logs')
              .insert({
                webhook_id: webhook.id,
                order_id: orderId,
                product_id: productId,
                request_payload: payload,
                response_status: responseStatus,
                response_body: responseBody
              })

            results.push({
              webhook_id: webhook.id,
              url: webhook.url,
              product_id: productId,
              status: responseStatus,
              success: responseStatus >= 200 && responseStatus < 300
            })
          } catch (error) {
            // Log failed webhook
            await supabaseClient
              .from('webhook_logs')
              .insert({
                webhook_id: webhook.id,
                order_id: orderId,
                product_id: productId,
                request_payload: payload,
                response_status: 0,
                response_body: error.message
              })

            results.push({
              webhook_id: webhook.id,
              url: webhook.url,
              product_id: productId,
              status: 0,
              success: false,
              error: error.message
            })
          }
        }
      }
    }

    await supabaseClient
      .from('debug_logs')
      .insert({ message: 'Finished send-webhook function' })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // If an error occurs, return a 500 response
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
