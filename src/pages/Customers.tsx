import { useState, useEffect, useMemo } from 'react';
import { Search, UserPlus, ShoppingBag, Users, UserCheck, CreditCard, Tag, RefreshCw, Download, X, Edit, Eye } from 'lucide-react';
import CustomerProductForm from '../components/CustomerProductForm';
import CustomerSearch from '../components/CustomerSearch';
import CustomerDetails from '../components/CustomerDetails';
import CustomerEdit from '../components/CustomerEdit';
import OrderStatusUpdate from '../components/OrderStatusUpdate';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useCardcomCallback } from '../hooks/useCardcomCallback';
import CustomerFilter, { CustomerFilterCriteria } from '../components/CustomerFilter';

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
  const [customerFilters, setCustomerFilters] = useState<CustomerFilterCriteria>({});
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
    
    // Debug: Log all orders
    console.log('All orders:', orders);
    
    orders?.forEach(order => {
      const items = orderItems
        ?.filter(item => item.order_id === order.id)
        .map(item => ({
          product_name: item.products && typeof item.products === 'object' && 'name' in item.products ? String(item.products.name) : 'Unknown Product',
          quantity: item.quantity,
          price_at_time: item.price_at_time,
          currency: item.currency
        }));

      // Store orders by both customer_id and contact_id to ensure we catch all
      const customerId = order.customer_id;
      
      if (!ordersByCustomer[customerId]) {
        ordersByCustomer[customerId] = [];
      }

      ordersByCustomer[customerId].push({
        ...order,
        items: items || []
      });
    });
    
    // Debug: Log the organized orders
    console.log('Orders by customer:', ordersByCustomer);

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
    console.log(`Order ${orderId} not found`);
    return 'pending'; // Default status if not found
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  // Calculate customer total order amounts for filtering
  const customerTotalAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    
    // Initialize amounts for all customers to 0
    customers.forEach(customer => {
      // Use contact_id as the key since that's what we use to store orders
      amounts[customer.contact_id] = 0;
    });
    
    // Sum order amounts for each customer
    customers.forEach(customer => {
      const customerId = customer.contact_id;
      const allOrders = customerOrders[customerId] || [];
      
      console.log(`Processing customer ${customer.name} (${customerId}) with ${allOrders.length} orders`);
      
      // Sum up all order amounts
      let totalAmount = 0;
      allOrders.forEach(order => {
        // Make sure we're dealing with numbers
        if (order.total_amount !== null && order.total_amount !== undefined) {
          // Force conversion to number
          const amount = typeof order.total_amount === 'string' ? 
            parseFloat(order.total_amount) : Number(order.total_amount);
          
          if (!isNaN(amount)) {
            totalAmount += amount;
            console.log(`Adding ${amount} to total for customer ${customer.name}`);
          }
        }
      });
      
      // Store the total amount using contact_id
      amounts[customerId] = totalAmount;
      console.log(`Customer ${customer.name} (${customerId}) final total amount: ${totalAmount}`);
    });
    
    // Log all customer amounts for debugging
    console.log('All customer amounts:', amounts);
    
    return amounts;
  }, [customerOrders, customers]);

  // Filter customers based on search term and order amount filters
  const filteredCustomers = useMemo(() => {
    console.log('Filtering customers with filters:', customerFilters);
    
    return customers.filter(customer => {
      // Filter by search term
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (customer.name?.toLowerCase().includes(searchLower) || false) || 
        (customer.email?.toLowerCase().includes(searchLower) || false) || 
        (customer.contact_id?.toLowerCase().includes(searchLower) || false);
      
      if (!matchesSearch) return false;
      
      // Get the total amount for this customer using contact_id
      const totalAmount = customerTotalAmounts[customer.contact_id] || 0;
      console.log(`Customer ${customer.name} (${customer.contact_id}) has total amount: ${totalAmount}`);
      
      // Apply filters
      if (customerFilters.totalAmountGreaterThan !== undefined) {
        const greaterThanValue = Number(customerFilters.totalAmountGreaterThan);
        console.log(`Checking if ${customer.name}'s total (${totalAmount}) > ${greaterThanValue}`);
        
        // לקוח יוצג רק אם הסכום שלו גדול מהערך שהוזן
        if (totalAmount <= greaterThanValue) {
          console.log(`${customer.name} filtered out: ${totalAmount} is NOT greater than ${greaterThanValue}`);
          return false;
        }
        console.log(`${customer.name} passes greater than filter: ${totalAmount} > ${greaterThanValue}`);
      }
      
      if (customerFilters.totalAmountLessThan !== undefined) {
        const lessThanValue = Number(customerFilters.totalAmountLessThan);
        if (totalAmount >= lessThanValue) {
          console.log(`${customer.name} filtered out: ${totalAmount} is NOT less than ${lessThanValue}`);
          return false;
        }
        console.log(`${customer.name} passes less than filter: ${totalAmount} < ${lessThanValue}`);
      }
      
      if (customerFilters.totalAmountEqualTo !== undefined) {
        const equalToValue = Number(customerFilters.totalAmountEqualTo);
        if (totalAmount !== equalToValue) {
          console.log(`${customer.name} filtered out: ${totalAmount} is NOT equal to ${equalToValue}`);
          return false;
        }
        console.log(`${customer.name} passes equal to filter: ${totalAmount} = ${equalToValue}`);
      }
      
      // Customer passed all filters
      console.log(`${customer.name} passed all filters`);
      return true;
    });
  }, [customers, searchTerm, customerTotalAmounts, customerFilters]);

