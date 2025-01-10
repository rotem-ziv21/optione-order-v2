import React, { useState, useEffect } from 'react';
import { Search, FilePlus, Send, Download, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import PaymentButton from '../components/PaymentButton';

interface Quote {
  id: string;
  customer_id: string;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  valid_until: string;
  created_at: string;
  customers: {
    name: string;
    email: string;
  };
}

interface QuoteItem {
  quantity: number;
  price_at_time: number;
  product_name: string;
}

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customers (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);

      // Fetch items for each quote
      const items: Record<string, QuoteItem[]> = {};
      for (const quote of data || []) {
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select(`
            quantity,
            price_at_time,
            product_name
          `)
          .eq('quote_id', quote.id);

        if (quoteItems) {
          items[quote.id] = quoteItems.map(item => ({
            quantity: item.quantity,
            price_at_time: item.price_at_time,
            product_name: item.product_name
          }));
        }
      }
      setQuoteItems(items);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש הצעות מחיר..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
          <FilePlus className="w-5 h-5" />
          <span>צור הצעת מחיר</span>
        </button>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                לקוח
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                תאריך
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                סכום
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                סטטוס
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">{quote.customers.name}</div>
                  <div className="text-sm text-gray-500">{quote.customers.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900">
                    {format(new Date(quote.created_at), 'dd/MM/yyyy')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900">
                    {quote.currency} {quote.total_amount.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${quote.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${quote.status === 'sent' ? 'bg-blue-100 text-blue-800' : ''}
                    ${quote.status === 'accepted' ? 'bg-green-100 text-green-800' : ''}
                    ${quote.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {quote.status === 'draft' ? 'טיוטה' :
                     quote.status === 'sent' ? 'נשלח' :
                     quote.status === 'accepted' ? 'אושר' :
                     'נדחה'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 ml-3">
                    <Send className="w-5 h-5" />
                  </button>
                  <button className="text-gray-600 hover:text-gray-900 ml-3">
                    <Download className="w-5 h-5" />
                  </button>
                  {quote.status === 'sent' && quoteItems[quote.id] && (
                    <PaymentButton
                      quote={quote}
                      items={quoteItems[quote.id].map(item => ({
                        description: item.product_name,
                        price: item.price_at_time,
                        quantity: item.quantity
                      }))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}