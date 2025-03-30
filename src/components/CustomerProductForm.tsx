import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Download } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import QuoteGenerator from './QuoteGenerator';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PriceQuotePDF from './PriceQuotePDF';

const customerProductSchema = z.object({
  products: z.array(z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1')
  }))
});

type CustomerProductFormData = z.infer<typeof customerProductSchema>;

interface CustomerProductFormProps {
  onClose: () => void;
  onSubmit: (data: CustomerProductFormData) => void;
  products: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    stock: number;
  }>;
  customerId: string;
  businessId: string;
}

const CustomerProductForm = ({ onClose, onSubmit, products: initialProducts, customerId, businessId }: CustomerProductFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);

  // Load products directly from the server
  useEffect(() => {
    const fetchProducts = async () => {
      if (!businessId) return;
      
      setLoading(true);
      try {
        // First try to use the RPC function if available
        try {
          const { data, error } = await supabase.rpc('get_business_products', {
            p_business_id: businessId
          });
          
          if (!error && data && data.length > 0) {
            console.log('Products loaded via RPC:', data);
            setProducts(data);
            return;
          }
        } catch (rpcError) {
          console.log('RPC method not available, falling back to direct query');
        }
        
        // Fall back to direct query
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('business_id', businessId);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log('Products loaded via direct query:', data);
          setProducts(data);
        } else {
          console.warn('No products found for business:', businessId);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setError('שגיאה בטעינת המוצרים. אנא נסה שוב מאוחר יותר.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, [businessId]);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CustomerProductFormData>({
    defaultValues: {
      products: [{ productId: products[0]?.id || '', quantity: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products"
  });

  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);

  // Watch all product fields for total calculation
  const watchProducts = watch('products');
  const total = watchProducts.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product ? product.price * (item.quantity || 0) : 0);
  }, 0);

  // Fetch customer details when needed for quote generation
  const fetchCustomerDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('contact_id', customerId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching customer details:', error);
      return null;
    }
  };

  const handleFormSubmit = async (data: CustomerProductFormData, action: 'order' | 'quote') => {
    if (submitting) return;  
    if (!customerId) {
      setError('מזהה לקוח חסר');
      return;
    }
    
    try {
      const formattedProducts = data.products.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          console.error(`Product not found: ${item.productId}`, 'Available products:', products);
          throw new Error(`Product not found: ${item.productId}`);
        }
        
        return {
          id: product.id,
          name: product.name,
          quantity: item.quantity,
          price: product.price,
          currency: product.currency
        };
      });

      if (action === 'quote') {
        const customerData = await fetchCustomerDetails();
        if (!customerData) {
          setError('לא ניתן למצוא את פרטי הלקוח');
          return;
        }
        setCustomerDetails(customerData);
        setSelectedProducts(formattedProducts);
        setShowQuoteGenerator(true);
        return;
      } else {
        // Submit the order
        setSubmitting(true);
        await onSubmit(data);
        onClose();
      }
    } catch (error) {
      console.error('Error processing form:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בעיבוד הטופס');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuoteClick = async () => {
    if (submitting) return;
    const data = await handleSubmit((data) => handleFormSubmit(data, 'quote'))();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>טוען מוצרים...</p>
          </div>
        ) : (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">הוספת מוצרים ללקוח</h2>
                  <div className="flex gap-2">
                    {selectedProducts.length > 0 && (
                      <PDFDownloadLink
                        document={
                          <PriceQuotePDF
                            customerName={customerDetails?.name || ''}
                            products={selectedProducts.map(sp => {
                              const product = products.find(p => p.id === sp.id);
                              return {
                                id: product?.id || '',
                                name: product?.name || '',
                                price: product?.price || 0,
                                currency: product?.currency || 'ILS',
                                quantity: sp.quantity
                              };
                            })}
                            businessDetails={{
                              name: '',
                              address: '',
                              phone: '',
                              email: ''
                            }}
                          />
                        }
                        fileName={`הצעת_מחיר_${customerDetails?.name}_${new Date().toLocaleDateString()}.pdf`}
                      >
                        {({ blob, url, loading, error }) => (
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
                            disabled={loading}
                          >
                            <Download className="w-5 h-5" />
                            {loading ? 'מכין PDF...' : 'הורד הצעת מחיר'}
                          </button>
                        )}
                      </PDFDownloadLink>
                    )}
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-500"
                      disabled={submitting}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <form className="p-6 space-y-6">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">מוצרים נבחרים</h3>
                      <button
                        type="button"
                        onClick={() => append({ productId: products[0]?.id || '', quantity: 1 })}
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        disabled={submitting}
                      >
                        <Plus className="w-4 h-4" />
                        <span>הוסף מוצר</span>
                      </button>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center space-x-4">
                        <div className="flex-1">
                          <select
                            {...register(`products.${index}.productId` as const)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            disabled={submitting}
                          >
                            <option value="">בחר מוצר</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} - {product.currency} {product.price.toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="w-32">
                          <input
                            type="number"
                            {...register(`products.${index}.quantity` as const, { 
                              valueAsNumber: true,
                              min: 1
                            })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="כמות"
                            disabled={submitting}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-700"
                          disabled={submitting}
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-lg font-medium">
                      <span>סה"כ:</span>
                      <span>{products[0]?.currency} {total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={submitting}
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={handleQuoteClick}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
                    >
                      צור הצעת מחיר
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      onClick={() => handleSubmit((data) => handleFormSubmit(data, 'order'))()}
                    >
                      {submitting ? 'מעבד...' : 'צור הזמנה'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {showQuoteGenerator && customerDetails && (
              <QuoteGenerator
                customer={customerDetails}
                products={selectedProducts}
                onClose={() => {
                  setShowQuoteGenerator(false);
                  onClose();
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerProductForm;