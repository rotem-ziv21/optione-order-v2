import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
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
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש מוצרים..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowAddProduct(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>הוספת מוצר</span>
        </button>
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
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                שם המוצר
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מק"ט
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מחיר
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                מלאי
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  {searchTerm ? 'לא נמצאו מוצרים התואמים לחיפוש' : 'אין מוצרים להצגה'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-500">{product.sku}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {currencySymbols[product.currency]}{product.price}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">{product.stock}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <button 
                      onClick={() => setEditingProduct(product)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Inventory;