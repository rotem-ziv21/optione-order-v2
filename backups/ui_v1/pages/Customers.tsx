import { useState, useEffect } from 'react';
import { Search, UserPlus, ShoppingBag } from 'lucide-react';
import CustomerProductForm from '../components/CustomerProductForm';
import CustomerSearch from '../components/CustomerSearch';
import CustomerDetails from '../components/CustomerDetails';
import CustomerEdit from '../components/CustomerEdit';
import OrderStatusUpdate from '../components/OrderStatusUpdate';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useCardcomCallback } from '../hooks/useCardcomCallback';
import type { CRMContact } from '../lib/crm-api';

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  sku: string;
  business_id: string;
}

interface CustomerOrder {
  id: string;
  total_amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  items: OrderItem[];
  business_id: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price_at_time: number;
  currency: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  contact_id: string;
  business_id: string;
}

export default function Customers() {
  useCardcomCallback();

  const [searchTerm, setSearchTerm] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Record<string, CustomerOrder[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [isAddingProducts, setIsAddingProducts] = useState(false);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchProducts();
      fetchCustomers();
      fetchCustomerOrders();
    }
  }, [currentBusinessId]);

  const getCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // אם המשתמש הוא אדמין, קח את העסק הראשון
      if (user.email === 'rotemziv7766@gmail.com' || user.email === 'rotem@optionecrm.com') {
        const { data: businesses } = await supabase
          .from('businesses')
          .select('id')
          .limit(1)
          .single();
        
        if (businesses) {
          setCurrentBusinessId(businesses.id);
        }
      } else {
        // אם לא, קח את העסק שהמשתמש שייך אליו
        const { data: staffBusiness } = await supabase
          .from('business_staff')
          .select('business_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        if (staffBusiness) {
          setCurrentBusinessId(staffBusiness.business_id);
        }
      }
    } catch (error) {
      console.error('Error getting current business:', error);
    }
  };

  const fetchProducts = async () => {
    if (!currentBusinessId) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', currentBusinessId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCustomers = async () => {
    if (!currentBusinessId) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', currentBusinessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchCustomerOrders = async () => {
    if (!currentBusinessId) return;
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          id,
          customer_id,
          total_amount,
          currency,
          status,
          created_at,
          business_id
        `)
        .eq('business_id', currentBusinessId);

      if (ordersError) throw ordersError;

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          price_at_time,
          currency,
          products (
            name
          )
        `);

      if (itemsError) throw itemsError;

      const ordersByCustomer: Record<string, CustomerOrder[]> = {};
      orders?.forEach(order => {
        const items = orderItems
          ?.filter(item => item.order_id === order.id)
          .map(item => ({
            product_name: item.products?.name || 'Unknown Product',
            quantity: item.quantity,
            price_at_time: item.price_at_time,
            currency: item.currency
          }));

        if (!ordersByCustomer[order.customer_id]) {
          ordersByCustomer[order.customer_id] = [];
        }

        ordersByCustomer[order.customer_id].push({
          ...order,
          items: items || []
        });
      });

      setCustomerOrders(ordersByCustomer);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProducts = async (data: { products: Array<{ productId: string; quantity: number }> }) => {
    if (!selectedCustomer || isAddingProducts) return;

    setIsAddingProducts(true);
    try {
      const totalAmount = Number(data.products.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0).toFixed(2));

      const { data: order, error: orderError } = await supabase
        .from('customer_orders')
        .insert([{
          customer_id: selectedCustomer.contact_id,
          total_amount: totalAmount,
          currency: 'ILS',
          status: 'pending',
          business_id: currentBusinessId
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = data.products.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          price_at_time: product?.price || 0,
          currency: product?.currency || 'ILS'
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setShowProductForm(false);
      await fetchCustomerOrders();  // חכה לסיום הפעולה
    } catch (error) {
      console.error('Error adding order:', error);
    } finally {
      setIsAddingProducts(false);
    }
  };

  const handleStatusUpdate = (orderId: string) => {
    setSelectedOrder(orderId);
    setShowStatusUpdate(true);
  };

  const getOrderStatus = (orderId: string | null): string => {
    if (!orderId) return 'pending';
    
    // Find the order in customerOrders
    for (const customerId in customerOrders) {
      const order = customerOrders[customerId].find(o => o.id === orderId);
      if (order) {
        return order.status;
      }
    }
    return 'pending'; // Default status if not found
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (customer.name?.toLowerCase().includes(searchLower) || false) ||
      (customer.email?.toLowerCase().includes(searchLower) || false) ||
      (customer.contact_id?.toLowerCase().includes(searchLower) || false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש לקוחות..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            dir="rtl"
          />
        </div>
        <button 
          onClick={() => setShowSearch(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
        >
          <UserPlus className="w-5 h-5" />
          <span>הוסף לקוח</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                לקוח
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מזהה איש קשר
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                סה"כ הזמנות
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                סה"כ רכישות
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  {searchTerm ? 'לא נמצאו לקוחות התואמים לחיפוש' : 'אין לקוחות להצגה'}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => {
                const customerOrdersList = customerOrders[customer.contact_id] || [];
                const totalSpent = customerOrdersList.reduce((sum, order) => sum + order.total_amount, 0);
                
                return (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div 
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => handleCustomerClick(customer)}
                      >
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">{customer.contact_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">{customerOrdersList.length}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">₪{totalSpent.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowProductForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 ml-3"
                        title="הוספת מוצרים"
                      >
                        <ShoppingBag className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Orders Table */}
      {selectedCustomer && customerOrders[selectedCustomer.contact_id] && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">הזמנות של {selectedCustomer.name}</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מספר הזמנה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  תאריך
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סכום
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customerOrders[selectedCustomer.contact_id].map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">{order.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {format(new Date(order.created_at), 'dd/MM/yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">₪{order.total_amount.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">{order.status}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleStatusUpdate(order.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      עדכון סטטוס
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showProductForm && selectedCustomer && (
        <CustomerProductForm
          onClose={() => setShowProductForm(false)}
          onSubmit={handleAddProducts}
          products={products}
          customerId={selectedCustomer.contact_id}
          businessId={currentBusinessId || ''}
        />
      )}

      {showSearch && (
        <CustomerSearch
          onClose={() => setShowSearch(false)}
          onCustomerSelect={(contact) => {
            setShowSearch(false);
            // Force an immediate refresh of customers
            fetchCustomers().then(() => {
              // After a short delay to ensure the database has updated
              setTimeout(() => {
                // Fetch customers again to get the latest data
                fetchCustomers().then(() => {
                  // Try to find the newly added customer
                  const newCustomer = customers.find(c => c.contact_id === contact.id);
                  if (newCustomer) {
                    setSelectedCustomer(newCustomer);
                    setShowDetails(true);
                  }
                });
              }, 1000);
            });
          }}
          businessId={currentBusinessId || ''}
        />
      )}

      {showDetails && selectedCustomer && (
        <CustomerDetails
          customer={selectedCustomer}
          onClose={() => setShowDetails(false)}
          onEdit={() => {
            setShowDetails(false);
            setShowEdit(true);
          }}
          onAddProducts={() => {
            setShowDetails(false);
            setShowProductForm(true);
          }}
        />
      )}

      {showEdit && selectedCustomer && (
        <CustomerEdit
          customer={selectedCustomer}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            fetchCustomers();
          }}
        />
      )}

      {showStatusUpdate && selectedOrder && (
        <OrderStatusUpdate
          orderId={selectedOrder}
          businessId={currentBusinessId || ''}
          currentStatus={getOrderStatus(selectedOrder)}
          onClose={() => setShowStatusUpdate(false)}
          onUpdate={fetchCustomerOrders}
        />
      )}
    </div>
  );
}