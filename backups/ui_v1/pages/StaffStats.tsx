import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Award, TrendingUp, Send, CheckCircle } from 'lucide-react';

interface StaffStats {
  user_id: string;
  email: string;
  total_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  total_amount: number;
}

export default function StaffStats() {
  const [stats, setStats] = useState<StaffStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentBusiness();
  }, []);

  useEffect(() => {
    if (currentBusinessId) {
      fetchStaffStats();
    }
  }, [currentBusinessId]);

  const getCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('משתמש לא מחובר');
        return;
      }

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
      setError('שגיאה בטעינת העסק');
    }
  };

  const fetchStaffStats = async () => {
    if (!currentBusinessId) return;

    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          created_by,
          auth.users!created_by (email),
          status,
          total_amount
        `)
        .eq('business_id', currentBusinessId);

      if (error) throw error;

      // עיבוד הנתונים לסטטיסטיקות לפי נציג
      const statsMap = new Map<string, StaffStats>();

      data.forEach(quote => {
        const userId = quote.created_by;
        const email = quote.users?.email || 'לא ידוע';
        
        if (!statsMap.has(userId)) {
          statsMap.set(userId, {
            user_id: userId,
            email: email,
            total_quotes: 0,
            sent_quotes: 0,
            accepted_quotes: 0,
            total_amount: 0
          });
        }

        const stats = statsMap.get(userId)!;
        stats.total_quotes++;
        if (quote.status === 'sent') stats.sent_quotes++;
        if (quote.status === 'accepted') {
          stats.accepted_quotes++;
          stats.total_amount += Number(quote.total_amount || 0);
        }
      });

      // מיון לפי מספר הצעות שהתקבלו
      const sortedStats = Array.from(statsMap.values())
        .sort((a, b) => b.accepted_quotes - a.accepted_quotes);

      setStats(sortedStats);
    } catch (error) {
      console.error('Error fetching staff stats:', error);
      setError('שגיאה בטעינת הסטטיסטיקות');
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">סטטיסטיקות נציגים</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.user_id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-medium text-gray-900">{stat.email}</div>
              <Award className={`w-6 h-6 ${
                stats[0]?.user_id === stat.user_id ? 'text-yellow-500' : 'text-gray-400'
              }`} />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-gray-500">סה"כ הצעות</div>
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
                  <span className="text-lg font-medium">{stat.total_quotes}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-gray-500">הצעות שנשלחו</div>
                <div className="flex items-center">
                  <Send className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-lg font-medium">{stat.sent_quotes}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-gray-500">הצעות שהתקבלו</div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-purple-500 mr-2" />
                  <span className="text-lg font-medium">{stat.accepted_quotes}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-gray-500">סה"כ מכירות</div>
                  <div className="text-lg font-medium text-green-600">
                    ₪{stat.total_amount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
