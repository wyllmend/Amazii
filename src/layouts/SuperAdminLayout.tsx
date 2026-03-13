import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Shield, Store, Settings, Sun, Moon } from 'lucide-react';
import { superAdminService } from '@/services/superAdminService';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('elevare_theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    localStorage.setItem('elevare_theme', dark ? 'dark' : 'light');
  }, [dark]);

  if (!superAdminService.isAuthenticated()) {
    return <Navigate to="/superadmin/login" replace />;
  }

  const handleLogout = () => {
    superAdminService.logout();
    navigate('/superadmin/login');
  };

  const navLinks = [
    { to: '/superadmin/dashboard', icon: LayoutDashboard, label: 'Dashboard Global' },
    { to: '/superadmin/restaurantes', icon: Store, label: 'Restaurantes' },
    { to: '/superadmin/configuracoes', icon: Settings, label: 'Configurações' },
  ];

  const bg = dark
    ? 'bg-gray-950 text-white'
    : 'bg-gray-100 text-gray-900';
  const sidebarBg = dark
    ? 'bg-gray-900 border-white/5'
    : 'bg-white border-gray-200';
  const headerBg = dark
    ? 'bg-gray-900 border-white/5'
    : 'bg-white border-gray-200';
  const activeLink = dark
    ? 'bg-orange-500/20 text-orange-300'
    : 'bg-orange-50 text-orange-600';
  const inactiveLink = dark
    ? 'text-gray-400 hover:bg-white/5 hover:text-white'
    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900';

  return (
    <div className={`min-h-screen flex ${bg} transition-colors duration-300`}>
      <Toaster position="top-right" richColors closeButton />

      {/* Sidebar */}
      <aside className={`w-64 ${sidebarBg} border-r flex flex-col transition-colors duration-300`}>
        {/* Brand */}
        <div className={`h-16 flex items-center px-6 border-b ${dark ? 'border-white/5' : 'border-gray-200'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold mr-3 shadow-lg shadow-orange-500/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className={`font-bold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>Elevare Menu</span>
            <p className="text-orange-500 text-xs font-medium tracking-widest uppercase">Super Admin</p>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === to ? activeLink : inactiveLink
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className={`p-4 border-t ${dark ? 'border-white/5' : 'border-gray-200'} space-y-1`}>
          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium transition-colors ${
              dark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {dark ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`h-16 ${headerBg} border-b flex items-center justify-between px-6 transition-colors duration-300`}>
          <h2 className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>Painel Administrativo Global</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Sistema Online</span>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto p-6 ${dark ? 'bg-gray-950' : 'bg-gray-50'} transition-colors duration-300`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
