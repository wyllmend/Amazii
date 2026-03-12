import { supabaseService } from '@/services/supabaseService';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import AdminKanban from '@/pages/admin/AdminKanban';
import AdminOrdersHistory from '@/pages/admin/AdminOrdersHistory';

// Super Admin Pages
import SuperAdminLogin from '@/pages/superadmin/SuperAdminLogin';
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminRestaurants from '@/pages/superadmin/SuperAdminRestaurants';

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
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/:tenantSlug/login" element={<AdminLoginPage />} />
        <Route path="/admin/:tenantSlug" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="produtos" element={<AdminProducts />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="historico-pedidos" element={<AdminOrdersHistory />} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="relatorios" element={<AdminReports />} />
          <Route path="cupons" element={<AdminCoupons />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          <Route path="configuracoes" element={<AdminSettings />} />
        </Route>

        {/* Super Admin Routes */}
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="restaurantes" element={<SuperAdminRestaurants />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
