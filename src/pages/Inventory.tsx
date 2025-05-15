import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, Filter, ArrowUpDown, RefreshCw, Download, X } from 'lucide-react';
import ProductForm from '../components/ProductForm';
import { supabase } from '../lib/supabase';

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
  GBP: '£'
};

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  sku: string;
  business_id: string;
  created_at: string;
  updated_at: string;
}

function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter products based on search term
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchProducts = async () => {
    try {
      // Get the current user's business_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: userBusiness, error: businessError } = await supabase
        .from('business_staff')
        .select('business_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (businessError) throw businessError;
      if (!userBusiness) throw new Error('No active business found for user');

      setCurrentBusinessId(userBusiness.business_id);

      // Fetch products for the current business
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', userBusiness.business_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error details:', error);
        throw error;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (data: Omit<Product, 'id'>) => {
    try {
      // Add the product with the business_id
      const { error } = await supabase
        .from('products')
        .insert([{
          ...data,
          business_id: currentBusinessId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error details:', error);
        throw error;
      }

      setShowAddProduct(false);
      fetchProducts(); // Refresh the products list
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleEditProduct = async (data: Omit<Product, 'id'>) => {
    try {
      if (!editingProduct) return;

      const { error } = await supabase
        .from('products')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id);

      if (error) {
        console.error('Error details:', error);
        throw error;
      }

      setEditingProduct(null);
      fetchProducts(); // Refresh the products list
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="text-gray-600 font-medium">טוען מוצרים...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 border border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">סה"כ מוצרים</p>
              <h3 className="text-2xl font-bold text-gray-800">{products.length}</h3>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <span className="text-green-500 font-medium">+{Math.floor(products.length * 0.1)}</span> מהחודש הקודם
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-4 border border-green-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">במלאי</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {products.filter(p => p.stock > 0).length}
              </h3>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <ArrowUpDown className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {((products.filter(p => p.stock > 0).length / products.length) * 100).toFixed(0)}% מהמוצרים זמינים
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-sm p-4 border border-amber-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-1">מלאי נמוך</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {products.filter(p => p.stock > 0 && p.stock < 5).length}
              </h3>
            </div>
            <div className="bg-amber-100 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            דורשים טיפול בהקדם
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-sm p-4 border border-red-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">אזל מהמלאי</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {products.filter(p => p.stock === 0).length}
              </h3>
            </div>
            <div className="bg-red-100 p-2 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {((products.filter(p => p.stock === 0).length / products.length) * 100).toFixed(0)}% מהמוצרים אזלו
          </div>
        </div>
      </div>

      {/* Search and actions bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש מוצרים..."
            className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          <button className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2.5 rounded-lg transition-colors">
            <Filter className="w-5 h-5" />
          </button>
          <button 
            onClick={() => fetchProducts()}
            className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 p-2.5 rounded-lg transition-colors">
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAddProduct(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg flex items-center space-x-2 hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all duration-200 mr-2"
          >
            <Plus className="w-5 h-5" />
            <span>הוספת מוצר</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddProduct && (
        <ProductForm
          onClose={() => setShowAddProduct(false)}
          onSubmit={handleAddProduct}
          mode="create"
          businessId={currentBusinessId || ''}
        />
      )}

      {editingProduct && (
        <ProductForm
          onClose={() => setEditingProduct(null)}
          onSubmit={handleEditProduct}
          initialData={{
            name: editingProduct.name,
            sku: editingProduct.sku,
            price: editingProduct.price,
            currency: editingProduct.currency as any,
            stock: editingProduct.stock,
            business_id: editingProduct.business_id
          }}
          mode="edit"
          businessId={currentBusinessId || ''}
        />
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center justify-end">
                  <span className="ml-1">שם המוצר</span>
                  <Package className="w-4 h-4 text-gray-400" />
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מק"ט
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מחיר
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מלאי
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-3 rounded-full">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {searchTerm ? 'לא נמצאו מוצרים התואמים לחיפוש' : 'אין מוצרים להצגה'}
                      </p>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          נקה חיפוש
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                    <td className="px-6 py-4 text-right">
                      <div className="font-medium text-gray-900">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md inline-block">{product.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {currencySymbols[product.currency]}{product.price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-sm font-medium px-2.5 py-1 rounded-full inline-flex items-center justify-center ${product.stock === 0 ? 'bg-red-100 text-red-800' : product.stock < 5 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {product.stock}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => setEditingProduct(product)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 p-2 rounded-lg hover:bg-blue-200 transition-colors mr-2"
                          title="עריכה"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900 bg-red-100 p-2 rounded-lg hover:bg-red-200 transition-colors"
                          title="מחיקה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-right">
            <p className="text-sm text-gray-600">
              מציג <span className="font-medium">{filteredProducts.length}</span> מתוך <span className="font-medium">{products.length}</span> מוצרים
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;