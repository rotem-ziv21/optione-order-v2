import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Check, X, Link as LinkIcon, Globe, Zap, Tag, Settings, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
  }, [user, businessId, navigate]);
  
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
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold text-white">אוטומציות</h1>
          <p className="text-indigo-100 mt-2">חיבור המערכת לשירותים חיצוניים באמצעות Webhooks</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="bg-white text-indigo-600 px-5 py-3 rounded-xl flex items-center font-medium shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Plus className="h-5 w-5 ml-2" />
          הוסף Webhook
        </motion.button>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e: React.MouseEvent) => e.target === e.currentTarget && setIsOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">הוספת Webhook חדש</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
                >
                  <X className="h-6 w-6" />
                </motion.button>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">כתובת URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Globe className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150"
                    placeholder="https://example.com/webhook"
                    dir="ltr"
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">אירועים</label>
                
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                  <div className="flex items-center">
                    <div className="relative inline-block w-10 ml-3 align-middle select-none transition duration-200 ease-in">
                      <input 
                        type="checkbox" 
                        id="orderCreated" 
                        checked={onOrderCreated}
                        onChange={(e) => setOnOrderCreated(e.target.checked)}
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out right-0"
                        style={{ transform: onOrderCreated ? 'translateX(-16px)' : 'translateX(0)' }}
                      />
                      <label 
                        htmlFor="orderCreated" 
                        className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${onOrderCreated ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      ></label>
                    </div>
                    <label htmlFor="orderCreated" className="text-sm font-medium text-gray-700 cursor-pointer">
                      הזמנה חדשה נוצרה
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="relative inline-block w-10 ml-3 align-middle select-none transition duration-200 ease-in">
                      <input 
                        type="checkbox" 
                        id="orderPaid" 
                        checked={onOrderPaid}
                        onChange={(e) => setOnOrderPaid(e.target.checked)}
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out right-0"
                        style={{ transform: onOrderPaid ? 'translateX(-16px)' : 'translateX(0)' }}
                      />
                      <label 
                        htmlFor="orderPaid" 
                        className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${onOrderPaid ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      ></label>
                    </div>
                    <label htmlFor="orderPaid" className="text-sm font-medium text-gray-700 cursor-pointer">
                      הזמנה שולמה
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="relative inline-block w-10 ml-3 align-middle select-none transition duration-200 ease-in">
                      <input 
                        type="checkbox" 
                        id="productPurchased" 
                        checked={onProductPurchased}
                        onChange={(e) => setOnProductPurchased(e.target.checked)}
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out right-0"
                        style={{ transform: onProductPurchased ? 'translateX(-16px)' : 'translateX(0)' }}
                      />
                      <label 
                        htmlFor="productPurchased" 
                        className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${onProductPurchased ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      ></label>
                    </div>
                    <label htmlFor="productPurchased" className="text-sm font-medium text-gray-700 cursor-pointer">
                      מוצר נרכש
                    </label>
                  </div>
                </div>
              </div>
              
              <AnimatePresence>
                {onProductPurchased && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 overflow-hidden"
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-2">מוצר ספציפי (אופציונלי)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <Tag className="h-5 w-5 text-gray-400" />
                      </div>
                      <select
                        value={selectedProductId || ''}
                        onChange={(e) => setSelectedProductId(e.target.value || null)}
                        className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 appearance-none"
                      >
                        <option value="">כל המוצרים</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex justify-end mt-8 space-x-3" style={{ direction: 'ltr' }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-150"
                >
                  ביטול
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={addWebhook}
                  className="px-5 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-150"
                >
                  הוסף Webhook
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {webhooks.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-md p-8 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <LinkIcon className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">אין Webhooks מוגדרים</h3>
          <p className="text-gray-500 mb-6">הוסף את ה-Webhook הראשון שלך כדי להתחיל לחבר את המערכת לשירותים חיצוניים</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center font-medium mx-auto hover:bg-indigo-700 transition-all duration-200"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף Webhook
          </motion.button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-md overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Globe className="h-4 w-4 ml-2" />כתובת URL</div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Plus className="h-4 w-4 ml-2" />הזמנה חדשה</div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Check className="h-4 w-4 ml-2" />הזמנה שולמה</div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Zap className="h-4 w-4 ml-2" />מוצר נרכש</div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Tag className="h-4 w-4 ml-2" />מוצר ספציפי</div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    <div className="flex items-center justify-end"><Settings className="h-4 w-4 ml-2" />פעולות</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {webhooks.map((webhook, index) => {
                  // מציאת שם המוצר אם יש מוצר ספציפי
                  const specificProduct = webhook.product_id 
                    ? products.find(p => p.id === webhook.product_id) 
                    : null;
                  
                  return (
                    <motion.tr 
                      key={webhook.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-indigo-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-5" dir="ltr">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-indigo-100 rounded-md flex items-center justify-center ml-3">
                            <ExternalLink className="h-4 w-4 text-indigo-600" />
                          </div>
                          <a 
                            href={webhook.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-gray-900 hover:text-indigo-600 transition-colors duration-150 truncate max-w-xs"
                          >
                            {webhook.url}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${webhook.on_order_created ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {webhook.on_order_created ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${webhook.on_order_paid ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {webhook.on_order_paid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${webhook.on_product_purchased ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {webhook.on_product_purchased ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {webhook.on_product_purchased && (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${specificProduct ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {specificProduct ? specificProduct.name : 'כל המוצרים'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteWebhook(webhook.id)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-150"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
