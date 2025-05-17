import { useState, useEffect } from 'react';
import { getProductsByStaff } from '../api/dashboardApi';
import { CalendarIcon, Search, Package, TrendingUp, User, ShoppingCart } from 'lucide-react';
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
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Package className="w-5 h-5 mr-2 text-indigo-500" />
          מוצרים שנמכרו לפי נציג
        </h2>
        <div className="flex justify-between items-center mb-4 animate-pulse">
          <div className="h-8 w-32 bg-gray-200 rounded-md"></div>
          <div className="h-8 w-48 bg-gray-200 rounded-md"></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  מוצר
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  נציג
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  כמות
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  סה"כ מכירות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Package className="w-5 h-5 mr-2 text-indigo-500" />
          מוצרים שנמכרו לפי נציג
        </h2>
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-center">
          <div className="flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
          <button 
            onClick={fetchProductsData} 
            className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors duration-200"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <Package className="w-5 h-5 mr-2 text-indigo-500" />
        מוצרים שנמכרו לפי נציג
      </h2>
      
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center text-sm bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-md transition-colors duration-200"
          >
            <CalendarIcon className="w-4 h-4 ml-2 text-indigo-500" />
            {format(dateRange.start, 'MMMM yyyy', { locale: he })}
          </button>
          
          {showDatePicker && (
            <div className="absolute top-full mt-1 bg-white shadow-lg rounded-md p-2 z-10 border border-gray-200">
              <button
                onClick={setCurrentMonth}
                className="block w-full text-right px-3 py-2 hover:bg-indigo-50 rounded-md mb-1 transition-colors duration-200"
              >
                {format(new Date(), 'MMMM yyyy', { locale: he })}
              </button>
              <button
                onClick={setPreviousMonth}
                className="block w-full text-right px-3 py-2 hover:bg-indigo-50 rounded-md transition-colors duration-200"
              >
                {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: he })}
              </button>
            </div>
          )}
        </div>
        
        <div className="relative">
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-indigo-200 transition-all duration-200">
            <div className="px-3 py-2 bg-gray-50">
              <Search className="h-4 w-4 text-indigo-400" />
            </div>
            <input
              type="text"
              placeholder="חיפוש לפי מוצר או נציג..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 outline-none text-sm w-64"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="px-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
      
      {filteredData.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-gray-500 text-center border border-gray-100">
          <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p>אין נתונים להצגה בתקופה זו</p>
          {searchTerm && (
            <p className="text-sm mt-2">ניסית לחפש: <span className="font-medium">{searchTerm}</span></p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Package className="w-3 h-3 ml-1 text-indigo-400" />
                    מוצר
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <User className="w-3 h-3 ml-1 text-indigo-400" />
                    נציג
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <ShoppingCart className="w-3 h-3 ml-1 text-indigo-400" />
                    כמות
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <TrendingUp className="w-3 h-3 ml-1 text-indigo-400" />
                    סה"כ מכירות
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item, index) => (
                <tr 
                  key={`${item.product_id}-${item.staff_id || 'unknown'}-${index}`}
                  className="hover:bg-indigo-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.product_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 text-xs font-bold mr-2">
                        {item.staff_name ? item.staff_name.charAt(0) : '?'}
                      </div>
                      <span className="text-sm text-gray-700">{item.staff_name || 'לא משויך'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium bg-indigo-100 text-indigo-800 inline-block px-2 py-1 rounded-full">
                      {item.quantity}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ₪{item.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={2} className="px-6 py-3 text-sm font-medium text-gray-700">
                  סה"כ {filteredData.length} פריטים
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-700">
                  {filteredData.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-700">
                  ₪{filteredData.reduce((sum, item) => sum + item.total_amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
