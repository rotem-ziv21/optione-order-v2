import React, { useState, useEffect } from 'react';
import { X, Mail, FileText, Edit2, ShoppingBag, CreditCard, MoreVertical, Package, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QuoteGenerator from './QuoteGenerator';
import PaymentOptionsModal from './PaymentOptionsModal';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

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

  const handleCreateQuote = () => {
    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
    if (selectedOrdersData.length > 0) {
      const products = selectedOrdersData.flatMap(order => 
        order.items.map(item => ({
          id: '', // We don't need the actual product ID for quotes
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          currency: order.currency
        }))
      );
      setSelectedOrdersForQuote(selectedOrdersData);
      setShowQuoteGenerator(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">פרטי לקוח</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{customer.name}</h3>
                <p className="text-sm text-gray-500 mt-1">מזהה איש קשר: {customer.contact_id}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={onEdit}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
                  title="ערוך פרטי לקוח"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">מוצרים שנרכשו</p>
                    <p className="text-xl font-semibold text-gray-900">{stats.totalProducts}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">מוצרים בהמתנה</p>
                    <p className="text-xl font-semibold text-gray-900">{stats.pendingProducts}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">סה"כ רכישות</p>
                    <p className="text-xl font-semibold text-gray-900">₪{stats.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">בהמתנה לתשלום</p>
                    <p className="text-xl font-semibold text-gray-900">₪{stats.pendingAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowQuoteGenerator(true)}
                className="flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 p-4 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                <FileText className="w-5 h-5" />
                <span>צור הצעת מחיר</span>
              </button>
              
              <button
                onClick={onAddProducts}
                className="flex items-center justify-center space-x-2 text-green-600 hover:text-green-700 p-4 border border-green-200 rounded-lg hover:bg-green-50"
              >
                <ShoppingBag className="w-5 h-5" />
                <span>הוסף מוצרים</span>
              </button>
            </div>

            {/* Orders */}
            {orders.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">היסטוריית הזמנות</h3>
                  {selectedOrders.length > 0 && (
                    <div className="flex space-x-4">
                      <button
                        onClick={handleCreateQuote}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                      >
                        <FileText className="w-5 h-5" />
                        <span>צור הצעת מחיר מהזמנות שנבחרו</span>
                      </button>
                      <button
                        onClick={handlePayment}
                        className="flex items-center space-x-2 text-green-600 hover:text-green-700"
                      >
                        <CreditCard className="w-5 h-5" />
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {customer.email && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">פרטי התקשרות</h4>
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 inline-flex"
                >
                  <Mail className="w-5 h-5" />
                  <span>{customer.email}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showQuoteGenerator && (
        <QuoteGenerator
          customer={customer}
          products={selectedOrdersForQuote.length > 0 
            ? selectedOrdersForQuote.flatMap(order => 
                order.items.map(item => ({
                  id: '',
                  name: item.product_name,
                  quantity: item.quantity,
                  price: item.price,
                  currency: order.currency
                }))
              )
            : []}
          onClose={() => {
            setShowQuoteGenerator(false);
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