import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, TrendingUp, Users, DollarSign, FileText, Download, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import DateRangeFilter from '../components/DateRangeFilter';
import StaffStats from '../components/StaffStats';
import SalesDistributionChart from '../components/SalesDistributionChart';
import ProductsByStaffTable from '../components/ProductsByStaffTable';
import MonthlySalesTarget from '../components/MonthlySalesTarget';
import { utils, writeFile } from 'xlsx';

// הערה: אם תרצה לחזור לגרסה הקודמת, הרץ: git checkout HEAD~1 -- src/pages/Dashboard.tsx
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
      // Format dates correctly for SQL query
      const startDate = new Date(start);
      const endDate = new Date(end);
      // Add one day to end date to include the entire day
      endDate.setDate(endDate.getDate() + 1);
      
      const formattedStartDate = startDate.toISOString();
      const formattedEndDate = endDate.toISOString();
      
      console.log('Fetching sales data with formatted dates:', { 
        start, 
        end, 
        formattedStartDate, 
        formattedEndDate, 
        currentBusinessId 
      });
      
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          id,
          created_at,
          total_amount,
          currency,
          status,
          customer_id,
          business_id
        `)
        .eq('business_id', currentBusinessId)
        .gte('created_at', formattedStartDate)
        .lt('created_at', formattedEndDate)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      console.log('Orders found:', orders?.length || 0, orders);

      if (!orders || orders.length === 0) {
        console.log('No orders found for the selected date range');
        return [];
      }

      // Fetch customers separately
      let customers: Array<{id: string, name: string}> = [];
      try {
        // Filter out invalid customer IDs (must be valid UUIDs for Postgres)
        const validCustomerIds = orders
          .map(order => order.customer_id)
          .filter(id => id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        
        if (validCustomerIds.length > 0) {
          const { data, error } = await supabase
            .from('customers')
            .select('id, name')
            .eq('business_id', currentBusinessId)
            .in('id', validCustomerIds);
            
          if (error) {
            console.error('Error fetching customers:', error);
          } else {
            customers = data || [];
          }
        } else {
          console.log('No valid UUID customer IDs found in orders');
        }
      } catch (customerError) {
        console.error('Error in customer fetch process:', customerError);
      }
      
      console.log('Customers found:', customers.length, customers);

      // Fetch business information
      let businessInfo = null;
      try {
        // Get business name
        if (currentBusinessId && typeof currentBusinessId === 'string' && 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentBusinessId)) {
          
          const { data, error } = await supabase
            .from('businesses')
            .select('name')
            .eq('id', currentBusinessId)
            .single();
            
          if (error) {
            console.error('Error fetching business info:', error);
          } else {
            businessInfo = data;
          }
        }
      } catch (businessError) {
        console.error('Error in business info fetch process:', businessError);
      }
      
      const businessName = businessInfo?.name || 'העסק שלי';      
      console.log('Business info:', businessInfo);
      
      // Create map for quick lookup
      const customerMap = new Map();
      (customers || []).forEach(customer => {
        customerMap.set(customer.id, customer.name);
      });

      // Fetch order items
      let orderItems: Array<any> = [];
      try {
        // Make sure we have valid UUIDs for order IDs
        const validOrderIds = orders
          .map(order => order.id)
          .filter(id => id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        
        if (validOrderIds.length > 0) {
          const { data, error } = await supabase
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
            .in('order_id', validOrderIds);

          if (error) {
            console.error('Error fetching order items:', error);
          } else {
            orderItems = data || [];
          }
        } else {
          console.log('No valid UUID order IDs found');
        }
      } catch (itemsError) {
        console.error('Error in order items fetch process:', itemsError);
      }
      console.log('Order items found:', orderItems.length, orderItems);

      // Combine the data
      const salesData = orders.map(order => ({
        id: order.id,
        created_at: order.created_at,
        total_amount: order.total_amount,
        currency: order.currency,
        status: order.status,
        customer_name: customerMap.get(order.customer_id) || 'לא ידוע',
        business_name: businessName,
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
        setLoading(false);
        return;
      }

      // Prepare data for Excel
      const excelData = [];
      
      // Add header row manually to ensure correct order
      const headers = [
        'תאריך',
        'מספר הזמנה',
        'שם לקוח',
        'שם העסק',
        'שם מוצר',
        'כמות',
        'מחיר ליחידה',
        'סה"כ למוצר',
        'סטטוס',
        'מטבע'
      ];
      
      // Add data rows
      for (const sale of salesData) {
        if (!sale.items || !Array.isArray(sale.items)) continue;
        
        for (const item of sale.items) {
          excelData.push({
            'תאריך': format(new Date(sale.created_at), 'dd/MM/yyyy'),
            'מספר הזמנה': sale.id,
            'שם לקוח': sale.customer_name || 'לא ידוע',
            'שם העסק': sale.business_name || 'העסק שלי',
            'שם מוצר': item.product_name || 'לא ידוע',
            'כמות': item.quantity || 0,
            'מחיר ליחידה': item.price_at_time || 0,
            'סה"כ למוצר': (item.quantity || 0) * (item.price_at_time || 0),
            'סטטוס': sale.status === 'completed' ? 'הושלם' : 
                     sale.status === 'pending' ? 'ממתין' : 'בוטל',
            'מטבע': sale.currency || 'שקל'
          });
        }
      }

      console.log('Excel data prepared:', excelData.length, 'rows');
      
      try {
        // Create workbook
        const wb = utils.book_new();
        const ws = utils.json_to_sheet(excelData, { header: headers });

        // Add worksheet to workbook
        utils.book_append_sheet(wb, ws, 'מכירות');

        // Save file
        const fileName = `דוח_מכירות_${format(new Date(startDate), 'dd-MM-yyyy')}_עד_${format(new Date(endDate), 'dd-MM-yyyy')}.xlsx`;
        writeFile(wb, fileName);
        console.log('Excel file created successfully');
      } catch (excelError) {
        console.error('Error creating Excel file:', excelError);
        alert('אירעה שגיאה ביצירת קובץ האקסל');
      }
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

      {/* Header with Date Filter */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-800">דשבורד</h1>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Stats Cards with Modern Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Products */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
          <div className="absolute top-0 right-0 mt-2 mr-2 bg-white bg-opacity-20 rounded-full p-1">
            <Package className="w-4 h-4" />
          </div>
          <div className="mt-6">
            <p className="text-sm text-blue-100">מוצרים</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold mt-1">{stats.totalProducts}</p>
              <div className="rounded-full bg-white bg-opacity-20 p-2">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
          <div className="absolute top-0 right-0 mt-2 mr-2 bg-white bg-opacity-20 rounded-full p-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="mt-6">
            <p className="text-sm text-green-100">הזמנות</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold mt-1">{stats.totalSales}</p>
              <div className="rounded-full bg-white bg-opacity-20 p-2">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Active Customers */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
          <div className="absolute top-0 right-0 mt-2 mr-2 bg-white bg-opacity-20 rounded-full p-1">
            <Users className="w-4 h-4" />
          </div>
          <div className="mt-6">
            <p className="text-sm text-orange-100">לקוחות פעילים</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold mt-1">{stats.activeCustomers}</p>
              <div className="rounded-full bg-white bg-opacity-20 p-2">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
          <div className="absolute top-0 right-0 mt-2 mr-2 bg-white bg-opacity-20 rounded-full p-1">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="mt-6">
            <p className="text-sm text-purple-100">הכנסה חודשית</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold mt-1">₪{stats.monthlyRevenue.toFixed(0)}</p>
              <div className="rounded-full bg-white bg-opacity-20 p-2">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Quotes Count */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
          <div className="absolute top-0 right-0 mt-2 mr-2 bg-white bg-opacity-20 rounded-full p-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="mt-6">
            <p className="text-sm text-red-100">הצעות מחיר</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold mt-1">{stats.quotesCount}</p>
              <div className="rounded-full bg-white bg-opacity-20 p-2">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 transition-all duration-300 hover:shadow-lg border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">מכירות חודשיות</h3>
            <div className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              <span>סה"כ: ₪{monthlyData.reduce((sum, item) => sum + item.sales, 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={{ stroke: '#e5e7eb' }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={{ stroke: '#e5e7eb' }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `₪${value.toLocaleString()}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`₪${value.toLocaleString()}`, 'מכירות']}
                  labelFormatter={(label) => `חודש: ${label}`}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: 'none' }}
                  itemStyle={{ color: '#3b82f6' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar 
                  dataKey="sales" 
                  fill="url(#colorSales)" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-md p-6 transition-all duration-300 hover:shadow-lg border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">מוצרים מובילים</h3>
            <div className="flex items-center space-x-2 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
              <span>סה"כ: ₪{topProducts.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={`gradient-${index}`} id={`colorGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                      <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={topProducts}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  animationDuration={1500}
                  animationEasing="ease-out"
                  label={({ name, percent }) => `${name.length > 10 ? name.substring(0, 10) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '2 2' }}
                >
                  {topProducts.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#colorGradient-${index % COLORS.length})`} 
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`₪${value.toLocaleString()}`, 'הכנסה']}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-800">{product.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-gray-900">₪{product.revenue.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">{product.quantity} יחידות</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-teal-500"></div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">הורדת דוח מכירות</h2>
          <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            Excel
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">מתאריך</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>
          
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">עד תאריך</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>
          
          <button
            onClick={downloadExcel}
            disabled={loading || !startDate || !endDate}
            className={`flex items-center justify-center gap-3 px-6 py-3 rounded-lg text-white font-medium transition-all duration-300 transform ${loading || !startDate || !endDate ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-teal-500 hover:shadow-md hover:-translate-y-1'}`}
          >
            <Download className={`w-5 h-5 ${loading ? 'animate-bounce' : ''}`} />
            <span>{loading ? 'מוריד...' : 'הורד דוח אקסל'}</span>
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