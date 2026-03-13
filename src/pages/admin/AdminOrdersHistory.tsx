import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Order, OrderStatus } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useParams } from 'react-router-dom';
import { useTenantStore } from '@/store/tenantStore';

const STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Novo (Não Pago)',
  pago: 'Pago',
  aceito: 'Confirmado',
  em_preparo: 'Em Preparo',
  saiu_entrega: 'Saiu para Entrega',
  pronto_retirada: 'Pronto para Retirada',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pago:                 'bg-blue-100 text-blue-700 border-blue-200',
  aceito:               'bg-indigo-100 text-indigo-700 border-indigo-200',
  em_preparo:           'bg-orange-100 text-orange-700 border-orange-200',
  saiu_entrega:         'bg-purple-100 text-purple-700 border-purple-200',
  pronto_retirada:      'bg-purple-100 text-purple-700 border-purple-200',
  finalizado:           'bg-green-100 text-green-700 border-green-200',
  cancelado:            'bg-red-100 text-red-700 border-red-200',
};

type FilterType = 'all' | 'finalizado' | 'cancelado';
type DateFilter = '7d' | '30d' | '90d' | 'all';

export default function AdminOrdersHistory() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter]     = useState<DateFilter>('30d');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [restaurantId]);

  const fetchHistory = async () => {
    if (!restaurantId) return;
    try {
      const data = await supabaseService.getOrders(restaurantId);
      const history = data
        .filter(o => o.status === 'finalizado' || o.status === 'cancelado')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(history);
    } catch {
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getDateCutoff = (): Date | null => {
    const now = new Date();
    if (dateFilter === '7d')  return new Date(now.getTime() - 7  * 86400 * 1000);
    if (dateFilter === '30d') return new Date(now.getTime() - 30 * 86400 * 1000);
    if (dateFilter === '90d') return new Date(now.getTime() - 90 * 86400 * 1000);
    return null;
  };

  const cutoff = getDateCutoff();
  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchDate   = !cutoff || new Date(o.createdAt) >= cutoff;
    const matchSearch = !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchDate && matchSearch;
  });

  const totalFinalizado = filtered.filter(o => o.status === 'finalizado').length;
  const totalCancelado  = filtered.filter(o => o.status === 'cancelado').length;

  const getPaymentLabel = (o: Order) => {
    if (o.paymentMethod === 'credit_card') return 'Cartão';
    if (o.paymentMethod === 'dinheiro') return 'Dinheiro';
    return 'Pix';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/admin/${tenantSlug}/pedidos`}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Pedidos</h1>
          <p className="text-gray-500 text-sm">Pedidos finalizados e cancelados</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalFinalizado}</p>
            <p className="text-sm text-gray-500">Finalizados</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalCancelado}</p>
            <p className="text-sm text-gray-500">Cancelados</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou pedido..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {(['all', 'finalizado', 'cancelado'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                statusFilter === f
                  ? 'bg-amazii-primary text-white border-amazii-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amazii-primary/30'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'finalizado' ? 'Finalizado' : 'Cancelado'}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as DateFilter)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="all">Todo o período</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagamento</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Nenhum pedido encontrado</td></tr>
              ) : (
                filtered.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">#{order.id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900 text-sm">{order.customerName}</p>
                      <p className="text-xs text-gray-400">{order.customerPhone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 max-w-[200px] truncate">
                      {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">{formatCurrency(order.total)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{getPaymentLabel(order)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold border', STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
