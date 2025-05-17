import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QuoteGenerator from './QuoteGenerator';
import PaymentOptionsModal from './PaymentOptionsModal';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomerDetailsProps {
  customer: {
    id: string;
    contact_id: string;
    name: string;
    email: string;
  };
  onClose: () => void;
  onEdit: () => void;
  onAddProducts: () => void;
}

interface Order {
  id: string;
  total_amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method?: string;
  payment_reference?: string;
  receipt_url?: string;
  created_at: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

interface CustomerStats {
  totalProducts: number;
  pendingProducts: number;
  totalSpent: number;
  pendingAmount: number;
}

export default function CustomerDetails({ customer, onClose, onEdit, onAddProducts }: CustomerDetailsProps) {
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrdersForQuote, setSelectedOrdersForQuote] = useState<Order[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalProducts: 0,
    pendingProducts: 0,
    totalSpent: 0,
    pendingAmount: 0
  });

  useEffect(() => {
    fetchOrders();
  }, [customer.contact_id]);

  useEffect(() => {
    // Calculate stats whenever orders change
    const newStats = orders.reduce((acc, order) => {
      const orderItems = order.items || [];
      const orderTotal = Number(order.total_amount);
      const itemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

      if (order.status === 'completed') {
        acc.totalProducts += itemsCount;
        acc.totalSpent += orderTotal;
      } else if (order.status === 'pending') {
        acc.pendingProducts += itemsCount;
        acc.pendingAmount += orderTotal;
      }

      return acc;
    }, {
      totalProducts: 0,
      pendingProducts: 0,
      totalSpent: 0,
      pendingAmount: 0
    });

    setStats(newStats);
  }, [orders]);

  const fetchOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          id,
          total_amount,
          currency,
          status,
          payment_method,
          payment_reference,
          receipt_url,
          created_at
        `)
        .eq('customer_id', customer.contact_id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const ordersWithItems = await Promise.all((ordersData || []).map(async (order) => {
        const { data: items } = await supabase
          .from('order_items')
          .select(`
            quantity,
            price_at_time,
            products (name)
          `)
          .eq('order_id', order.id);

        return {
          ...order,
          items: (items || []).map(item => ({
            product_name: item.products.name,
            quantity: item.quantity,
            price: item.price_at_time
          }))
        };
      }));

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
    if (selectedOrdersData.length > 0) {
      setShowPaymentOptions(true);
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      }
      return [...prev, orderId];
    });
  };

  const handleCreateQuote = async () => {
    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
    if (selectedOrdersData.length > 0) {
      try {
        // קבלת העסק המחובר
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          return;
        }

        let businessId = null;

        if (user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com') {
          const { data: businesses } = await supabase
            .from('businesses')
            .select('id')
            .limit(1)
            .single();
          
          if (businesses) {
            businessId = businesses.id;
          }
        } else {
          const { data: staffBusiness } = await supabase
            .from('business_staff')
            .select('business_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();
          
          if (staffBusiness) {
            businessId = staffBusiness.business_id;
          }
        }

        if (!businessId) {
          console.error('No active business found');
          return;
        }

        // מיפוי המוצרים מההזמנות שנבחרו
        const products = selectedOrdersData.flatMap(order => 
          (order.items || []).map(item => ({
            name: item.product_name,
            quantity: item.quantity,
            price: Number(item.price),
            currency: order.currency || 'ILS'
          }))
        );

        // בדיקה שיש מוצרים ומחירים תקינים
        if (products.length === 0 || products.some(p => !p.price || p.price <= 0)) {
          console.error('Invalid products data:', products);
          return;
        }

        console.log('Creating quote with products:', products);
        setShowQuoteGenerator(true);
        setSelectedOrdersForQuote(selectedOrdersData);
        
        // שמירת ה-business_id ב-localStorage
        localStorage.setItem('currentBusinessId', businessId);
        console.log('Saved business ID:', businessId); // לוג לדיבוג
      } catch (error) {
        console.error('Error preparing quote:', error);
      }
    }
  };

  const renderOrdersList = () => (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">היסטוריית הזמנות</h3>
        {selectedOrders.length > 0 && (
          <div className="flex space-x-4">
            <button
              onClick={handleCreateQuote}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <Icons.FileText className="w-5 h-5" />
              <span>צור הצעת מחיר מהזמנות שנבחרו</span>
            </button>
            <button
              onClick={handlePayment}
              className="flex items-center space-x-2 text-green-600 hover:text-green-700"
            >
              <Icons.CreditCard className="w-5 h-5" />
              <span>תשלום להזמנות שנבחרו</span>
            </button>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <div 
            key={order.id} 
            className={`border rounded-lg p-4 ${
              selectedOrders.includes(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start space-x-4">
                {order.status === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.id)}
                    onChange={() => handleOrderSelect(order.id)}
                    className="mt-1"
                  />
                )}
                <div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(order.created_at), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-sm font-medium text-gray-900 mt-1">
                    סכום: {order.currency} {order.total_amount.toFixed(2)}
                  </div>
                  {order.payment_method && (
                    <div className="text-sm text-gray-600 mt-1">
                      שולם באמצעות: {
                        order.payment_method === 'bank_transfer' ? 'העברה בנקאית' :
                        order.payment_method === 'cash' ? 'מזומן' :
                        order.payment_method === 'check' ? "צ'ק" :
                        order.payment_method === 'invoice' ? 'חשבונית' :
                        order.payment_method
                      }
                      {order.payment_reference && ` (${order.payment_reference})`}
                    </div>
                  )}
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {order.status === 'completed' ? 'שולם' :
                 order.status === 'cancelled' ? 'בוטל' :
                 'ממתין לתשלום'}
              </span>
            </div>
            <div className="mt-4">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="text-right text-xs font-medium text-gray-500">מוצר</th>
                    <th className="text-right text-xs font-medium text-gray-500">כמות</th>
                    <th className="text-right text-xs font-medium text-gray-500">מחיר</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td className="text-sm text-gray-900">{item.product_name}</td>
                      <td className="text-sm text-gray-900">{item.quantity}</td>
                      <td className="text-sm text-gray-900">
                        {order.currency} {item.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.receipt_url && (
              <a
                href={order.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Icons.FileText className="w-4 h-4 ml-1" />
                חשבונית
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <h2 className="text-xl font-bold">פרטי לקוח</h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          <div className="space-y-6">
            {/* Customer Info */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex justify-between items-start bg-white p-5 rounded-xl shadow-sm border border-gray-100"
            >
              <div>
                <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
                <div className="flex items-center mt-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    <Icons.User className="w-3 h-3 mr-1" />
                    מזהה: {customer.contact_id.substring(0, 8)}...
                  </span>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center">
                      <Icons.Mail className="w-3.5 h-3.5 mr-1" />
                      {customer.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onEdit}
                  className="text-purple-600 hover:text-purple-700 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                  title="ערוך פרטי לקוח"
                >
                  <Icons.Edit className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>

            {/* Customer Stats */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <motion.div 
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl shadow-sm border border-blue-200"
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="p-2 bg-blue-500 bg-opacity-10 rounded-lg">
                    <Icons.Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">מוצרים שנרכשו</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalProducts}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-xl shadow-sm border border-amber-200"
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="p-2 bg-amber-500 bg-opacity-10 rounded-lg">
                    <Icons.Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800">מוצרים בהמתנה</p>
                    <p className="text-2xl font-bold text-amber-900">{stats.pendingProducts}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl shadow-sm border border-green-200"
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="p-2 bg-green-500 bg-opacity-10 rounded-lg">
                    <Icons.DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">סה"כ רכישות</p>
                    <p className="text-2xl font-bold text-green-900">₪{stats.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-rose-50 to-rose-100 p-5 rounded-xl shadow-sm border border-rose-200"
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="p-2 bg-rose-500 bg-opacity-10 rounded-lg">
                    <Icons.Clock className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rose-800">בהמתנה לתשלום</p>
                    <p className="text-2xl font-bold text-rose-900">₪{stats.pendingAmount.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Actions */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.1), 0 4px 6px -2px rgba(59, 130, 246, 0.05)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowQuoteGenerator(true)}
                className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white p-4 rounded-xl shadow-md transition-all duration-200"
              >
                <Icons.FileText className="w-5 h-5" />
                <span className="font-medium">צור הצעת מחיר</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -2px rgba(16, 185, 129, 0.05)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onAddProducts}
                className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white p-4 rounded-xl shadow-md transition-all duration-200"
              >
                <Icons.ShoppingBag className="w-5 h-5" />
                <span className="font-medium">הוסף מוצרים</span>
              </motion.button>
            </motion.div>

            {/* Orders */}
            {orders.length > 0 && (
              renderOrdersList()
            )}

            {/* Contact Info */}
            {customer.email && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">פרטי התקשרות</h4>
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 inline-flex"
                >
                  <Icons.Mail className="w-5 h-5" />
                  <span>{customer.email}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      {showQuoteGenerator && (
        <QuoteGenerator
          customer={customer}
          products={selectedOrdersForQuote.flatMap(order => 
            (order.items || []).map(item => ({
              name: item.product_name,
              quantity: item.quantity,
              price: Number(item.price),
              currency: order.currency || 'ILS'
            }))
          )}
          onClose={() => {
            setShowQuoteGenerator(false);
            setSelectedOrders([]);
            setSelectedOrdersForQuote([]);
          }}
        />
      )}

      {showPaymentOptions && (
        <PaymentOptionsModal
          customer={customer}
          orders={orders.filter(order => selectedOrders.includes(order.id))}
          onClose={() => {
            setShowPaymentOptions(false);
            setSelectedOrders([]);
          }}
          onSuccess={() => {
            fetchOrders();
            setShowPaymentOptions(false);
            setSelectedOrders([]);
          }}
        />
      )}
    </div>
  );
}