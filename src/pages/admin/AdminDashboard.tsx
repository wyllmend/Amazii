import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Order } from '@/services/types';
import { formatCurrency } from '@/lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { DollarSign, ShoppingBag, Users, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';

export default function AdminDashboard() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const data = await supabaseService.getOrders(restaurantId);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!restaurantId) return;
    fetchData();

    // Subscribe to real-time changes
    const subscription = supabaseService.subscribeToOrders(restaurantId, (order, event) => {
      if (event === 'INSERT') {
        setOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      } else if (event === 'UPDATE') {
        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      } else if (event === 'DELETE') {
        setOrders(prev => prev.filter(o => o.id !== order.id));
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [restaurantId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  // KPIs Calculation
  const finalizedOrders = orders.filter(o => o.status === 'finalizado');
  const validOrders = orders.filter(o => o.status !== 'cancelado');
  
  const totalRevenue = finalizedOrders.reduce((acc, order) => acc + order.total, 0);
  const totalOrders = validOrders.length;
  const averageTicket = finalizedOrders.length > 0 ? totalRevenue / finalizedOrders.length : 0;
  const activeOrders = orders.filter(o => !['finalizado', 'cancelado'].includes(o.status)).length;


  // Chart Data Preparation
  const revenueByDay = finalizedOrders.reduce((acc: any, order) => {
    const date = new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    acc[date] = (acc[date] || 0) + order.total;
    return acc;
  }, {});

  const chartData = Object.keys(revenueByDay).map(date => ({
    name: date,
    total: revenueByDay[date]
  })).sort((a, b) => {
    return new Date(a.name.split('/').reverse().join('-')).getTime() - new Date(b.name.split('/').reverse().join('-')).getTime();
  }).slice(-7); // Last 7 days

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Receita Total</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Pedidos</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalOrders}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Ticket Médio</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(averageTicket)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pedidos Ativos</p>
            <h3 className="text-2xl font-bold text-gray-900">{activeOrders}</h3>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Receita por Dia</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="total" fill="#7B2CBF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Pedidos Recentes</h3>
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                    #{order.id}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{order.customerName}</p>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(order.total)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${order.status === 'finalizado' ? 'bg-green-100 text-green-700' : 
                      order.status === 'cancelado' ? 'bg-red-100 text-red-700' : 
                      'bg-yellow-100 text-yellow-700'}`
                  }>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-center text-gray-500 py-4">Nenhum pedido recente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

