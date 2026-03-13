import { useState, useEffect, useRef } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { whatsappService } from '@/services/whatsappService';
import { Order } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, MessageCircle, DollarSign, ShoppingBag, Heart, Loader2, Send, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';
import { useParams } from 'react-router-dom';

type Lead = {
  customerName: string;
  customerPhone: string;
  lastOrderDate: string;
  totalSpent: number;
  orderCount: number;
  daysSinceLastOrder: number;
};

const SAUDADE_DAYS = 3;
const BLASTED_KEY = 'amazii_saudade_blasted';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Returns phones blasted within the last 3 days */
function getBlastedPhones(): Set<string> {
  try {
    const raw = localStorage.getItem(BLASTED_KEY);
    if (!raw) return new Set();
    // Format: { [phone]: timestamp }
    const map = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - THREE_DAYS_MS;
    return new Set(Object.entries(map).filter(([, ts]) => ts > cutoff).map(([p]) => p));
  } catch { return new Set(); }
}

function markPhoneAsBlasted(phones: string[]) {
  try {
    const raw = localStorage.getItem(BLASTED_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const cutoff = Date.now() - THREE_DAYS_MS;
    // Clean expired entries, then add new ones
    const cleaned = Object.fromEntries(Object.entries(map).filter(([, ts]) => ts > cutoff));
    const now = Date.now();
    phones.forEach(p => { cleaned[p] = now; });
    localStorage.setItem(BLASTED_KEY, JSON.stringify(cleaned));
  } catch {}
}

/** Estado de um disparo em lote */
type BlastState = 'idle' | 'running' | 'done';

export default function AdminLeads() {
  const { tenantSlug = 'default' } = useParams<{ tenantSlug: string }>();
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'saudade'>('all');
  const [blastedPhones, setBlastedPhones] = useState<Set<string>>(getBlastedPhones);

  // Blast state
  const [blastState, setBlastState] = useState<BlastState>('idle');
  const [blastProgress, setBlastProgress] = useState({ sent: 0, total: 0, current: '' });
  const blastAbortRef = useRef(false);

  useEffect(() => { fetchLeads(); }, [restaurantId]);

  const fetchLeads = async () => {
    if (!restaurantId) return;
    try {
      const orders = await supabaseService.getOrders(restaurantId);
      const leadsMap = new Map<string, Lead>();

      orders.forEach(order => {
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
        if (new Date(order.createdAt) > new Date(lead.lastOrderDate)) {
          lead.lastOrderDate = order.createdAt;
          lead.customerName = order.customerName;
        }
      });

      const now = new Date();
      const leadsArray = Array.from(leadsMap.values()).map(lead => {
        const diffTime = Math.abs(now.getTime() - new Date(lead.lastOrderDate).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...lead, daysSinceLastOrder: diffDays };
      });

      leadsArray.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
      setLeads(leadsArray);
    } catch {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  // ─── Blast: envia para todos com saudade ────────────────────────────────────
  const handleBlast = async () => {
    const catalogUrl = window.location.origin;

    // Mensagem que parece humana: texto + link do catálogo
    const buildMessage = (name: string) =>
      `E aí ${name}, bateu aquela fome de novo? 😄\nNosso cardápio tá aqui: ${catalogUrl}`;

    const targets = saudadeLeads;
    if (targets.length === 0) {
      toast.info('Nenhum cliente com saudade no momento.');
      return;
    }

    const confirmed = window.confirm(
      `Enviar mensagem para ${targets.length} cliente${targets.length > 1 ? 's' : ''} com saudade?\n\nAs mensagens serão enviadas com intervalos aleatórios para proteger o número do restaurante.`
    );
    if (!confirmed) return;

    blastAbortRef.current = false;
    setBlastState('running');
    setBlastProgress({ sent: 0, total: targets.length, current: targets[0]?.customerName || '' });

    const sentPhones: string[] = [];
    let sent = 0;
    for (const lead of targets) {
      if (blastAbortRef.current) break;

      setBlastProgress(p => ({ ...p, current: lead.customerName }));
      try {
        await whatsappService.sendMessage(tenantSlug, lead.customerPhone, buildMessage(lead.customerName));
        sent++;
        sentPhones.push(lead.customerPhone.replace(/\D/g, ''));
        setBlastProgress(p => ({ ...p, sent }));
      } catch (err: any) {
        console.error('[Blast] Falha ao enviar para', lead.customerPhone, err?.message);
      }
    }

    // Mark as blasted → they leave the saudade list for 3 days
    if (sentPhones.length > 0) {
      markPhoneAsBlasted(sentPhones);
      setBlastedPhones(getBlastedPhones());
    }

    setBlastState('done');
    if (blastAbortRef.current) {
      toast.info(`Disparo cancelado. ${sent} mensagens enviadas.`);
    } else {
      toast.success(`✅ Disparo concluído! ${sent} de ${targets.length} mensagens enviadas.`);
    }
  };

  const handleCancelBlast = () => {
    blastAbortRef.current = true;
  };

  const handleResetBlast = () => {
    setBlastState('idle');
    setBlastProgress({ sent: 0, total: 0, current: '' });
  };

  // ─── WhatsApp manual (clientes normais) ─────────────────────────────────────
  const handleWhatsAppClick = (lead: Lead) => {
    const msg = `Olá ${lead.customerName}! Temos novidades deliciosas no cardápio. Venha conferir! 😋`;
    const phone = lead.customerPhone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Exclude leads that already received the blast today
  const saudadeLeads = leads.filter(l =>
    l.daysSinceLastOrder >= SAUDADE_DAYS &&
    !blastedPhones.has(l.customerPhone.replace(/\D/g, ''))
  );

  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customerPhone.includes(searchTerm);
    if (filterType === 'saudade') return matchesSearch && lead.daysSinceLastOrder >= SAUDADE_DAYS;
    return matchesSearch;
  });

  const progressPct = blastProgress.total > 0
    ? Math.round((blastProgress.sent / blastProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
            <Heart className="w-4 h-4" />
            Com Saudade ({saudadeLeads.length})
          </button>
        </div>
      </div>

      {/* ── Blast Button / Progress Banner ── */}
      {saudadeLeads.length > 0 && (
        <div className={cn(
          "rounded-2xl border p-5 transition-all",
          blastState === 'running' ? "bg-orange-50 border-orange-300" :
          blastState === 'done' ? "bg-green-50 border-green-300" :
          "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"
        )}>
          {blastState === 'idle' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {saudadeLeads.length} cliente{saudadeLeads.length > 1 ? 's' : ''} com saudade
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Não pedem há {SAUDADE_DAYS}+ dias. Envie uma mensagem com o link do cardápio para reativar.
                    As mensagens são enviadas com intervalos aleatórios para proteger o número do restaurante.
                  </p>
                </div>
              </div>
              <button
                onClick={handleBlast}
                className="flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-orange-200 flex-shrink-0 whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                Disparar mensagem
              </button>
            </div>
          )}

          {blastState === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span className="font-semibold text-sm text-gray-800">
                    Enviando para <span className="text-orange-600">{blastProgress.current}</span>...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-700">
                    {blastProgress.sent}/{blastProgress.total}
                  </span>
                  <button
                    onClick={handleCancelBlast}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Cancelar
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                ⚡ Mensagens sendo enviadas com proteção anti-ban (intervalos de 3–7 segundos)
              </p>
            </div>
          )}

          {blastState === 'done' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    Disparo concluído! {blastProgress.sent} de {blastProgress.total} mensagens enviadas.
                  </p>
                  <p className="text-gray-500 text-xs">
                    Os clientes receberam a mensagem com o link do cardápio.
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetBlast}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 shadow-sm"
        />
      </div>

      {/* ── Leads Table ── */}
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
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
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
                filteredLeads.map((lead, idx) => {
                  const isSaudade = lead.daysSinceLastOrder >= SAUDADE_DAYS;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                            isSaudade ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-amazii-primary"
                          )}>
                            {lead.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                              {lead.customerName}
                              {isSaudade && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">
                                  <Heart className="w-3 h-3" />
                                  com saudade
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{lead.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{formatDate(lead.lastOrderDate)}</div>
                        <div className={cn(
                          "text-xs font-medium mt-1",
                          isSaudade ? "text-orange-500" : "text-green-500"
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
                          onClick={() => handleWhatsAppClick(lead)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium text-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
