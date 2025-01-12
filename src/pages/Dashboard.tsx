import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import DateRangeFilter from '../components/DateRangeFilter';
import StaffStats from '../components/StaffStats';

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

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      // Fetch basic stats
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id');
      
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id');
      
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id');

      if (productsError || customersError || quotesError) {
        throw new Error('Error fetching basic stats');
      }

      // Fetch completed orders for total sales and monthly revenue
      let query = supabase
        .from('customer_orders')
        .select('total_amount, created_at')
        .eq('status', 'completed');

      if (dateRange?.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) throw ordersError;

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
            created_at
          )
        `)
        .eq('customer_orders.status', 'completed');

      if (dateRange?.from) {
        itemsQuery = itemsQuery.gte('customer_orders.created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        itemsQuery = itemsQuery.lte('customer_orders.created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data: orderItems, error: itemsError } = await itemsQuery;

      if (itemsError) throw itemsError;

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
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
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
                  {topProducts.map((entry, index) => (
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

      {/* Staff Stats */}
      <div className="mt-6">
        <StaffStats />
      </div>
    </div>
  );
}