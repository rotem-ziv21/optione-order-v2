import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Webhook {
  id: string;
  url: string;
  on_order_created: boolean;
  on_order_paid: boolean;
  on_product_purchased: boolean;
  product_id: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  business_id: string;
}

export default function Automations() {
  const { user, businessId } = useAuth();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [onOrderCreated, setOnOrderCreated] = useState(false);
  const [onOrderPaid, setOnOrderPaid] = useState(false);
  const [onProductPurchased, setOnProductPurchased] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !businessId) {
      navigate('/login');
      return;
    }

    fetchWebhooks();
    fetchProducts();
  }, [user, businessId]);
  
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, business_id')
        .eq('business_id', businessId);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('שגיאה בטעינת המוצרים');
    }
  };

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('business_webhooks')
        .select('*')
        .eq('business_id', businessId);

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast.error('שגיאה בטעינת ה-Webhooks');
    }
  };

  const addWebhook = async () => {
    try {
      if (!newUrl) throw new Error('נא להזין כתובת URL');
      if (!onOrderCreated && !onOrderPaid && !onProductPurchased) {
        throw new Error('נא לבחור לפחות אירוע אחד');
      }
      
      // אם נבחר אירוע רכישת מוצר אבל לא נבחר מוצר ספציפי, product_id יהיה null
      // זה יגרום לwebhook להישלח בכל רכישת מוצר
      const productId = onProductPurchased ? selectedProductId : null;

      const { error } = await supabase.from('business_webhooks').insert({
        business_id: businessId,
        url: newUrl,
        on_order_created: onOrderCreated,
        on_order_paid: onOrderPaid,
        on_product_purchased: onProductPurchased,
        product_id: productId
      });

      if (error) throw error;

      setIsOpen(false);
      setNewUrl('');
      setOnOrderCreated(false);
      setOnOrderPaid(false);
      setOnProductPurchased(false);
      setSelectedProductId(null);
      await fetchWebhooks();

      toast.success('Webhook נוסף בהצלחה');
    } catch (error) {
      console.error('Error adding webhook:', error);
      toast.error(error instanceof Error ? error.message : 'שגיאה בהוספת ה-Webhook');
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase
        .from('business_webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchWebhooks();
      toast.success('Webhook נמחק בהצלחה');
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('שגיאה במחיקת ה-Webhook');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">אוטומציות</h1>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-600"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף Webhook
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">הוסף Webhook חדש</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">כתובת URL</label>
                <input
                  type="url"
                  className="w-full p-2 border rounded-lg"
                  placeholder="https://example.com/webhook"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium mb-1 block">מתי להפעיל את ה-Webhook?</label>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="orderCreated"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={onOrderCreated}
                    onChange={(e) => setOnOrderCreated(e.target.checked)}
                  />
                  <label htmlFor="orderCreated" className="mr-2 text-sm text-gray-700">
                    כאשר נוצרת הזמנה חדשה
                  </label>
                </div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="orderPaid"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={onOrderPaid}
                    onChange={(e) => setOnOrderPaid(e.target.checked)}
                  />
                  <label htmlFor="orderPaid" className="mr-2 text-sm text-gray-700">
                    כאשר הזמנה מסומנת כשולמה
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="productPurchased"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={onProductPurchased}
                    onChange={(e) => setOnProductPurchased(e.target.checked)}
                  />
                  <label htmlFor="productPurchased" className="mr-2 text-sm text-gray-700">
                    כאשר מוצר נרכש
                  </label>
                </div>
              </div>
              
              {onProductPurchased && (
                <div className="mt-3">
                  <label className="text-sm font-medium mb-1 block">בחר מוצר ספציפי (אופציונלי)</label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    value={selectedProductId || ''}
                    onChange={(e) => setSelectedProductId(e.target.value || null)}
                  >
                    <option value="">כל המוצרים</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.price} ש"ח
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">אם לא תבחר מוצר ספציפי, ה-webhook יישלח בכל רכישת מוצר</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  ביטול
                </button>
                <button
                  onClick={addWebhook}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg mr-2 hover:bg-blue-600"
                >
                  הוסף
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                כתובת URL
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                הזמנה חדשה נוצרה
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                הזמנה שולמה
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מוצר נרכש
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מוצר ספציפי
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {webhooks.map((webhook) => {
              // מציאת שם המוצר אם יש מוצר ספציפי
              const specificProduct = webhook.product_id 
                ? products.find(p => p.id === webhook.product_id) 
                : null;
              
              return (
                <tr key={webhook.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap" dir="ltr">
                    <span className="text-sm text-gray-900">{webhook.url}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={webhook.on_order_created}
                      disabled
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={webhook.on_order_paid}
                      disabled
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={webhook.on_product_purchased}
                      disabled
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {webhook.on_product_purchased && (
                      <span className="text-sm text-gray-900">
                        {specificProduct ? specificProduct.name : 'כל המוצרים'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
