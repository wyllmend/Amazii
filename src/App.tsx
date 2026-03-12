import { supabaseService } from '@/services/supabaseService';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from '@/layouts/PublicLayout';
import AdminLayout from '@/layouts/AdminLayout';

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/produto/:id" element={<ProductPage />} />
          <Route path="/carrinho" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/pedido/:id" element={<OrderPage />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="produtos" element={<AdminProducts />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="relatorios" element={<AdminReports />} />
          <Route path="cupons" element={<AdminCoupons />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          <Route path="configuracoes" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

