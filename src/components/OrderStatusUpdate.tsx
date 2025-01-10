import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: 'pending' | 'completed' | 'cancelled';
  onClose: () => void;
  onUpdate: () => void;
}

export default function OrderStatusUpdate({ orderId, currentStatus, onClose, onUpdate }: OrderStatusUpdateProps) {
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      const { error } = await supabase
        .from('customer_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('שגיאה בעדכון סטטוס ההזמנה');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">עדכון סטטוס הזמנה</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              סטטוס
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="pending">בהמתנה</option>
              <option value="completed">הושלם</option>
              <option value="cancelled">בוטל</option>
            </select>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={updating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              <span>{updating ? 'מעדכן...' : 'עדכן סטטוס'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}