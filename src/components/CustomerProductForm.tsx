import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import QuoteGenerator from './QuoteGenerator';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PriceQuotePDF from './PriceQuotePDF';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);

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

  const { register, control, handleSubmit, watch } = useForm<CustomerProductFormData>({
    defaultValues: {
      products: [{ productId: products[0]?.id || '', quantity: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products"
  });

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
    await handleSubmit((data) => handleFormSubmit(data, 'quote'))();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
      >
        {loading ? (
          <div className="p-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"
              ></motion.div>
              <p className="text-gray-600 font-medium">טוען מוצרים...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full">
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <h2 className="text-xl font-bold">הוספת מוצרים ללקוח</h2>
                <div className="flex gap-3">
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
                      {({ loading }) => (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-white text-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-50 disabled:bg-gray-200 disabled:text-gray-400 font-medium transition-colors shadow-sm"
                          disabled={loading}
                        >
                          <Icons.Download className="w-5 h-5" />
                          {loading ? 'מכין PDF...' : 'הורד הצעת מחיר'}
                        </motion.button>
                      )}
                    </PDFDownloadLink>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
                    disabled={submitting}
                  >
                    <Icons.X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              <form className="p-6 space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-red-50 border-r-4 border-red-500 text-red-600 px-4 py-3 rounded-lg flex items-center shadow-sm"
                    >
                      <Icons.AlertCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <Icons.ShoppingBag className="w-5 h-5 ml-2 text-purple-500" />
                      מוצרים נבחרים
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => append({ productId: products[0]?.id || '', quantity: 1 })}
                      className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg flex items-center space-x-1 rtl:space-x-reverse transition-colors shadow-sm"
                      disabled={submitting}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      <span className="font-medium">הוסף מוצר</span>
                    </motion.button>
                  </div>

                  {fields.map((field, index) => (
                    <motion.div 
                      key={field.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center space-x-4 rtl:space-x-reverse bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
                    >
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <Icons.Package className="w-4 h-4 ml-1.5 text-purple-500" />
                          מוצר
                        </label>
                        <select
                          {...register(`products.${index}.productId` as const)}
                          className="block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <Icons.Hash className="w-4 h-4 ml-1.5 text-purple-500" />
                          כמות
                        </label>
                        <input
                          type="number"
                          {...register(`products.${index}.quantity` as const, { 
                            valueAsNumber: true,
                            min: 1
                          })}
                          className="block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                          placeholder="1"
                          disabled={submitting}
                        />
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors mt-6"
                        disabled={submitting}
                      >
                        <Icons.Trash2 className="w-5 h-5" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>

                <div className="pt-5 border-t border-gray-200">
                  <div className="flex justify-between items-center text-xl font-bold bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl shadow-sm">
                    <span className="flex items-center">
                      <Icons.Receipt className="w-5 h-5 ml-2 text-purple-600" />
                      סה"כ:
                    </span>
                    <span className="text-indigo-700">{products[0]?.currency} {total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    disabled={submitting}
                  >
                    ביטול
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleQuoteClick}
                    disabled={submitting}
                    className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    <Icons.FileText className="w-4 h-4 ml-2" />
                    צור הצעת מחיר
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={submitting}
                    className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 border border-transparent rounded-lg shadow-sm hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                    onClick={() => handleSubmit((data) => handleFormSubmit(data, 'order'))()}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center">
                        <Icons.Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        מעבד...
                      </span>
                    ) : (
                      <span className="inline-flex items-center">
                        <Icons.ShoppingCart className="w-4 h-4 ml-2" />
                        צור הזמנה
                      </span>
                    )}
                  </motion.button>
                </div>
              </form>
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
      </motion.div>
    </div>
  );
};

export default CustomerProductForm;
