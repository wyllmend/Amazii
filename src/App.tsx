import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useTenantStore } from '@/store/tenantStore';
import { useEffect } from 'react';

// Layouts
import PublicLayout from '@/layouts/PublicLayout';
import AdminLayout from '@/layouts/AdminLayout';
import SuperAdminLayout from '@/layouts/SuperAdminLayout';

// Public Pages
import HomePage from '@/pages/public/HomePage';
import ProductPage from '@/pages/public/ProductPage';
import CartPage from '@/pages/public/CartPage';
import CheckoutPage from '@/pages/public/CheckoutPage';
import OrderPage from '@/pages/public/OrderPage';
import DriverClaimPage from '@/pages/public/DriverClaimPage';

// Admin Pages
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminReports from '@/pages/admin/AdminReports';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminCategories from '@/pages/admin/AdminCategories';
import AdminCoupons from '@/pages/admin/AdminCoupons';
import AdminLeads from '@/pages/admin/AdminLeads';
import AdminWhatsApp from '@/pages/admin/AdminWhatsApp';
import AdminOrdersHistory from '@/pages/admin/AdminOrdersHistory';
import AdminWhatsAppMessages from '@/pages/admin/AdminWhatsAppMessages';
import AdminDeliveryDriver from '@/pages/admin/AdminDeliveryDriver';

// Super Admin Pages
import SuperAdminLogin from '@/pages/superadmin/SuperAdminLogin';
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminRestaurants from '@/pages/superadmin/SuperAdminRestaurants';
import SuperAdminConfig from '@/pages/superadmin/SuperAdminConfig';

function AdminRootRedirect() {
  const navigate = useNavigate();
  const slug = useTenantStore((s) => s.slug);
  
  useEffect(() => {
    if (slug) {
      navigate(`/admin/${slug}/dashboard`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, slug]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/:tenantSlug?" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="produto/:id" element={<ProductPage />} />
          <Route path="carrinho" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="pedido/:id" element={<OrderPage />} />
          {/* Driver claim — nested so tenantSlug is resolved, but rendered without PublicLayout chrome */}
          <Route path="aceitar/:orderId" element={<DriverClaimPage />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRootRedirect />} />
        <Route path="/admin/:tenantSlug/login" element={<AdminLoginPage />} />
        <Route path="/admin/:tenantSlug" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="produtos" element={<AdminProducts />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="historico-pedidos" element={<AdminOrdersHistory />} />
          <Route path="relatorios" element={<AdminReports />} />
          <Route path="cupons" element={<AdminCoupons />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          <Route path="mensagens-whatsapp" element={<AdminWhatsAppMessages />} />
          <Route path="entregador-fixo" element={<AdminDeliveryDriver />} />
          <Route path="configuracoes" element={<AdminSettings />} />
        </Route>

        {/* Super Admin Routes */}
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="restaurantes" element={<SuperAdminRestaurants />} />
          <Route path="configuracoes" element={<SuperAdminConfig />} />
        </Route>

        {/* 404 — Catch-all */}
        <Route path="*" element={
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">🔍</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
            <p className="text-gray-500 mb-6 max-w-sm">O endereço que você tentou acessar não existe.</p>
            <a href="/" className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors">Voltar ao início</a>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
