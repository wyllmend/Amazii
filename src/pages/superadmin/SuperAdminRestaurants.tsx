import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Store, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight,
  Loader2, CheckCircle2, AlertCircle, X, ExternalLink, RefreshCw,
  ShoppingBag, Users, Calendar, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────
type Restaurant = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  // extras (joined)
  orderCount?: number;
  customerCount?: number;
};

type FormData = {
  name: string;
  slug: string;
  active: boolean;
};

const EMPTY_FORM: FormData = { name: '', slug: '', active: true };

const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Slug helper ───────────────────────────────────────────────────────────
function toSlug(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-');
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function Modal({
  title, onClose, children
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="font-bold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────────────────
function RestaurantForm({
  initial, onSave, onCancel, saving
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  const set = (k: keyof FormData, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nome do Restaurante *</label>
        <input
          value={form.name}
          onChange={e => { set('name', e.target.value); if (!initial.name) set('slug', toSlug(e.target.value)); }}
          placeholder="Ex: Açaí do Bom"
          className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Slug (URL)</label>
        <div className="flex gap-2">
          <input
            value={form.slug}
            onChange={e => set('slug', toSlug(e.target.value))}
            placeholder="acai-do-bom"
            className="flex-1 px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 font-mono"
          />
          <button
            type="button"
            onClick={() => set('slug', toSlug(form.name))}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-xs text-gray-300 transition-colors"
          >Auto</button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">amazii.app/<span className="text-purple-400">{form.slug || 'slug'}</span></p>
      </div>
      <div className="flex items-center justify-between p-3.5 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <div>
          <p className="text-sm font-medium text-gray-200">Status Ativo</p>
          <p className="text-[11px] text-gray-500">Restaurante visível para clientes</p>
        </div>
        <button
          type="button"
          onClick={() => set('active', !form.active)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            form.active ? 'bg-purple-600' : 'bg-gray-700'
          )}
        >
          <span className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
            form.active ? 'translate-x-5' : 'translate-x-1'
          )} />
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { if (!form.name || !form.slug) { toast.error('Nome e Slug são obrigatórios'); return; } onSave(form); }}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-sm text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SuperAdminRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState<'name' | 'created_at' | 'orderCount'>('created_at');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Restaurant | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [togglingId, setTogglingId]   = useState<string | null>(null);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list: Restaurant[] = (data || []).map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        active: r.active ?? true,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      // Load order count per restaurant in parallel
      const enriched = await Promise.all(list.map(async r => {
        const [o, c] = await Promise.all([
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
          supabase.from('orders').select('customer_phone', { count: 'exact', head: false }).eq('restaurant_id', r.id),
        ]);
        const phones = new Set((c.data || []).map((x: any) => x.customer_phone));
        return { ...r, orderCount: o.count ?? 0, customerCount: phones.size };
      }));

      setRestaurants(enriched);
    } catch {
      toast.error('Erro ao carregar restaurantes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  // ── Create / Update ────────────────────────────────────────────────────
  const handleSave = async (form: FormData) => {
    setSaveLoading(true);
    try {
      if (editTarget) {
        const { error } = await supabase
          .from('restaurants')
          .update({ name: form.name, slug: form.slug, active: form.active, updated_at: new Date().toISOString() })
          .eq('id', editTarget.id);
        if (error) throw error;
        toast.success('Restaurante atualizado!');
      } else {
        const { error } = await supabase
          .from('restaurants')
          .insert({
            id: crypto.randomUUID(),
            name: form.name,
            slug: form.slug,
            active: form.active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
        toast.success('Restaurante criado!');
      }
      setShowModal(false);
      setEditTarget(null);
      fetchRestaurants();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────
  const handleToggle = async (r: Restaurant) => {
    setTogglingId(r.id);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ active: !r.active, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (error) throw error;
      setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, active: !r.active } : x));
      toast.success(`${r.name} ${!r.active ? 'ativado' : 'desativado'}`);
    } catch {
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('restaurants').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setRestaurants(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Restaurante removido');
    } catch {
      toast.error('Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  // ── Sort + Filter ──────────────────────────────────────────────────────
  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const shown = [...restaurants]
    .filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey];
      if (sortKey === 'created_at') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const activeCount   = restaurants.filter(r => r.active).length;
  const inactiveCount = restaurants.length - activeCount;
  const totalOrders   = restaurants.reduce((s, r) => s + (r.orderCount ?? 0), 0);

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-purple-400" />
      : <ChevronDown className="w-3 h-3 text-purple-400" />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-6 space-y-5 font-mono">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-400" />
            <h1 className="text-base font-bold text-white tracking-tight">Gerenciar Restaurantes</h1>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">CRUD completo dos tenants do ecossistema</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchRestaurants}
            className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors"
            title="Recarregar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-xl text-xs font-bold text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Restaurante
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Store,      label: 'Total',    value: restaurants.length,    color: 'text-purple-400 bg-purple-900/30' },
          { icon: CheckCircle2,label: 'Ativos',  value: activeCount,           color: 'text-green-400 bg-green-900/30'   },
          { icon: AlertCircle, label: 'Inativos',value: inactiveCount,          color: 'text-red-400 bg-red-900/30'       },
          { icon: ShoppingBag, label: 'Pedidos', value: totalOrders.toLocaleString(), color: 'text-blue-400 bg-blue-900/30' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', s.color)}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{loading ? '…' : s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug..."
          className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
        />
      </div>

      {/* ── Table ── */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-800">
              <tr>
                {[
                  { key: 'name',       label: 'Restaurante'    },
                  { key: null,         label: 'URL / Slug'     },
                  { key: 'orderCount', label: 'Pedidos'        },
                  { key: null,         label: 'Clientes'       },
                  { key: 'created_at', label: 'Criado em'      },
                  { key: null,         label: 'Status'         },
                  { key: null,         label: 'Ações'          },
                ].map((col, i) => (
                  <th
                    key={i}
                    onClick={col.key ? () => handleSort(col.key as typeof sortKey) : undefined}
                    className={cn(
                      'px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500',
                      col.key && 'cursor-pointer hover:text-gray-300 select-none'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon col={col.key as typeof sortKey} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500 mx-auto" />
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                    {search ? 'Nenhum resultado para a busca' : 'Nenhum restaurante cadastrado'}
                  </td>
                </tr>
              ) : (
                shown.map(r => (
                  <tr key={r.id} className="hover:bg-gray-800/30 transition-colors group">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-none">{r.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{r.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    {/* Slug */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded-lg border border-purple-800/30">
                          /{r.slug}
                        </span>
                        <a
                          href={`/${r.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                        </a>
                      </div>
                    </td>
                    {/* Orders */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-200 font-bold">{(r.orderCount ?? 0).toLocaleString()}</span>
                      </div>
                    </td>
                    {/* Customers */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-200">{(r.customerCount ?? 0).toLocaleString()}</span>
                      </div>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(r.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    {/* Status toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(r)}
                        disabled={togglingId === r.id}
                        className="flex items-center gap-1.5 focus:outline-none disabled:opacity-60"
                      >
                        {togglingId === r.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                        ) : r.active ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-600" />
                        )}
                        <span className={cn('text-[10px] font-bold', r.active ? 'text-green-400' : 'text-gray-600')}>
                          {r.active ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditTarget(r); setShowModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-blue-400 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Footer count */}
        <div className="px-4 py-2 border-t border-gray-800/50 text-[10px] text-gray-600">
          {shown.length} de {restaurants.length} restaurantes
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <Modal
          title={editTarget ? `Editar — ${editTarget.name}` : 'Novo Restaurante'}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        >
          <RestaurantForm
            initial={editTarget ? { name: editTarget.name, slug: editTarget.slug, active: editTarget.active } : EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => { setShowModal(false); setEditTarget(null); }}
            saving={saveLoading}
          />
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="p-4 bg-red-950/30 border border-red-900/30 rounded-xl">
              <p className="text-sm text-gray-200">
                Tem certeza que deseja excluir <strong className="text-white">{deleteTarget.name}</strong>?
              </p>
              <p className="text-xs text-red-400 mt-2">
                ⚠ {(deleteTarget.orderCount ?? 0) > 0
                  ? `Este restaurante possui ${deleteTarget.orderCount} pedido(s). Todos serão desvinculados.`
                  : 'Esta ação é irreversível.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-sm text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
