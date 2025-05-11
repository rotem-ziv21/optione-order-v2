import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Users, FileText, Settings, LogOut, Building2, Shield, Workflow, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'דשבורד' },
  { to: '/inventory', icon: Package, label: 'מלאי' },
  { to: '/customers', icon: Users, label: 'לקוחות' },
  { to: '/quotes', icon: FileText, label: 'הצעות מחיר' },
  { to: '/automations', icon: Workflow, label: 'אוטומציות' },
  { to: '/webhook-test', icon: Link, label: 'בדיקת Webhooks' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
  { to: '/staff', icon: Users, label: 'אנשי צוות' },
];

const adminNavItems = [
  { to: '/businesses', icon: Building2, label: 'עסקים' },
  { to: '/admin', icon: Shield, label: 'מנהל' },
];

function Layout() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [navItems, setNavItems] = useState(baseNavItems);
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (isAdmin) {
      setNavItems([...baseNavItems, ...adminNavItems]);
    } else {
      setNavItems(baseNavItems);
    }
  }, [user, isAdmin]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Optione</h1>
        </div>
        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="h-5 w-5 ml-2" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 w-full px-4 py-2.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="h-5 w-5 ml-2" />
            <span>התנתק</span>
          </button>
        </div>
      </nav>
      <main className="flex-1 overflow-auto bg-gray-100">
        <div className="h-16 border-b border-gray-200 bg-white flex items-center px-6">
          <h2 className="text-lg font-medium text-gray-800">
            {navItems.find(item => item.to === location.pathname)?.label || 'דשבורד'}
          </h2>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;