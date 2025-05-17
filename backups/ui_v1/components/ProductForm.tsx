import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '../lib/supabase';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'הוספת מוצר חדש' : 'עריכת מוצר'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              שם המוצר
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              dir="rtl"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              מק"ט
            </label>
            <input
              type="text"
              id="sku"
              {...register('sku')}
              disabled={mode === 'edit'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              dir="rtl"
            />
            {errors.sku && (
              <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              מחיר
            </label>
            <input
              type="number"
              id="price"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              dir="rtl"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
              מטבע
            </label>
            <select
              id="currency"
              {...register('currency')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              dir="rtl"
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name} ({currency.symbol})
                </option>
              ))}
            </select>
            {errors.currency && (
              <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
              מלאי
            </label>
            <input
              type="number"
              id="stock"
              {...register('stock', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              dir="rtl"
            />
            {errors.stock && (
              <p className="mt-1 text-sm text-red-600">{errors.stock.message}</p>
            )}
          </div>

          <div className="flex justify-end mt-6 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center">
                  <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  שומר...
                </span>
              ) : (
                'שמור'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}