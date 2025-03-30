import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, TrendingUp, Users, DollarSign, FileText, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import DateRangeFilter from '../components/DateRangeFilter';
import StaffStats from '../components/StaffStats';
import SalesDistributionChart from '../components/SalesDistributionChart';
import ProductsByStaffTable from '../components/ProductsByStaffTable';
import MonthlySalesTarget from '../components/MonthlySalesTarget';
import { utils, writeFile } from 'xlsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface DashboardStats {
  totalProducts: number;
  totalSales: number;
  activeCustomers: number;
  monthlyRevenue: number;
  quotesCount: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface SalesData {
  id: string;
  created_at: string;
  total_amount: number;
  currency: string;
  status: string;
  customer_name: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price_at_time: number;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalSales: 0,
    activeCustomers: 0,
    monthlyRevenue: 0,
    quotesCount: 0
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      console.log('Fetching dashboard data with date range:', dateRange);
      fetchDashboardData();
    }
  }, [dateRange, currentBusinessId]);

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    console.log('Date range changed to:', newRange);
    setDateRange(newRange);
  };

  const fetchDashboardData = async () => {
    if (!currentBusinessId) {
      console.log('No business ID available, skipping data fetch');
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching dashboard data for business:', currentBusinessId, 'with date range:', dateRange);
      
      // Fetch basic stats with business_id filter
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('business_id', currentBusinessId);
      
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', currentBusinessId);
      
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id')
        .eq('business_id', currentBusinessId);

      if (productsError || customersError || quotesError) {
        console.error('Errors fetching basic stats:', { productsError, customersError, quotesError });
        throw new Error('Error fetching basic stats');
      }

      // Fetch completed orders for total sales and monthly revenue
      let query = supabase
        .from('customer_orders')
        .select('total_amount, created_at')
        .eq('status', 'completed')
        .eq('business_id', currentBusinessId);

      if (dateRange?.from) {
        const fromDate = startOfDay(dateRange.from).toISOString();
        console.log('Filtering orders from date:', fromDate);
        query = query.gte('created_at', fromDate);
      }
      
      if (dateRange?.to) {
        const toDate = endOfDay(dateRange.to).toISOString();
        console.log('Filtering orders to date:', toDate);
        query = query.lte('created_at', toDate);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }

      console.log('Filtered orders:', orders?.length || 0);

      const totalSales = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      setStats({
        totalProducts: productsData?.length || 0,
        totalSales,
        activeCustomers: customersData?.length || 0,
        monthlyRevenue: totalRevenue,
        quotesCount: quotesData?.length || 0
      });

      // Fetch monthly sales data for the last 6 months
      const monthlyData = [];
      for (let i = 0; i < 6; i++) {
        const monthStart = startOfMonth(subMonths(new Date(), i));
        const monthEnd = endOfMonth(subMonths(new Date(), i));
        
        const monthOrders = orders?.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= monthStart && orderDate <= monthEnd;
        }) || [];

        monthlyData.unshift({
          month: format(monthStart, 'MMM'),
          sales: monthOrders.reduce((sum, order) => sum + order.total_amount, 0)
        });
      }
      setMonthlyData(monthlyData);

      // Fetch top selling products
      let itemsQuery = supabase
        .from('order_items')
        .select(`
          quantity,
          price_at_time,
          products (
            name
          ),
          customer_orders!inner (
            status,
            created_at,
            business_id
          )
        `)
        .eq('customer_orders.status', 'completed')
        .eq('customer_orders.business_id', currentBusinessId);

      if (dateRange?.from) {
        itemsQuery = itemsQuery.gte('customer_orders.created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        itemsQuery = itemsQuery.lte('customer_orders.created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data: orderItems, error: itemsError } = await itemsQuery;

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        throw itemsError;
      }

      console.log('Order items for business:', currentBusinessId, orderItems);

      const productStats = (orderItems || []).reduce((acc: any, item) => {
        const productName = item.products?.name;
        if (!productName) return acc;
        
        if (!acc[productName]) {
          acc[productName] = { quantity: 0, revenue: 0 };
        }
        acc[productName].quantity += item.quantity;
        acc[productName].revenue += item.quantity * item.price_at_time;
        return acc;
      }, {});

      const topProducts = Object.entries(productStats)
        .map(([name, stats]: [string, any]) => ({
          name,
          quantity: stats.quantity,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopProducts(topProducts);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const fetchSalesData = async (start: string, end: string): Promise<SalesData[]> => {
    if (!currentBusinessId || !start || !end) return [];

    try {
      console.log('Fetching sales data with:', { start, end, currentBusinessId });
      
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          id,
          created_at,
          total_amount,
          currency,
          status,
          customer_id
        `)
        .eq('business_id', currentBusinessId)
        .gte('created_at', `${start}`)
        .lte('created_at', `${end}`)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      console.log('Orders:', orders);

      if (!orders || orders.length === 0) {
        console.log('No orders found for the selected date range');
        return [];
      }

      // Fetch customers separately
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('business_id', currentBusinessId)
        .in('id', orders.map(order => order.customer_id));

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        throw customersError;
      }
      console.log('Customers:', customers);

      // Create a map for quick lookup
      const customerMap = new Map();
      (customers || []).forEach(customer => {
        customerMap.set(customer.id, customer.name);
      });

      // Fetch order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          price_at_time,
          product_id,
          products (
            name
          )
        `)
        .in('order_id', orders.map(order => order.id));

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        throw itemsError;
      }
      console.log('Order items:', orderItems);

      // Combine the data
      const salesData = orders.map(order => ({
        id: order.id,
        created_at: order.created_at,
        total_amount: order.total_amount,
        currency: order.currency,
        status: order.status,
        customer_name: customerMap.get(order.customer_id) || 'לא ידוע',
        items: (orderItems || [])
          .filter(item => item.order_id === order.id)
          .map(item => ({
            product_name: item.products?.name || '',
            quantity: item.quantity,
            price_at_time: item.price_at_time
          }))
      }));

      console.log('Final sales data:', salesData);
      return salesData;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return [];
    }
  };

  const downloadExcel = async () => {
    if (!startDate || !endDate) {
      alert('נא לבחור טווח תאריכים');
      return;
    }

    setLoading(true);
    try {
      console.log('Selected date range:', { startDate, endDate });
      const salesData = await fetchSalesData(startDate, endDate);
      
      if (salesData.length === 0) {
        alert('לא נמצאו נתונים בטווח התאריכים שנבחר');
        return;
      }

      // Prepare data for Excel
      const excelData = salesData.flatMap(sale => 
        sale.items.map(item => ({
          'תאריך': format(new Date(sale.created_at), 'dd/MM/yyyy'),
          'מספר הזמנה': sale.id,
          'שם לקוח': sale.customer_name,
          'שם מוצר': item.product_name,
          'כמות': item.quantity,
          'מחיר ליחידה': item.price_at_time,
          'סה"כ למוצר': item.quantity * item.price_at_time,
          'סטטוס': sale.status === 'completed' ? 'הושלם' : 
                   sale.status === 'pending' ? 'ממתין' : 'בוטל',
          'מטבע': sale.currency
        }))
      );

      // Create workbook
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(excelData, {
        header: [
          'תאריך',
          'מספר הזמנה',
          'שם לקוח',
          'שם מוצר',
          'כמות',
          'מחיר ליחידה',
          'סה"כ למוצר',
          'סטטוס',
          'מטבע'
        ]
      });

      // Add worksheet to workbook
      utils.book_append_sheet(wb, ws, 'מכירות');

      // Save file
      const fileName = `דוח_מכירות_${format(new Date(startDate), 'dd-MM-yyyy')}_עד_${format(new Date(endDate), 'dd-MM-yyyy')}.xlsx`;
      writeFile(wb, fileName);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('אירעה שגיאה בהורדת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-start">
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">מוצרים</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-green-500 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">מכירות</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalSales}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">לקוחות</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-yellow-500 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">הכנסות החודש</p>
              <p className="text-2xl font-semibold text-gray-900">₪{stats.monthlyRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-red-500 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">הצעות מחיר</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.quotesCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">מכירות חודשיות</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `₪${value.toFixed(2)}`}
                  labelFormatter={(label) => `חודש: ${label}`}
                />
                <Bar dataKey="sales" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">מוצרים מובילים</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topProducts}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {topProducts.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `₪${value.toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2`} style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm text-gray-600">{product.name}</span>
                </div>
                <div className="text-sm font-medium">
                  {product.quantity} יחידות • ₪{product.revenue.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">הורדת דוח מכירות</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מתאריך</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">עד תאריך</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={downloadExcel}
            disabled={loading || !startDate || !endDate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Download className="w-5 h-5" />
            {loading ? 'מוריד...' : 'הורד דוח אקסל'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <MonthlySalesTarget />
      </div>

      <div className="mt-6">
        <StaffStats />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesDistributionChart />
        <div className="lg:col-span-2">
          <ProductsByStaffTable />
        </div>
      </div>
    </div>
  );
}