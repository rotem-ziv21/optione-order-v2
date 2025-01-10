import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Users, FileText, Settings, LogOut, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/businesses', icon: Building2, label: 'עסקים' },
  { to: '/inventory', icon: Package, label: 'מלאי' },
  { to: '/customers', icon: Users, label: 'לקוחות' },
  { to: '/quotes', icon: FileText, label: 'הצעות מחיר' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

function Layout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Inventory System</h1>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button 
            onClick={handleSignOut}
            className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 w-full px-4 py-2.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="w-5 h-5" />
            <span>התנתק</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-16 border-b border-gray-200 bg-white flex items-center px-6">
          <h2 className="text-lg font-medium text-gray-800">
            {navItems.find(item => item.to === location.pathname)?.label || 'Dashboard'}
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