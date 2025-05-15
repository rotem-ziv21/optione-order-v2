import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getSalesByStaff } from '../api/dashboardApi';
import { CalendarIcon, Award } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

// צבעים מודרניים יותר
const COLORS = ['#4158D0', '#0093E9', '#8EC5FC', '#FBAB7E', '#85FFBD', '#FF9A8B', '#74EBD5', '#FAD961'];

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [topSalesPerson, setTopSalesPerson] = useState<{name: string, value: number} | null>(null);

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
      
      // מציאת נציג המכירות המוביל
      if (filteredData.length > 0) {
        const sortedData = [...filteredData].sort((a, b) => b.total_sales - a.total_sales);
        setTopSalesPerson({
          name: sortedData[0].staff_name,
          value: sortedData[0].total_sales
        });
      } else {
        setTopSalesPerson(null);
      }
      
      const formattedData = filteredData.map(item => ({
        name: item.staff_name,
        value: item.total_sales,
        percentage: item.percentage
      }));
      
      setSalesData(formattedData);
    } catch (error) {
      console.error('Error fetching sales distribution:', error);
      setError('שגיאה בטעינת נתוני מכירות');
      setTopSalesPerson(null);
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
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-blue-500" />
          התפלגות מכירות לפי נציג
        </h2>
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 animate-pulse mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-blue-500" />
          התפלגות מכירות לפי נציג
        </h2>
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-center">
          {error}
        </div>
      </div>
    );
  }

  if (salesData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-blue-500" />
          התפלגות מכירות לפי נציג
        </h2>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200"
            >
              <CalendarIcon className="w-4 h-4 ml-2 text-blue-500" />
              {format(dateRange.start, 'MMMM yyyy', { locale: he })}
            </button>
            
            {showDatePicker && (
              <div className="absolute top-full mt-1 bg-white shadow-lg rounded-md p-2 z-10 border border-gray-200">
                <button
                  onClick={setCurrentMonth}
                  className="block w-full text-right px-3 py-2 hover:bg-blue-50 rounded-md mb-1 transition-colors duration-200"
                >
                  {format(new Date(), 'MMMM yyyy', { locale: he })}
                </button>
                <button
                  onClick={setPreviousMonth}
                  className="block w-full text-right px-3 py-2 hover:bg-blue-50 rounded-md transition-colors duration-200"
                >
                  {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: he })}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-50 p-8 rounded-lg text-gray-500 text-center border border-gray-100">
          אין נתונים להצגה בתקופה זו
        </div>
      </div>
    );
  }

  // פונקציה לטיפול בלחיצה על חלק בגרף
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <Award className="w-5 h-5 mr-2 text-blue-500" />
        התפלגות מכירות לפי נציג
      </h2>
      
      <div className="flex justify-between items-center mb-6">
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200"
          >
            <CalendarIcon className="w-4 h-4 ml-2 text-blue-500" />
            {format(dateRange.start, 'MMMM yyyy', { locale: he })}
          </button>
          
          {showDatePicker && (
            <div className="absolute top-full mt-1 bg-white shadow-lg rounded-md p-2 z-10 border border-gray-200">
              <button
                onClick={setCurrentMonth}
                className="block w-full text-right px-3 py-2 hover:bg-blue-50 rounded-md mb-1 transition-colors duration-200"
              >
                {format(new Date(), 'MMMM yyyy', { locale: he })}
              </button>
              <button
                onClick={setPreviousMonth}
                className="block w-full text-right px-3 py-2 hover:bg-blue-50 rounded-md transition-colors duration-200"
              >
                {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: he })}
              </button>
            </div>
          )}
        </div>

        {topSalesPerson && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-500 font-medium mb-1">נציג מוביל החודש</div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-2">
                {topSalesPerson.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium">{topSalesPerson.name}</div>
                <div className="text-sm text-gray-600">₪{topSalesPerson.value.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={salesData}
              cx="50%"
              cy="50%"
              labelLine={false}
              innerRadius={40}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              onMouseEnter={onPieEnter}
            >
              {salesData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  stroke="#fff"
                  strokeWidth={index === activeIndex ? 2 : 1}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="vertical" 
              verticalAlign="middle" 
              align="right"
              wrapperStyle={{ fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
