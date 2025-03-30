import { useState, useEffect } from 'react';
import { getMonthlySalesProgress, updateMonthlySalesTarget } from '../api/dashboardApi';
import { Edit2, Save, Target, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export default function MonthlySalesTarget() {
  const [salesProgress, setSalesProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchSalesProgress();
      setHasAccess(true); // כל משתמש בעסק יכול לערוך את היעד החודשי
    }
  }, [currentBusinessId]);

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

  const fetchSalesProgress = async () => {
    if (!currentBusinessId) return;
    
    try {
      setLoading(true);
      
      const data = await getMonthlySalesProgress(currentBusinessId);
      
      if (data) {
        setSalesProgress(data);
        setTargetAmount(data.target_amount);
      }
    } catch (error) {
      console.error('Error fetching sales progress:', error);
      setError('שגיאה בטעינת נתוני התקדמות מכירות');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTarget = async () => {
    if (!currentBusinessId) return;
    
    try {
      setLoading(true);
      
      const success = await updateMonthlySalesTarget(currentBusinessId, targetAmount);
      
      if (success) {
        await fetchSalesProgress();
        setIsEditing(false);
      } else {
        setError('שגיאה בעדכון יעד המכירות');
      }
    } catch (error) {
      console.error('Error updating sales target:', error);
      setError('שגיאה בעדכון יעד המכירות');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">יעד מכירות חודשי</h2>
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-gray-400">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">יעד מכירות חודשי</h2>
        <div className="text-red-500 p-4 text-center">{error}</div>
      </div>
    );
  }

  if (!salesProgress) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">יעד מכירות חודשי</h2>
        <div className="text-gray-500 p-4 text-center">אין נתונים להצגה</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">יעד מכירות חודשי</h2>
        
        {hasAccess && (
          isEditing ? (
            <button
              onClick={handleSaveTarget}
              className="flex items-center text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
            >
              <Save className="w-4 h-4 ml-1" />
              שמור
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md"
            >
              <Edit2 className="w-4 h-4 ml-1" />
              ערוך יעד
            </button>
          )
        )}
      </div>
      
      <div className="flex items-center mb-4 text-gray-500 text-sm">
        <Calendar className="w-4 h-4 ml-1" />
        <span>
          {salesProgress.current_month}
        </span>
      </div>
      
      {salesProgress.target_amount === 0 && !isEditing && (
        <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm">
          <p className="text-blue-700">
            <AlertCircle className="inline-block w-4 h-4 mr-1" />
            טרם הוגדר יעד מכירות חודשי. לחץ על "ערוך יעד" כדי להגדיר יעד חדש.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Target Amount */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">יעד חודשי</p>
            </div>
          </div>
          
          {isEditing ? (
            <div className="flex items-center">
              <span className="text-blue-600 ml-1">₪</span>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-blue-600"
                placeholder="הזן יעד חודשי..."
                min="0"
                step="100"
              />
            </div>
          ) : (
            <p className="text-lg font-semibold text-blue-600">
              ₪{salesProgress.target_amount.toLocaleString()}
            </p>
          )}
        </div>
        
        {/* Current Amount */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-green-100 p-2 rounded-full">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">מכירות עד כה</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-green-600">
            ₪{salesProgress.current_amount.toLocaleString()}
          </p>
        </div>
        
        {/* Remaining Amount */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-yellow-100 p-2 rounded-full">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-yellow-600 font-medium">נותר להשלים</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-yellow-600">
            ₪{salesProgress.remaining_amount.toLocaleString()}
          </p>
        </div>
        
        {/* Daily Target */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-full">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-purple-600 font-medium">יעד יומי ({salesProgress.days_remaining} ימים)</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-purple-600">
            ₪{salesProgress.daily_target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>התקדמות: {salesProgress.percentage}%</span>
          <span>{format(new Date(), 'd MMMM', { locale: he })}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${Math.min(salesProgress.percentage, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
