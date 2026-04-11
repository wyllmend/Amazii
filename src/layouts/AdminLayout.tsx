import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, Settings, LogOut,
  Menu, X, Tag, Users, MessageCircle, BarChart3, Kanban, History, Truck
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { supabaseService } from '@/services/supabaseService';
import { toast, Toaster } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useTenantStore } from '@/store/tenantStore';
import { useParams } from 'react-router-dom';

export default function AdminLayout() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { restaurantId, setTenant, clearTenant } = useTenantStore();
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState(false);

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

  // Tenant Resolution
  useEffect(() => {
    async function resolveTenant() {
      if (!tenantSlug) {
        clearTenant();
        setTenantLoading(false);
        setTenantError(true);
        return;
      }
      try {
        const rest = await supabaseService.getRestaurantBySlug(tenantSlug);
        if (rest && rest.active) {
          setTenant(rest.id, tenantSlug);
          setTenantError(false);
        } else {
          clearTenant();
          setTenantError(true);
        }
      } catch (err) {
        clearTenant();
        setTenantError(true);
      } finally {
        setTenantLoading(false);
      }
    }
    resolveTenant();
  }, [tenantSlug, setTenant, clearTenant]);

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
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
          console.log('Audio system unlocked');
        }).catch(e => console.log('Audio unlock failed or already unlocked:', e));
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('admin-unlock-audio', unlockAudio);
    };

    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('admin-unlock-audio', unlockAudio);

    if (!restaurantId) return;

    const subscription = supabaseService.subscribeToOrders(restaurantId, (order, event) => {
      if (event === 'INSERT') {
        console.log('Novo pedido recebido:', order.id);
        const isEnabled = localStorage.getItem('admin_notifications_enabled') !== 'false';

        if (isEnabled) {
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                console.log('Audio play blocked algorithmically by browser:', e);
              });
            }
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
                navigate(`/admin/${tenantSlug}/pedidos`);
              };
            } catch (e) {
              console.error('Browser notification error:', e);
            }
          }
        }

        // Show the toast
        toast.success('Novo Pedido Recebido! 🔔', {
          description: `Pedido #${order.id.slice(0, 8)} de ${order.customerName}`,
          duration: 15000,
          action: {
            label: 'Ver Pedido',
            onClick: () => navigate(`/admin/${tenantSlug}/pedidos`)
          },
        });
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      window.removeEventListener('admin-notifications-toggle', handleToggle);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [navigate, notificationsEnabled, restaurantId, tenantSlug]);

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amazii-primary rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (tenantError || !restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Painel não encontrado</h1>
          <p className="text-gray-500">O painel administrativo deste restaurante não está disponível.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/admin/${tenantSlug}/login`} replace />;
  }

  const handleLogout = () => {
    supabaseService.logoutAdmin();
    navigate(`/admin/${tenantSlug}/login`);
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: `/admin/${tenantSlug}/dashboard` },
    { icon: Package, label: 'Produtos', path: `/admin/${tenantSlug}/produtos` },
    { icon: Tag, label: 'Categorias', path: `/admin/${tenantSlug}/categorias` },
    { icon: ShoppingBag, label: 'Pedidos', path: `/admin/${tenantSlug}/pedidos` },
    { icon: History, label: 'Histórico', path: `/admin/${tenantSlug}/historico-pedidos` },
    { icon: BarChart3, label: 'Relatórios', path: `/admin/${tenantSlug}/relatorios` },
    { icon: Tag, label: 'Cupons', path: `/admin/${tenantSlug}/cupons` },
    { icon: Users, label: 'Leads / CRM', path: `/admin/${tenantSlug}/leads` },
    { icon: MessageCircle, label: 'WhatsApp', path: `/admin/${tenantSlug}/whatsapp` },
    { icon: MessageCircle, label: 'Mensagens WA', path: `/admin/${tenantSlug}/mensagens-whatsapp` },
    { icon: Truck, label: 'Entregador Fixo', path: `/admin/${tenantSlug}/entregador-fixo` },
    { icon: Settings, label: 'Configurações', path: `/admin/${tenantSlug}/configuracoes` },
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

