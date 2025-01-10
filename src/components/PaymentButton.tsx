import React, { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { createPaymentPage } from '../lib/cardcom';
import { supabase } from '../lib/supabase';

interface PaymentButtonProps {
  quote: {
    id: string;
    total_amount: number;
    currency: string;
    customers: {
      name: string;
      email: string;
    };
  };
  items: Array<{
    description: string;
    price: number;
    quantity: number;
  }>;
}

export default function PaymentButton({ quote, items }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Get Cardcom settings
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('cardcom_terminal, cardcom_api_name')
        .single();

      if (settingsError) throw new Error('שגיאה בטעינת הגדרות קארדקום');
      
      if (!settings?.cardcom_terminal || !settings?.cardcom_api_name) {
        throw new Error('חסרים פרטי התחברות לקארדקום. אנא הגדר אותם בהגדרות המערכת.');
      }

      // Validate customer email
      if (!quote.customers.email) {
        throw new Error('חסרה כתובת אימייל של הלקוח');
      }

      // Create payment request with quote data
      const paymentData = {
        terminalNumber: parseInt(settings.cardcom_terminal, 10),
        apiName: settings.cardcom_api_name,
        amount: quote.total_amount,
        successUrl: `${window.location.origin}/quotes?payment=success&quote=${quote.id}`,
        failureUrl: `${window.location.origin}/quotes?payment=failure&quote=${quote.id}`,
        customer: {
          name: quote.customers.name,
          email: quote.customers.email
        },
        items: items.map(item => ({
          description: item.description,
          price: item.price,
          quantity: item.quantity
        }))
      };

      const { url, lowProfileId } = await createPaymentPage(paymentData);
      
      // Store the lowProfileId in the database for later reference
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ 
          payment_id: lowProfileId,
          payment_status: 'pending'
        })
        .eq('id', quote.id);

      if (updateError) {
        console.error('Error updating quote with payment ID:', updateError);
      }

      // Open payment URL in a new window
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error initiating payment:', error);
      alert(error instanceof Error ? error.message : 'שגיאה בפתיחת דף התשלום. אנא נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="text-green-600 hover:text-green-700 ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
      title="תשלום"
    >
      <CreditCard className={`w-5 h-5 ${loading ? 'animate-pulse' : ''}`} />
    </button>
  );
}