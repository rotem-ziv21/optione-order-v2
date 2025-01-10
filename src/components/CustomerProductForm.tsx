import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import QuoteGenerator from './QuoteGenerator';

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
}

export default function CustomerProductForm({ onClose, onSubmit, products, customerId }: CustomerProductFormProps) {
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CustomerProductFormData>({
    defaultValues: {
      products: [{ productId: products[0]?.id || '', quantity: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products"
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [customerDetails, setCustomerDetails] = useState<any>(null);

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
    if (!customerId) {
      setError('מזהה לקוח חסר');
      return;
    }

    const formattedProducts = data.products.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      
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
    }

    setSubmitting(true);
    setError(null);

    try {
      // Calculate total with proper decimal handling
      const totalAmount = Number(data.products.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0).toFixed(2));

      const { data: order, error: orderError } = await supabase
        .from('customer_orders')
        .insert({
          customer_id: customerId,
          total_amount: totalAmount,
          currency: products[0]?.currency || 'ILS',
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = data.products.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        
        return {
          order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          price_at_time: Number(product.price.toFixed(2)),
          currency: product.currency
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      onSubmit(data);
    } catch (error) {
      console.error('Error adding order:', error);
      setError(error instanceof Error ? error.message : 'שגיאה בהוספת ההזמנה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">הוספת מוצרים ללקוח</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => handleFormSubmit(data, 'order'))} className="p-6 space-y-6">
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
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-600 hover:text-red-700"
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
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => handleSubmit((data) => handleFormSubmit(data, 'quote'))()}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
              >
                צור הצעת מחיר
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
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
  );
}