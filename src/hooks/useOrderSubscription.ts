import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface Order {
  id: string
  payment_status: string
  payment_details?: {
    auth_number?: string
    card_mask?: string
    transaction_id?: string
  }
}

export function useOrderSubscription(orderId: string, onUpdate: (order: Order) => void) {
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    if (orderId) {
      // הרשמה לשינויים בהזמנה ספציפית
      subscription = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`
          },
          (payload) => {
            console.log('Order updated:', payload.new)
            onUpdate(payload.new as Order)
          }
        )
        .subscribe()
    }

    // ניקוי כשהקומפוננטה מתפרקת
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [orderId, onUpdate])
}