// ...
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <div className="text-gray-600 font-medium">טוען נתוני לקוחות...</div>
      </div>
    );
  }

  // Calculate statistics
  const totalCustomers = customers.length;
  const totalOrders = Object.values(customerOrders).reduce((sum, orders) => sum + orders.length, 0);
  const totalRevenue = Object.values(customerOrders).reduce((sum, orders) => {
    return sum + orders.reduce((orderSum, order) => orderSum + order.total_amount, 0);
  }, 0);
  const activeCustomers = Object.keys(customerOrders).filter(id => customerOrders[id].length > 0).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm p-4 border border-purple-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">סה"כ לקוחות</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalCustomers}</h3>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <span className="text-green-500 font-medium">{activeCustomers}</span> לקוחות פעילים
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-sm p-4 border border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">לקוחות פעילים</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {activeCustomers}
              </h3>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0}% מסך הלקוחות
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-4 border border-green-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">סה"כ הזמנות</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {totalOrders}
              </h3>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : 0} הזמנות ללקוח
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-sm p-4 border border-amber-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-1">סה"כ הכנסות</p>
              <h3 className="text-2xl font-bold text-gray-800">
                ₪{totalRevenue.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </h3>
            </div>
            <div className="bg-amber-100 p-2 rounded-lg">
              <CreditCard className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {activeCustomers > 0 ? `₪${(totalRevenue / activeCustomers).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '₪0'} ממוצע ללקוח
          </div>
        </div>
      </div>

      {/* Search and actions bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש לקוחות..."
            className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            dir="rtl"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <CustomerFilter 
            onFilterChange={setCustomerFilters} 
            activeFilters={customerFilters} 
          />
          <button 
            onClick={() => {
              fetchCustomers();
              fetchCustomerOrders();
            }}
            className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2.5 rounded-lg transition-colors">
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSearch(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg flex items-center space-x-2 hover:from-purple-700 hover:to-indigo-700 shadow-sm transition-all duration-200 mr-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>הוסף לקוח</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center justify-end">
                  <span className="ml-1">לקוח</span>
                  <UserCheck className="w-4 h-4 text-gray-400" />
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end">
                    <span className="ml-1">מזהה איש קשר</span>
                    <Tag className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end">
                    <span className="ml-1">סה"כ הזמנות</span>
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end">
                    <span className="ml-1">סה"כ רכישות</span>
                    <CreditCard className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-3 rounded-full">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {searchTerm ? 'לא נמצאו לקוחות התואמים לחיפוש' : 'אין לקוחות להצגה'}
                      </p>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          נקה חיפוש
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const customerOrdersList = customerOrders[customer.contact_id] || [];
                  const totalSpent = customerOrdersList.reduce((sum, order) => sum + order.total_amount, 0);
                  const hasOrders = customerOrdersList.length > 0;
                  
                  return (
                    <tr key={customer.id} className="hover:bg-purple-50/30 transition-colors duration-150">
                      <td className="px-6 py-4 text-right">
                        <div 
                          className="cursor-pointer group"
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <div className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md inline-block">{customer.contact_id}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-medium px-2.5 py-1 rounded-full inline-flex items-center justify-center ${hasOrders ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {customerOrdersList.length}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ₪{totalSpent.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => handleCustomerClick(customer)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-100 p-2 rounded-lg hover:bg-blue-200 transition-colors mr-2"
                            title="צפייה בפרטים"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowProductForm(true);
                            }}
                            className="text-purple-600 hover:text-purple-900 bg-purple-100 p-2 rounded-lg hover:bg-purple-200 transition-colors mr-2"
                            title="הוספת מוצרים"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowEdit(true);
                            }}
                            className="text-amber-600 hover:text-amber-900 bg-amber-100 p-2 rounded-lg hover:bg-amber-200 transition-colors"
                            title="עריכת לקוח"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {filteredCustomers.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-right">
            <p className="text-sm text-gray-600">
              מציג <span className="font-medium">{filteredCustomers.length}</span> מתוך <span className="font-medium">{customers.length}</span> לקוחות
            </p>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {selectedCustomer && customerOrders[selectedCustomer.contact_id] && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6 border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              סגור
            </button>
            <h3 className="text-lg font-medium text-gray-900">הזמנות של {selectedCustomer.name}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מספר הזמנה
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סכום
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {customerOrders[selectedCustomer.contact_id].length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      אין הזמנות ללקוח זה
                    </td>
                  </tr>
                ) : (
                  customerOrders[selectedCustomer.contact_id].map((order) => {
                    const statusClass = {
                      pending: 'bg-amber-100 text-amber-800',
                      completed: 'bg-green-100 text-green-800',
                      cancelled: 'bg-red-100 text-red-800'
                    }[order.status] || 'bg-gray-100 text-gray-800';
                    
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">{order.id.substring(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm text-gray-700">
                            {format(new Date(order.created_at), 'dd/MM/yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ₪{order.total_amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                            {{
                              pending: 'בהמתנה',
                              completed: 'הושלם',
                              cancelled: 'בוטל'
                            }[order.status] || order.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleStatusUpdate(order.id)}
                            className="text-purple-600 hover:text-purple-900 bg-purple-100 p-2 rounded-lg hover:bg-purple-200 transition-colors"
                            title="עדכון סטטוס"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {customerOrders[selectedCustomer.contact_id].length > 0 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-right">
              <p className="text-sm text-gray-600">
                סה"כ <span className="font-medium">{customerOrders[selectedCustomer.contact_id].length}</span> הזמנות
              </p>
            </div>
          )}
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