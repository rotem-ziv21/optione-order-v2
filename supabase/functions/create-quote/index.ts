import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface QuoteItem {
  product_name: string
  quantity: number
  price_at_time: number
  currency: string
}

interface CreateQuoteRequest {
  customer_id: string
  total_amount: number
  currency: string
  valid_until: string
  business_id: string
  items: QuoteItem[]
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { customer_id, total_amount, currency, valid_until, business_id, items } = await req.json() as CreateQuoteRequest

    // יצירת הצעת המחיר
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .insert([{
        customer_id,
        total_amount,
        currency,
        valid_until,
        status: 'draft',
        business_id
      }])
      .select()
      .single()

    if (quoteError) {
      throw quoteError
    }

    if (!quote) {
      throw new Error('לא התקבל מזהה להצעת המחיר')
    }

    // יצירת פריטי הצעת המחיר
    const quoteItems = items.map(item => ({
      quote_id: quote.id,
      ...item
    }))

    const { error: itemsError } = await supabaseClient
      .from('quote_items')
      .insert(quoteItems)

    if (itemsError) {
      throw itemsError
    }

    return new Response(
      JSON.stringify({ quote_id: quote.id }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
