import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Target,
  Repeat,
  GitCompare,
  UploadCloud,
  Settings,
  Menu,
  X,
  Bell,
  Plus,
  LogOut,
  User,
  ChevronDown,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { authApi } from '@/api/auth';
import NotificationBell from './NotificationBell';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Budgets', href: '/budgets', icon: Target },
  { name: 'Recurring', href: '/recurring', icon: Repeat },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'Import/Export', href: '/import-export', icon: UploadCloud },
  { name: 'Categories', href: '/categories', icon: Settings },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function AppShell() {
  const { user, logout, isAuthenticated } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

  const handleAddTransaction = () => {
    navigate('/transactions?add=true', { state: { openAdd: true } });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo & Mobile Close Button */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#F2A900] via-[#CC6F00] to-[#4D2A00] rounded-xl flex items-center justify-center shadow-sm shadow-[#F2A900]/20">
                <LayoutDashboard className="w-5 h-5 text-[#1a140d]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-[#FFFDF7]">
                Spend<span className="text-amber-500 dark:text-[#F2A900]">Wise</span>
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-[#F9E6A8] hover:bg-gray-100 dark:hover:bg-[#554737]"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin" aria-label="Main navigation">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-[#FFFDF7] dark:border dark:border-[#CC6F00]/60 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-[#decaa0] dark:hover:bg-[#554737] dark:hover:text-[#FFFDF7]'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/50 dark:border dark:border-[#CC6F00]/50 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-amber-600 dark:text-[#F2A900]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-[#FFFDF7] truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#bfa87c] truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#453a2d]/95 backdrop-blur-md border-b border-gray-200 dark:border-[#786144]">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 gap-2">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#F9E6A8] dark:hover:bg-[#554737]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Page title */}
            <h1 className="flex-1 lg:hidden text-lg font-bold text-gray-900 dark:text-[#FFFDF7] truncate mx-1">
              {navigation.find(n => location.pathname === n.href || (n.href !== '/' && location.pathname.startsWith(n.href)))?.name || 'SpendWise'}
            </h1>

            {/* Right side actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Notification bell */}
              <NotificationBell />

              {/* Theme toggle */}
              <button
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#F9E6A8] dark:hover:bg-[#554737] dark:hover:text-[#F2A900] transition-colors"
                aria-label="Toggle theme"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Sun className="w-5 h-5 hidden dark:block text-[#F2A900]" />
                <Moon className="w-5 h-5 dark:hidden" />
              </button>

              {/* Add transaction button */}
              <button
                className="hidden sm:flex btn-primary"
                aria-label="Add transaction"
                onClick={handleAddTransaction}
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
              <button
                className="sm:hidden p-2 rounded-lg bg-gradient-to-r from-[#F2A900] to-[#CC6F00] text-[#1a140d] font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all"
                aria-label="Add transaction"
                onClick={handleAddTransaction}
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#554737] transition-colors"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center border border-amber-300 dark:border-[#CC6F00]/50">
                    <User className="w-4 h-4 text-amber-700 dark:text-[#F2A900]" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-[#FFFDF7]">
                    {user?.name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-[#bfa87c]" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#453a2d] rounded-xl border border-gray-200 dark:border-[#786144] shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <NavLink
                      to="/settings"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-[#F9E6A8] hover:bg-gray-100 dark:hover:bg-[#554737] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#554737] transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content with bottom padding for mobile navbar */}
        <main className="p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8" id="main-content" role="main">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#453a2d]/95 backdrop-blur-md border-t border-gray-200 dark:border-[#786144] px-2 py-1.5 flex items-center justify-around shadow-lg" aria-label="Mobile Navigation">
          {[
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Transactions', href: '/transactions', icon: CreditCard },
            { name: 'Budgets', href: '/budgets', icon: Target },
            { name: 'Recurring', href: '/recurring', icon: Repeat },
            { name: 'Categories', href: '/categories', icon: Settings },
          ].map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-amber-500 font-bold'
                    : 'text-gray-500 hover:text-gray-900 dark:text-[#decaa0] dark:hover:text-[#FFFDF7]'
                }`}
              >
                <item.icon className="w-5 h-5 mb-0.5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}