import { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Order, OrderStatus } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { 
  BarChart3, Calendar, Filter, Download, DollarSign, 
  ShoppingBag, TrendingUp, CreditCard, Package, Bike, Store
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useTenantStore } from '@/store/tenantStore';

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  'finalizado': 'Finalizado',
  'cancelado': 'Cancelado',
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function AdminReports() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pix' | 'credit_card' | 'dinheiro'>('all');

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await supabaseService.getOrders(restaurantId);
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Export visible orders to CSV */
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) { toast.info('Nenhum dado para exportar'); return; }
    const headers = ['ID', 'Data', 'Cliente', 'Telefone', 'Status', 'Pagamento', 'Total'];
    const rows = filteredOrders.map(o => [
      '#' + o.id.slice(0, 8),
      new Date(o.createdAt).toLocaleString('pt-BR'),
      o.customerName,
      o.customerPhone,
      o.status,
      o.paymentMethod === 'credit_card' ? 'Cartão' : o.paymentMethod,
      o.total.toFixed(2).replace('.', ','),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio_${dateRange}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  /** Archive all visible finalizado/cancelado orders (>90 days or all) */
  const handleArchive = async () => {
    setArchiving(true);
    try {
      const { superAdminService } = await import('@/services/superAdminService');
      const count = await superAdminService.archiveOldOrders();
      toast.success(count > 0 ? `${count} pedidos arquivados!` : 'Nenhum pedido elegível para arquivamento (>90 dias)');
      fetchData();
    } catch {
      toast.error('Erro ao arquivar');
    } finally {
      setArchiving(false);
    }
  };

  // Filtered Data
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Date Filter
    const now = new Date();
    if (dateRange === 'today') {
      const today = new Date(now.setHours(0, 0, 0, 0));
      filtered = filtered.filter(o => new Date(o.createdAt) >= today);
    } else if (dateRange === 'week') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      filtered = filtered.filter(o => new Date(o.createdAt) >= lastWeek);
    } else if (dateRange === 'month') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      filtered = filtered.filter(o => new Date(o.createdAt) >= lastMonth);
    }

    // Status Filter - On reports, we ONLY show Finalizado and Cancelado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    } else {
      // Pedidos que ainda não chegaram ao fim (Novo, Preparo, Entrega) são ignorados nos relatórios
      filtered = filtered.filter(o => ['finalizado', 'cancelado'].includes(o.status));
    }

    // Payment Filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(o => o.paymentMethod === paymentFilter);
    }

    return filtered;
  }, [orders, dateRange, statusFilter, paymentFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Completed orders for revenue calculation (optional, depending on business logic)
    const completedOrders = filteredOrders.filter(o => o.status === 'finalizado');
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelado');
    const completedRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const cancelledTotal = cancelledOrders.reduce((sum, order) => sum + order.total, 0);

    // Delivery metrics (only finalizado orders)
    const deliveryOrders = completedOrders.filter(o => o.deliveryMethod === 'delivery');
    const pickupOrders = completedOrders.filter(o => o.deliveryMethod === 'pickup');
    const totalDeliveryFee = deliveryOrders.reduce((sum, o) => sum + (o.deliveryFee ?? 0), 0);

    return { 
      totalRevenue, totalOrders, averageOrderValue, completedRevenue,
      totalDeliveries: deliveryOrders.length,
      totalPickups: pickupOrders.length,
      totalDeliveryFee,
      cancelledCount: cancelledOrders.length,
      cancelledTotal
    };
  }, [filteredOrders]);

  // Chart Data: Revenue by Day
  const revenueByDayData = useMemo(() => {
    const dailyData: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyData[date] = (dailyData[date] || 0) + order.total;
    });

    return Object.entries(dailyData)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/');
        const [dayB, monthB] = b.date.split('/');
        return new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime();
      });
  }, [filteredOrders]);

  // Chart Data: Orders by Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const label = STATUS_LABELS[order.status] || order.status;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Chart Data: Payment Methods
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(order => {
      let label = 'Pix';
      if (order.paymentMethod === 'credit_card') label = 'Cartão de Crédito';
      if (order.paymentMethod === 'dinheiro') label = 'Dinheiro';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Top Products
  const topProducts = useMemo(() => {
    const productCounts: Record<string, { name: string, quantity: number, revenue: number }> = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productCounts[item.productId]) {
          productCounts[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productCounts[item.productId].quantity += item.quantity;
        productCounts[item.productId].revenue += item.total;
      });
    });

    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredOrders]);


  if (loading) {
    return <div className="flex items-center justify-center h-full">Carregando relatórios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios e Análises</h1>
          <p className="text-gray-500 text-sm">Acompanhe o desempenho da sua loja</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <select 
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        >
          <option value="today">Hoje</option>
          <option value="week">Últimos 7 dias</option>
          <option value="month">Últimos 30 dias</option>
          <option value="all">Todo o período</option>
        </select>

        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        >
          <option value="all">Todos os Status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select 
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as any)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        >
          <option value="all">Todos os Pagamentos</option>
          <option value="pix">Pix</option>
          <option value="credit_card">Cartão de Crédito</option>
          <option value="dinheiro">Dinheiro</option>
        </select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Bruto</span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Faturamento Total</p>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Total de Pedidos</p>
          <h3 className="text-2xl font-bold text-gray-900">{metrics.totalOrders}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Ticket Médio</p>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.averageOrderValue)}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Finalizados</span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Receita Concluída</p>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.completedRevenue)}</h3>
        </div>
      </div>

      {/* Delivery vs Pickup Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Pedidos Entregues</p>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalDeliveries}</p>
            <p className="text-xs text-gray-400">pedidos com entrega</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Retirada na Loja</p>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalPickups}</p>
            <p className="text-xs text-gray-400">pedidos retirados</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total em Taxas de Entrega</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalDeliveryFee)}</p>
            <p className="text-xs text-gray-400">arrecadado em entregas</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amazii-primary" />
            Faturamento por Dia
          </h3>
          <div className="h-72">
            {revenueByDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDayData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-amazii-primary" />
            Pedidos por Status
          </h3>
          <div className="h-72">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Pedidos']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amazii-primary" />
            Métodos de Pagamento
          </h3>
          <div className="h-72">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Pedidos']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amazii-primary" />
            Produtos Mais Vendidos
          </h3>
          <div className="space-y-4">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amazii-primary/10 text-amazii-primary flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.quantity} unidades vendidas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-400">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amazii-primary" />
            Lista de Pedidos ({filteredOrders.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-sm font-semibold text-gray-600">ID</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Data</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Cliente</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Pagamento</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-gray-900">#{order.id}</td>
                    <td className="p-4 text-sm text-gray-500">{new Date(order.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="p-4 text-sm text-gray-900">{order.customerName}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        order.status === 'finalizado' ? "bg-green-100 text-green-700" :
                        order.status === 'cancelado' ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500 capitalize">
                      {order.paymentMethod === 'credit_card' ? 'Cartão' : order.paymentMethod}
                    </td>
                    <td className={`p-4 text-sm font-bold text-right ${
                      order.status === 'cancelado' ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {order.status === 'cancelado' ? `- ${formatCurrency(order.total)}` : formatCurrency(order.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nenhum pedido encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

