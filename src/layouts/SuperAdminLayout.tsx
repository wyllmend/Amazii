import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Shield, Store } from 'lucide-react';
import { superAdminService } from '@/services/superAdminService';
import { Toaster } from 'sonner';

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  if (!superAdminService.isAuthenticated()) {
    return <Navigate to="/superadmin/login" replace />;
  }

  const handleLogout = () => {
    superAdminService.logout();
    navigate('/superadmin/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Toaster position="top-right" richColors closeButton />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-white/5 flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold mr-3">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">Amazii</span>
            <p className="text-purple-400 text-xs font-medium tracking-widest uppercase">Super Admin</p>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          <Link
            to="/superadmin/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/superadmin/dashboard'
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard Global
          </Link>
          <Link
            to="/superadmin/restaurantes"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/superadmin/restaurantes'
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Store className="w-5 h-5" />
            Restaurantes
          </Link>
        </nav>

        <div className="p-4 border-t border-white/5">
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
        <header className="h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6">
          <h2 className="text-white font-semibold text-sm">Painel Administrativo Global</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400">Sistema Online</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
