import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Users, FileText, Settings, LogOut, Building2, Shield, Workflow, ChevronLeft, Bell, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'דשבורד' },
  { to: '/inventory', icon: Package, label: 'מלאי' },
  { to: '/customers', icon: Users, label: 'לקוחות' },
  { to: '/quotes', icon: FileText, label: 'הצעות מחיר' },
  { to: '/automations', icon: Workflow, label: 'אוטומציות' },
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string, read: boolean}[]>([
    { id: '1', text: 'הזמנה חדשה התקבלה', read: false },
    { id: '2', text: 'המלאי של מוצר X נמוך', read: false },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

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

    // סגירת התפריט הנייד בעת ניווט
    setIsMobileMenuOpen(false);
  }, [user, isAdmin, location]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button - visible only on small screens */}
      <div className="lg:hidden fixed top-0 left-0 z-50 m-4">
        <button
          onClick={toggleMobileMenu}
          className="p-2 rounded-full bg-white shadow-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <nav 
        className={`${isSidebarOpen ? 'w-72' : 'w-20'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        fixed lg:relative inset-y-0 left-0 z-40 bg-gradient-to-b from-indigo-600 to-blue-700 shadow-xl 
        transition-all duration-300 ease-in-out transform flex flex-col`}
      >
        {/* Logo area */}
        <div className={`h-16 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} px-6 border-b border-blue-500/30`}>
          {isSidebarOpen && <h1 className="text-xl font-bold text-white">Optione</h1>}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-blue-200 hover:bg-blue-600 hover:text-white focus:outline-none"
          >
            <ChevronLeft className={`h-5 w-5 transform transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center ${isSidebarOpen ? 'justify-start space-x-3' : 'justify-center'} px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`
              }
              title={!isSidebarOpen ? item.label : undefined}
            >
              <item.icon className={`${isSidebarOpen ? 'h-5 w-5 ml-2' : 'h-6 w-6'}`} />
              {isSidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Logout button */}
        <div className={`p-4 ${isSidebarOpen ? 'border-t border-blue-500/30' : ''}`}>
          <button
            onClick={handleSignOut}
            className={`flex items-center ${isSidebarOpen ? 'justify-start space-x-3' : 'justify-center'} 
            text-blue-100 hover:text-white w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors`}
            title={!isSidebarOpen ? 'התנתק' : undefined}
          >
            <LogOut className={`${isSidebarOpen ? 'h-5 w-5 ml-2' : 'h-6 w-6'}`} />
            {isSidebarOpen && <span>התנתק</span>}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden lg:mr-0 transition-all duration-300 ease-in-out">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10">
          <h2 className="text-lg font-medium text-gray-800 flex items-center">
            {navItems.find(item => item.to === location.pathname)?.icon && (
              <span className="mr-2 text-blue-600">
                {React.createElement(navItems.find(item => item.to === location.pathname)?.icon || LayoutDashboard, { className: 'h-5 w-5' })}
              </span>
            )}
            {navItems.find(item => item.to === location.pathname)?.label || 'דשבורד'}
          </h2>
          
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={toggleNotifications}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              
              {/* Notifications dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-200 text-right">
                  <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <button 
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      סמן הכל כנקרא
                    </button>
                    <h3 className="font-medium text-gray-700">התראות</h3>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${!notification.read ? 'bg-blue-50' : ''}`}
                        >
                          <p className="text-sm text-gray-800">{notification.text}</p>
                          {!notification.read && <span className="block h-2 w-2 rounded-full bg-blue-500 mt-1"></span>}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500">
                        <p>אין התראות חדשות</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User profile */}
            <div className="relative">
              <button className="flex items-center space-x-2 focus:outline-none">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              </button>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;