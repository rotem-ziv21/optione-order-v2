import React, { useState } from 'react';
import { X, Save, Send, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { addDays, format } from 'date-fns';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from '@react-pdf/renderer';

// Register Hebrew font
Font.register({
  family: 'Rubik',
  src: 'https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-B4i1UE80V4bVkA.ttf'
});

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    direction: 'rtl',
    fontFamily: 'Rubik'
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    textAlign: 'right'
  },
  customerInfo: {
    fontSize: 12,
    marginBottom: 20
  },
  table: {
    display: 'table',
    width: 'auto',
    marginBottom: 20,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee'
  },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 30,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#f9fafb'
  },
  tableCell: {
    flex: 1,
    padding: 8,
    textAlign: 'right'
  },
  total: {
    marginTop: 20,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: 'bold'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#666'
  }
});

// Create Document Component
const QuotePDF = ({ customer, products, quoteId, validUntil }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>הצעת מחיר {quoteId ? `#${quoteId}` : ''}</Text>
        <View style={styles.customerInfo}>
          <Text>לכבוד: {customer.name}</Text>
          <Text>אימייל: {customer.email}</Text>
          <Text>תאריך: {format(new Date(), 'dd/MM/yyyy')}</Text>
          <Text>תוקף עד: {format(validUntil, 'dd/MM/yyyy')}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.tableCell}>מוצר</Text>
          <Text style={styles.tableCell}>כמות</Text>
          <Text style={styles.tableCell}>מחיר ליחידה</Text>
          <Text style={styles.tableCell}>סה"כ</Text>
        </View>
        {products.map((product, index) => (
          <View key={`${product.name}-${index}`} style={styles.tableRow}>
            <Text style={styles.tableCell}>{product.name}</Text>
            <Text style={styles.tableCell}>{product.quantity}</Text>
            <Text style={styles.tableCell}>
              {product.currency} {product.price.toFixed(2)}
            </Text>
            <Text style={styles.tableCell}>
              {product.currency} {(product.price * product.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.total}>
        סה"כ לתשלום: {products[0]?.currency} {products.reduce((sum, product) => sum + (product.price * product.quantity), 0).toFixed(2)}
      </Text>

      <Text style={styles.footer}>
        * הצעת מחיר זו תקפה עד {format(validUntil, 'dd/MM/yyyy')}
      </Text>
    </Page>
  </Document>
);

interface QuoteGeneratorProps {
  customer: {
    id: string;
    contact_id: string;
    name: string;
    email: string;
  };
  products: Array<{
    name: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  onClose: () => void;
}

export default function QuoteGenerator({ customer, products, onClose }: QuoteGeneratorProps) {
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validUntil = addDays(new Date(), 30);

  const handleSaveQuote = async () => {
    if (!customer?.contact_id) {
      setError('מזהה לקוח חסר');
      return;
    }

    if (!products?.length) {
      setError('לא נבחרו מוצרים');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // קבלת המשתמש הנוכחי
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('משתמש לא מחובר');
      }

      // קבלת העסק הראשון מהדאטהבייס
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();

      if (businessError || !business) {
        throw new Error('לא נמצא עסק פעיל');
      }

      // חישוב הסכום הכולל
      const totalAmount = Number(products.reduce((sum, product) => 
        sum + (Number(product.price) * product.quantity)
      , 0).toFixed(2));

      // יצירת הצעת המחיר
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          customer_id: customer.contact_id,
          total_amount: totalAmount,
          currency: products[0].currency,
          valid_until: validUntil.toISOString(),
          status: 'draft',
          business_id: business.id,
          created_by: user.id
        }])
        .select()
        .single();

      if (quoteError) throw quoteError;

      if (!quote) {
        throw new Error('לא התקבל מזהה להצעת המחיר');
      }

      setQuoteId(quote.id);

      // יצירת פריטי הצעת המחיר
      const quoteItems = products.map(product => ({
        quote_id: quote.id,
        product_name: product.name,
        quantity: product.quantity,
        price_at_time: Number(product.price),
        currency: product.currency
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) throw itemsError;

    } catch (error) {
      console.error('Error saving quote:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בשמירת הצעת המחיר');
    } finally {
      setSaving(false);
    }
  };

  const handleSendQuote = async () => {
    if (!quoteId) return;
    
    setSending(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent' })
        .eq('id', quoteId);

      if (error) throw error;

      // סגירת החלון ורענון הרשימה
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error sending quote:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בשליחת הצעת המחיר');
    } finally {
      setSending(false);
    }
  };

  const QuoteDocument = (
    <QuotePDF 
      customer={customer} 
      products={products} 
      quoteId={quoteId} 
      validUntil={validUntil}
    />
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">הצעת מחיר</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Products List */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">מוצרים נבחרים</h3>
              <div className="space-y-4">
                {products.map((product, index) => (
                  <div key={`${product.name}-${index}`} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        {product.quantity} יחידות × {product.currency} {product.price}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.currency} {(product.quantity * product.price).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-lg font-medium">
                    <span>סה"כ:</span>
                    <span>
                      {products[0]?.currency} {products.reduce((sum, product) => sum + (product.price * product.quantity), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PDF Preview and Actions */}
            {products.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">פעולות</h3>
                <div className="flex flex-col space-y-4">
                  {!quoteId ? (
                    <button
                      onClick={handleSaveQuote}
                      disabled={saving}
                      className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-5 h-5" />
                      <span>{saving ? 'שומר...' : 'שמור הצעת מחיר'}</span>
                    </button>
                  ) : (
                    <div className="flex flex-col space-y-4">
                      <PDFDownloadLink
                        document={QuoteDocument}
                        fileName={`quote-${quoteId}.pdf`}
                        className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        {({ loading }) => (
                          <>
                            <Download className="w-5 h-5" />
                            <span>{loading ? 'טוען...' : 'הורד PDF'}</span>
                          </>
                        )}
                      </PDFDownloadLink>

                      <button
                        onClick={handleSendQuote}
                        disabled={sending}
                        className="inline-flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <Send className="w-5 h-5" />
                        <span>{sending ? 'שולח...' : 'שלח ללקוח'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}