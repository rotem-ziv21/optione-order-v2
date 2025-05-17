import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const currencies = [
  { code: 'USD', symbol: '$', name: 'דולר אמריקאי' },
  { code: 'EUR', symbol: '€', name: 'אירו' },
  { code: 'ILS', symbol: '₪', name: 'שקל' },
  { code: 'GBP', symbol: '£', name: 'לירה שטרלינג' }
] as const;

const productSchema = z.object({
  name: z.string().min(1, 'שם המוצר הוא שדה חובה'),
  sku: z.string().min(1, 'מק"ט הוא שדה חובה'),
  price: z.number().min(0, 'המחיר חייב להיות חיובי'),
  currency: z.enum(['USD', 'EUR', 'ILS', 'GBP'], {
    required_error: 'נא לבחור מטבע',
  }),
  stock: z.number().min(0, 'המלאי חייב להיות חיובי'),
  business_id: z.string().uuid().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  initialData?: ProductFormData;
  mode?: 'create' | 'edit';
  businessId?: string;
}

export default function ProductForm({ onClose, onSubmit, initialData, mode = 'create', businessId }: ProductFormProps) {
  const { register, handleSubmit, formState: { errors }, setError } = useForm<ProductFormData>({
    defaultValues: initialData || {
      currency: 'ILS',
      business_id: businessId
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFormSubmit = async (data: ProductFormData) => {
    setSubmitting(true);
    setServerError(null);

    try {
      // Check if SKU already exists only in create mode
      if (mode === 'create') {
        try {
          // First try to use the RPC function if available
          const { data: skuExists, error: rpcError } = await supabase.rpc('check_sku_exists', {
            p_sku: data.sku,
            p_business_id: initialData?.business_id
          });
          
          if (!rpcError && skuExists) {
            setError('sku', {
              type: 'manual',
              message: 'מק"ט זה כבר בשימוש. נא לבחור מק"ט אחר.'
            });
            setSubmitting(false);
            return;
          }
        } catch (rpcError) {
          console.log('RPC method not available, falling back to direct query');
          
          // Fall back to direct query
          try {
            const { data: existingProducts, error: checkError } = await supabase
              .from('products')
              .select('id')
              .eq('sku', data.sku);

            if (checkError) {
              console.error('Error checking SKU:', checkError);
              // Continue with submission even if check fails
            } else if (existingProducts && existingProducts.length > 0) {
              setError('sku', {
                type: 'manual',
                message: 'מק"ט זה כבר בשימוש. נא לבחור מק"ט אחר.'
              });
              setSubmitting(false);
              return;
            }
          } catch (queryError) {
            console.error('Error in SKU query:', queryError);
            // Continue with submission even if check fails
          }
        }
      }

      // Generate a random SKU suffix if needed to avoid duplicates
      if (mode === 'create') {
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const originalSku = data.sku;
        
        // Try with the original SKU first, but be ready to modify it if needed
        try {
          await onSubmit(data);
          onClose();
          return;
        } catch (submitError: any) {
          // Check if the error is a duplicate key error
          if (submitError?.code === '23505' && submitError?.message?.includes('products_sku_key')) {
            // Try again with a modified SKU
            data.sku = `${originalSku}-${randomSuffix}`;
            console.log('Retrying with modified SKU:', data.sku);
            await onSubmit(data);
            onClose();
            return;
          } else {
            // Re-throw other errors
            throw submitError;
          }
        }
      } else {
        // For edit mode, just submit normally
        await onSubmit(data);
        onClose();
      }
    } catch (error) {
      console.error('Error handling product:', error);
      setServerError('אירעה שגיאה. נא לנסות שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <h2 className="text-xl font-bold">
            {mode === 'create' ? 'הוספת מוצר חדש' : 'עריכת מוצר'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
          <AnimatePresence>
            {serverError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border-r-4 border-red-500 rounded-lg p-4 flex items-start space-x-3 rtl:space-x-reverse shadow-sm"
              >
                <Icons.AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 ml-2 rtl:ml-0 rtl:mr-2" />
                <p className="text-sm text-red-600">{serverError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Icons.Package className="w-4 h-4 ml-1.5 text-purple-500" />
              שם המוצר
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className="block w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm"
              dir="rtl"
              placeholder="הזן שם מוצר"
            />
            <AnimatePresence>
              {errors.name && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm text-red-500 flex items-center"
                >
                  <Icons.AlertCircle className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
                  {errors.name.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Icons.Tag className="w-4 h-4 ml-1.5 text-purple-500" />
              מק"ט
            </label>
            <input
              type="text"
              id="sku"
              {...register('sku')}
              disabled={mode === 'edit'}
              className="block w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm disabled:bg-gray-100/80 disabled:border-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              dir="rtl"
              placeholder="הזן מקט"
            />
            <AnimatePresence>
              {errors.sku && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm text-red-500 flex items-center"
                >
                  <Icons.AlertCircle className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
                  {errors.sku.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Icons.DollarSign className="w-4 h-4 ml-1.5 text-purple-500" />
              מחיר
            </label>
            <div className="relative">
              <input
                type="number"
                id="price"
                step="0.01"
                {...register('price', { valueAsNumber: true })}
                className="block w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm"
                dir="rtl"
                placeholder="0.00"
              />
            </div>
            <AnimatePresence>
              {errors.price && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm text-red-500 flex items-center"
                >
                  <Icons.AlertCircle className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
                  {errors.price.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Icons.DollarSign className="w-4 h-4 ml-1.5 text-purple-500" />
              מטבע
            </label>
            <div className="relative">
              <select
                id="currency"
                {...register('currency')}
                className="block w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm appearance-none"
                dir="rtl"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.name} ({currency.symbol})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-gray-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <AnimatePresence>
              {errors.currency && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm text-red-500 flex items-center"
                >
                  <Icons.AlertCircle className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
                  {errors.currency.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Icons.BarChart3 className="w-4 h-4 ml-1.5 text-purple-500" />
              מלאי
            </label>
            <input
              type="number"
              id="stock"
              {...register('stock', { valueAsNumber: true })}
              className="block w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white/50 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 text-sm"
              dir="rtl"
              placeholder="0"
            />
            <AnimatePresence>
              {errors.stock && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm text-red-500 flex items-center"
                >
                  <Icons.AlertCircle className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
                  {errors.stock.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end mt-8 space-x-3 rtl:space-x-reverse">
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              ביטול
            </motion.button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex justify-center items-center px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 border border-transparent rounded-lg shadow-sm hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:from-purple-500 disabled:to-indigo-500 transition-all duration-200"
            >
              {submitting ? (
                <span className="inline-flex items-center">
                  <Icons.Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </span>
              ) : (
                <span className="inline-flex items-center">
                  <Icons.Save className="w-4 h-4 ml-2" />
                  שמור
                </span>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}