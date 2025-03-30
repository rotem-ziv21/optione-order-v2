import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getSalesByStaff } from '../api/dashboardApi';
import { CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

export default function SalesDistributionChart() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchSalesData();
    }
  }, [currentBusinessId, dateRange]);

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

  const fetchSalesData = async () => {
    if (!currentBusinessId) return;
    
    try {
      setLoading(true);
      
      const data = await getSalesByStaff(
        currentBusinessId,
        dateRange.start,
        dateRange.end
      );
      
      // רק אנשי צוות עם מכירות
      const filteredData = data.filter(item => item.total_sales > 0);
      
      setSalesData(filteredData.map(item => ({
        name: item.staff_name,
        value: item.total_sales,
        percentage: item.percentage
      })));
    } catch (error) {
      console.error('Error fetching sales distribution:', error);
      setError('שגיאה בטעינת נתוני מכירות');
    } finally {
      setLoading(false);
    }
  };

  const setCurrentMonth = () => {
    setDateRange({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    });
    setShowDatePicker(false);
  };

  const setPreviousMonth = () => {
    const prevMonth = subMonths(new Date(), 1);
    setDateRange({
      start: startOfMonth(prevMonth),
      end: endOfMonth(prevMonth)
    });
    setShowDatePicker(false);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-md rounded-md border border-gray-200">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm">סכום: ₪{payload[0].value.toFixed(2)}</p>
          <p className="text-sm">אחוז: {payload[0].payload.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">התפלגות מכירות לפי נציג</h2>
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-gray-400">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">התפלגות מכירות לפי נציג</h2>
        <div className="text-red-500 p-4 text-center">{error}</div>
      </div>
    );
  }

  if (salesData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">התפלגות מכירות לפי נציג</h2>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md"
            >
              <CalendarIcon className="w-4 h-4 ml-1" />
              {format(dateRange.start, 'MMMM yyyy', { locale: he })}
            </button>
            
            {showDatePicker && (
              <div className="absolute top-full mt-1 bg-white shadow-lg rounded-md p-2 z-10 border border-gray-200">
                <button
                  onClick={setCurrentMonth}
                  className="block w-full text-right px-3 py-1 hover:bg-gray-100 rounded-md mb-1"
                >
                  {format(new Date(), 'MMMM yyyy', { locale: he })}
                </button>
                <button
                  onClick={setPreviousMonth}
                  className="block w-full text-right px-3 py-1 hover:bg-gray-100 rounded-md"
                >
                  {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: he })}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="text-gray-500 p-4 text-center">אין נתונים להצגה</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">התפלגות מכירות לפי נציג</h2>
      
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md"
          >
            <CalendarIcon className="w-4 h-4 ml-1" />
            {format(dateRange.start, 'MMMM yyyy', { locale: he })}
          </button>
          
          {showDatePicker && (
            <div className="absolute top-full mt-1 bg-white shadow-lg rounded-md p-2 z-10 border border-gray-200">
              <button
                onClick={setCurrentMonth}
                className="block w-full text-right px-3 py-1 hover:bg-gray-100 rounded-md mb-1"
              >
                {format(new Date(), 'MMMM yyyy', { locale: he })}
              </button>
              <button
                onClick={setPreviousMonth}
                className="block w-full text-right px-3 py-1 hover:bg-gray-100 rounded-md"
              >
                {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: he })}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={salesData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percentage }) => `${name}: ${percentage}%`}
            >
              {salesData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend layout="vertical" verticalAlign="middle" align="right" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
