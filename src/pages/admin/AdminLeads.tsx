import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Order } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, MessageCircle, User, Calendar, DollarSign, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

type Lead = {
  customerName: string;
  customerPhone: string;
  lastOrderDate: string;
  totalSpent: number;
  orderCount: number;
  daysSinceLastOrder: number;
};

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'saudade'>('all');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const orders = await supabaseService.getOrders();
      const leadsMap = new Map<string, Lead>();

      orders.forEach(order => {
        // Normalize phone number as key
        const phone = order.customerPhone.replace(/\D/g, '');
        
        if (!leadsMap.has(phone)) {
          leadsMap.set(phone, {
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            lastOrderDate: order.createdAt,
            totalSpent: 0,
            orderCount: 0,
            daysSinceLastOrder: 0
          });
        }

        const lead = leadsMap.get(phone)!;
        lead.totalSpent += order.total;
        lead.orderCount += 1;
        
        // Update last order date if this order is newer
        if (new Date(order.createdAt) > new Date(lead.lastOrderDate)) {
          lead.lastOrderDate = order.createdAt;
          lead.customerName = order.customerName; // Update name to latest used
        }
      });

      // Calculate days since last order
      const now = new Date();
      const leadsArray = Array.from(leadsMap.values()).map(lead => {
        const lastDate = new Date(lead.lastOrderDate);
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...lead, daysSinceLastOrder: diffDays };
      });

      // Sort by last order date desc (most recent first)
      leadsArray.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());

      setLeads(leadsArray);
    } catch (error) {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppClick = (lead: Lead, type: 'saudade' | 'promo') => {
    let message = '';
    if (type === 'saudade') {
      message = `Olá ${lead.customerName}! 🌟 Sentimos sua falta! Faz ${lead.daysSinceLastOrder} dias que não vemos você por aqui. Que tal pedir seu açaí favorito hoje com um desconto especial?`;
    } else {
      message = `Olá ${lead.customerName}! Temos novidades deliciosas no cardápio. Venha conferir! 😋`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const phone = lead.customerPhone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customerPhone.includes(searchTerm);
    
    if (filterType === 'saudade') {
      return matchesSearch && lead.daysSinceLastOrder > 30; // 30 days threshold
    }
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads & CRM</h1>
          <p className="text-gray-500">Gerencie seus clientes e recupere vendas</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterType('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filterType === 'all' ? "bg-amazii-primary text-white" : "bg-white text-gray-600 border border-gray-200"
            )}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterType('saudade')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              filterType === 'saudade' ? "bg-orange-500 text-white" : "bg-white text-orange-600 border border-orange-200"
            )}
          >
            <Calendar className="w-4 h-4" />
            Saudade ({leads.filter(l => l.daysSinceLastOrder > 30).length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 shadow-sm"
        />
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700">Cliente</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Último Pedido</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Total Gasto (LTV)</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Pedidos</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Carregando leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-amazii-primary font-bold">
                          {lead.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{lead.customerName}</div>
                          <div className="text-sm text-gray-500">{lead.customerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{formatDate(lead.lastOrderDate)}</div>
                      <div className={cn(
                        "text-xs font-medium mt-1",
                        lead.daysSinceLastOrder > 30 ? "text-orange-500" : "text-green-500"
                      )}>
                        {lead.daysSinceLastOrder === 0 ? 'Hoje' : `Há ${lead.daysSinceLastOrder} dias`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        {formatCurrency(lead.totalSpent)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <ShoppingBag className="w-4 h-4" />
                        {lead.orderCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleWhatsAppClick(lead, lead.daysSinceLastOrder > 30 ? 'saudade' : 'promo')}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium text-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
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

