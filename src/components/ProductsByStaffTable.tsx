import React, { useState, useEffect } from 'react';
import { getProductsByStaff } from '../api/dashboardApi';
import { CalendarIcon, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export default function ProductsByStaffTable() {
  const [productsData, setProductsData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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
      fetchProductsData();
    }
  }, [currentBusinessId, dateRange]);

  useEffect(() => {
    if (productsData.length > 0) {
      filterData();
    }
  }, [searchTerm, productsData]);

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

  const fetchProductsData = async () => {
    if (!currentBusinessId) return;
    
    try {
      setLoading(true);
      
      const data = await getProductsByStaff(
        currentBusinessId,
        dateRange.start,
        dateRange.end
      );
      
      setProductsData(data);
      setFilteredData(data);
    } catch (error) {
      console.error('Error fetching products by staff:', error);
      setError('שגיאה בטעינת נתוני מוצרים');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    if (!searchTerm.trim()) {
      setFilteredData(productsData);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = productsData.filter(
      item => 
        item.product_name.toLowerCase().includes(term) || 
        (item.staff_name && item.staff_name.toLowerCase().includes(term))
    );
    
    setFilteredData(filtered);
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">מוצרים שנמכרו לפי נציג</h2>
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-gray-400">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">מוצרים שנמכרו לפי נציג</h2>
        <div className="text-red-500 p-4 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">מוצרים שנמכרו לפי נציג</h2>
      
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
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
        
        <div className="relative">
          <div className="flex items-center border rounded-md overflow-hidden">
            <div className="px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="חיפוש לפי מוצר או נציג..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-1 outline-none text-sm"
            />
          </div>
        </div>
      </div>
      
      {filteredData.length === 0 ? (
        <div className="text-gray-500 p-4 text-center">אין נתונים להצגה</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מוצר
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  נציג
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  כמות
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סה"כ מכירות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item, index) => (
                <tr key={`${item.product_id}-${item.staff_id || 'unknown'}-${index}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.product_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.staff_name || 'לא משויך'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₪{item.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
