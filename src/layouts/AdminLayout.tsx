import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingBag, Settings, LogOut, 
  Menu, X, Tag, Users, MessageCircle, BarChart3
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { supabaseService } from '@/services/supabaseService';
import { toast, Toaster } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

export default function AdminLayout() {
  const { settings } = useSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => 
    localStorage.getItem('admin_notifications_enabled') !== 'false'
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = supabaseService.isAuthenticated();

  // Mobile check
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-time Order Notifications & Audio Unlock
  useEffect(() => {
    // Request notification permission if enabled
    if (notificationsEnabled && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Sync notification state between components
    const handleToggle = (e: any) => {
      const enabled = e.detail;
      setNotificationsEnabled(enabled);
      if (enabled && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    };
    window.addEventListener('admin-notifications-toggle', handleToggle);

    // Initialize audio
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/notification.mp3');
      audioRef.current.load();
    }

    // Audio Unlock Strategy
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
          console.log('Audio system unlocked');
        }).catch(e => console.log('Audio unlock failed:', e));
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    
    const subscription = supabaseService.subscribeToOrders((order, event) => {
      if (event === 'INSERT') {
        const isEnabled = localStorage.getItem('admin_notifications_enabled') !== 'false';
        if (!isEnabled) return;

        console.log('Novo pedido recebido:', order.id);
        
        // Play notification sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => {
            console.log('Audio play blocked partially, trying again on next interaction');
          });
        }

        // Browser System Notification
        if (Notification.permission === 'granted') {
          try {
            const notification = new Notification('Novo Pedido - Amazii!', {
              body: `Pedido #${order.id.slice(0, 8)} de ${order.customerName}`,
              icon: '/vite.svg', // Fallback to a default icon
              tag: 'new-order'
            });
            notification.onclick = (e) => {
              e.preventDefault();
              window.focus();
              navigate('/admin/pedidos');
            };
          } catch (e) {
            console.error('Browser notification error:', e);
          }
        }
        
        // Show the toast
        toast.success('Novo Pedido Recebido! 🔔', {
          description: `Pedido #${order.id.slice(0, 8)} de ${order.customerName}`,
          duration: 15000,
          action: {
            label: 'Ver Pedido',
            onClick: () => navigate('/admin/pedidos')
          },
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('admin-notifications-toggle', handleToggle);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [navigate, notificationsEnabled]);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    supabaseService.logoutAdmin();
    navigate('/admin/login');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Package, label: 'Produtos', path: '/admin/produtos' },
    { icon: Tag, label: 'Categorias', path: '/admin/categorias' },
    { icon: ShoppingBag, label: 'Pedidos', path: '/admin/pedidos' },
    { icon: BarChart3, label: 'Relatórios', path: '/admin/relatorios' },
    { icon: Tag, label: 'Cupons', path: '/admin/cupons' },
    { icon: Users, label: 'Leads / CRM', path: '/admin/leads' },
    { icon: MessageCircle, label: 'WhatsApp', path: '/admin/whatsapp' },
    { icon: Settings, label: 'Configurações', path: '/admin/configuracoes' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-right" richColors closeButton />
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          !isSidebarOpen && "-translate-x-full md:hidden"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-amazii-gradient flex items-center justify-center text-white font-bold text-lg mr-3">
            A
          </div>
          <span className="font-bold text-xl text-amazii-primary truncate max-w-[150px]">
            {settings?.storeName ? `Admin - ${settings.storeName}` : 'Admin'}
          </span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.path
                  ? "bg-purple-50 text-amazii-primary"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 md:hidden"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Admin User</span>
            <div className="w-8 h-8 rounded-full bg-amazii-gradient flex items-center justify-center text-white text-xs font-bold">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

