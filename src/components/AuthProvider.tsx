import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  businessId: string | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  businessId: null,
  isAdmin: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserBusiness(session.user);
        checkAdminStatus(session.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserBusiness(session.user);
        checkAdminStatus(session.user);
      } else {
        setBusinessId(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserBusiness = async (user: User) => {
    const { data, error } = await supabase
      .from('business_staff')
      .select('business_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching business:', error);
      return;
    }

    setBusinessId(data?.business_id ?? null);
  };

  const checkAdminStatus = async (user: User) => {
    const { data, error } = await supabase
      .from('business_staff')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      return;
    }

    setIsAdmin(data?.role === 'admin');
  };

  return (
    <AuthContext.Provider value={{ user, businessId, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}