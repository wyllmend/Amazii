import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { ShoppingCart, AlertCircle, Clock, Instagram, Facebook, Loader2 } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { supabaseService } from '@/services/supabaseService';
import { Toaster } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useTenantStore } from '@/store/tenantStore';

export default function PublicLayout() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const baseUrl = tenantSlug ? `/${tenantSlug}` : '';
  
  const { restaurantId, setTenant, clearTenant } = useTenantStore();
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantNotFound, setTenantNotFound] = useState(false);

  const { settings } = useSettings();
  const cartItems = useCartStore((state) => state.items);
  const itemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const location = useLocation();
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      if (!tenantSlug) {
        clearTenant();
        setTenantLoading(false);
        return;
      }
      
      try {
        const rest = await supabaseService.getRestaurantBySlug(tenantSlug);
        if (rest && rest.active) {
          setTenant(rest.id, tenantSlug);
          setTenantNotFound(false);
        } else {
          clearTenant();
          setTenantNotFound(true);
        }
      } catch (error) {
        clearTenant();
        setTenantNotFound(true);
      } finally {
        setTenantLoading(false);
      }
    }
    loadTenant();
  }, [tenantSlug, setTenant, clearTenant]);

  useEffect(() => {
    if (!restaurantId) return;
    supabaseService.isStoreOpen(restaurantId).then(setIsStoreOpen).catch(() => {});

    const interval = setInterval(() => {
      supabaseService.isStoreOpen(restaurantId).then(setIsStoreOpen).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  if (tenantNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Restaurante não encontrado</h1>
        <p className="text-gray-500 max-w-sm">
          O link que você tentou acessar não existe ou o restaurante está inativo no momento.
        </p>
      </div>
    );
  }

  const isCart = location.pathname.endsWith('/carrinho');
  const isCheckout = location.pathname.endsWith('/checkout');
  const isProductPage = location.pathname.includes('/produto/');

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Toaster position="top-center" richColors />

      {/* Store Closed Banner */}
      {!isStoreOpen && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2 sticky top-0 z-[60]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Loja fechada. Você pode navegar, mas não conseguirá finalizar pedidos.</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to={baseUrl || '/'} className="flex items-center gap-2">
            {settings?.storeLogo ? (
              <img src={settings.storeLogo} alt={settings.storeName} className="w-9 h-9 object-contain rounded-lg" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amazii-gradient flex items-center justify-center text-white font-bold text-base">
                A
              </div>
            )}
            <span className="font-bold text-base tracking-tight text-amazii-primary">
              {settings?.storeName || 'Amazii'}
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {settings && (
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3 text-amazii-primary" />
                <span>{settings.deliveryTimeMin}-{settings.deliveryTimeMax}m</span>
              </div>
            )}
            <Link to={`${baseUrl}/carrinho`} className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-amazii-green text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white min-w-[18px] min-h-[18px]">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative">
        <Outlet />
      </main>

      {/* Footer */}
      {!isCheckout && (
        <footer className="bg-white border-t border-gray-100 py-6 mb-20 sm:mb-0">
          <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-3">
            {(settings?.socialLinks?.instagram || settings?.socialLinks?.facebook || settings?.socialLinks?.tiktok) && (
              <div className="flex items-center gap-2">
                {settings.socialLinks?.instagram && (
                  <a href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-pink-600 transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {settings.socialLinks?.facebook && (
                  <a href={settings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {settings.socialLinks?.tiktok && (
                  <a href={settings.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-black transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} {settings?.storeName || 'Amazii'}. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      )}

      {/* Mobile bottom cart bar — shown ONLY on mobile and NOT on product/cart/checkout pages */}
      {!isCart && !isCheckout && !isProductPage && itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-t border-gray-100 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] px-4 py-3 safe-bottom sm:hidden transition-all animate-in slide-in-from-bottom duration-300">
          <Link
            to={`${baseUrl}/carrinho`}
            className="flex items-center justify-between bg-amazii-primary text-white rounded-2xl px-5 py-3 shadow-lg shadow-amazii-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">{itemCount}</span>
              <span className="font-semibold text-sm">Ver carrinho</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <ShoppingCart className="w-4.5 h-4.5" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
