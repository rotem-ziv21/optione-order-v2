import React, { useState, useEffect } from 'react';
import { Search, FilePlus, Send, Download, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import PaymentButton from '../components/PaymentButton';
import { AlertCircle } from 'lucide-react';

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
  business_id: string;
}

interface QuoteItem {
  quantity: number;
  price_at_time: number;
  product_name: string;
  currency: string;
}

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchQuotes();
    }
  }, [currentBusinessId]);

  const getCurrentBusiness = async () => {
    try {
      console.log('Getting current business...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      
      if (!user) {
        setError('משתמש לא מחובר');
        return;
      }

      // אם המשתמש הוא אדמין, קח את העסק הראשון
      if (user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com') {
        console.log('User is admin, getting first business');
        const { data: businesses } = await supabase
          .from('businesses')
          .select('id')
          .limit(1)
          .single();
        
        console.log('Admin business:', businesses);
        if (businesses) {
          setCurrentBusinessId(businesses.id);
        }
      } else {
        console.log('Getting staff business');
        // אם לא, קח את העסק שהמשתמש שייך אליו
        const { data: staffBusiness } = await supabase
          .from('business_staff')
          .select('business_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        console.log('Staff business:', staffBusiness);
        if (staffBusiness) {
          setCurrentBusinessId(staffBusiness.business_id);
        }
      }
    } catch (error) {
      console.error('Error getting current business:', error);
      setError('שגיאה בטעינת העסק');
    }
  };

  const fetchQuotes = async () => {
    if (!currentBusinessId) {
      console.log('No current business ID');
      setError('לא נמצא עסק פעיל');
      return;
    }

    try {
      console.log('Fetching quotes for business:', currentBusinessId);
      // בדיקה שהמשתמש מחובר
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('משתמש לא מחובר');
        return;
      }

      // בדיקה שהטבלאות קיימות
      const { error: checkError } = await supabase
        .from('quotes')
        .select('id')
        .limit(1);

      if (checkError?.code === 'PGRST116') {
        console.log('Quotes table does not exist');
        setError('מערכת הצעות המחיר עדיין לא מוכנה');
        setLoading(false);
        return;
      }

      // טעינת הצעות מחיר לפי מזהה העסק
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          *,
          customers (
            name,
            email
          )
        `)
        .eq('business_id', currentBusinessId)
        .order('created_at', { ascending: false });

      console.log('Quotes data:', quotesData);
      console.log('Quotes error:', quotesError);

      if (quotesError) {
        if (quotesError.code === 'PGRST116') {
          console.log('Quotes table does not exist');
          setError('מערכת הצעות המחיר עדיין לא מוכנה');
          return;
        }
        throw quotesError;
      }
      
      if (!quotesData || quotesData.length === 0) {
        console.log('No quotes found');
        setQuotes([]);
        setQuoteItems({});
        setError('אין הצעות מחיר');
        return;
      }

      setQuotes(quotesData);

      // טעינת פריטים לכל הצעת מחיר
      const items: Record<string, QuoteItem[]> = {};
      for (const quote of quotesData) {
        console.log('Fetching items for quote:', quote.id);
        const { data: quoteItems, error: itemsError } = await supabase
          .from('quote_items')
          .select(`
            quantity,
            price_at_time,
            product_name,
            currency
          `)
          .eq('quote_id', quote.id);

        console.log('Quote items:', quoteItems);
        console.log('Items error:', itemsError);

        if (itemsError) {
          if (itemsError.code === 'PGRST116') {
            console.log('Quote items table does not exist');
            continue;
          }
          console.error(`Error fetching items for quote ${quote.id}:`, itemsError);
          continue;
        }

        if (quoteItems) {
          items[quote.id] = quoteItems;
        }
      }
      setQuoteItems(items);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      setError('שגיאה בטעינת הצעות המחיר');
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!quotes.length) {
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
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <FilePlus className="w-5 h-5" />
            <span>צור הצעת מחיר</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <div className="text-gray-500">אין הצעות מחיר</div>
          <button 
            className="mt-4 text-blue-600 hover:text-blue-700 flex items-center space-x-2 mx-auto"
          >
            <FilePlus className="w-5 h-5" />
            <span>צור הצעת מחיר חדשה</span>
          </button>
        </div>
      </div>
    );
  }

  const filteredQuotes = quotes.filter(quote => 
    quote.customers.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customers.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            {filteredQuotes.map((quote) => (
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