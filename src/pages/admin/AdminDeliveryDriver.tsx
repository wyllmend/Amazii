import React, { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { useTenantStore } from '@/store/tenantStore';
import { DeliveryDriver, StoreSettings } from '@/services/types';
import { toast } from 'sonner';
import { Truck, Plus, Trash2, Edit2, Play, Square, Loader2, ToggleLeft, ToggleRight, Users, Zap } from 'lucide-react';

export default function AdminDeliveryDriver() {
  const restaurantId = useTenantStore((s) => s.restaurantId);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [savingQueueMode, setSavingQueueMode] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      loadDrivers();
      supabaseService.getSettings(restaurantId).then(s => setStoreSettings(s));
    }
  }, [restaurantId]);

  const handleToggleQueueMode = async () => {
    if (!restaurantId || !storeSettings) return;
    const newMode = !storeSettings.driverQueueMode;
    setSavingQueueMode(true);
    try {
      const updated = await supabaseService.updateSettings(
        { ...storeSettings, driverQueueMode: newMode },
        restaurantId
      );
      setStoreSettings(updated);
      toast.success(newMode ? 'Modo Fila ativado!' : 'Modo Direto ativado!');
    } catch {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSavingQueueMode(false);
    }
  };

  const loadDrivers = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const data = await supabaseService.getDeliveryDrivers(restaurantId);
      setDrivers(data);
    } catch {
      toast.error('Erro ao carregar entregadores.');
    } finally {
      setLoading(false);
    }
  };

  const openForm = (driver?: DeliveryDriver) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({ name: driver.name, phone: driver.phone, active: driver.active });
    } else {
      setEditingDriver(null);
      setFormData({ name: '', phone: '', active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    setIsSubmitting(true);
    try {
      if (editingDriver) {
        const updated = await supabaseService.updateDeliveryDriver(editingDriver.id, formData);
        setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d));
        toast.success('Entregador atualizado!');
      } else {
        const created = await supabaseService.createDeliveryDriver({ ...formData, restaurant_id: restaurantId });
        setDrivers(prev => [...prev, created]);
        toast.success('Entregador adicionado!');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('Erro ao salvar entregador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja remover o entregador ${name}?`)) return;
    try {
      await supabaseService.deleteDeliveryDriver(id);
      setDrivers(prev => prev.filter(d => d.id !== id));
      toast.success('Removido com sucesso!');
    } catch {
      toast.error('Erro ao remover.');
    }
  };

  const toggleActive = async (driver: DeliveryDriver) => {
    try {
      const updated = await supabaseService.updateDeliveryDriver(driver.id, { active: !driver.active });
      setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d));
      toast.success(`Entregador ${updated.active ? 'ativado' : 'desativado'}!`);
    } catch {
      toast.error('Erro ao alterar status.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-teal-600" />
            Entregador Fixo
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie os entregadores e automatize o envio de rotas pelo WhatsApp.
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-5 py-2.5 bg-amazii-primary hover:bg-amazii-dark text-white font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Entregador
        </button>
      </div>

      {/* ── Modo Fila Toggle ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-5 transition-all ${
        storeSettings?.driverQueueMode
          ? 'border-teal-400 bg-teal-50'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {storeSettings?.driverQueueMode
              ? <Zap className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
              : <Users className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />}
            <div>
              <h2 className="font-bold text-gray-900 text-base">
                Modo Fila de Entregadores
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                {storeSettings?.driverQueueMode
                  ? <><span className="font-semibold text-teal-700">Ativado (Competitivo):</span> Envia um link de aceite para todos os motoboys. O primeiro a clicar garante a entrega.</>
                  : <><span className="font-semibold text-gray-600">Desativado (Direto):</span> O endereço e rota são enviados diretamente para todos os motoboys ativos ao aceitar o pedido.</>}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleQueueMode}
            disabled={savingQueueMode || !storeSettings}
            className="shrink-0 transition-colors disabled:opacity-50"
          >
            {savingQueueMode
              ? <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              : storeSettings?.driverQueueMode
                ? <ToggleRight className="w-10 h-10 text-teal-600" />
                : <ToggleLeft className="w-10 h-10 text-gray-400" />}
          </button>
        </div>

        {storeSettings?.driverQueueMode && (
          <div className="mt-4 pt-4 border-t border-teal-200">
            <p className="text-xs text-teal-700 font-medium">📋 Exemplo de mensagem enviada aos motoboys:</p>
            <div className="mt-2 bg-white border border-teal-200 rounded-xl p-3 text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">{`🚀 NOVA ENTREGA DISPONÍVEL!
📍 Bairro: [Bairro do cliente]
💰 Taxa: R$ [valor]
🔗 Clique para garantir: https://elevare-menu.vercel.app/[loja]/aceitar/[pedido]
(Atenção: O endereço completo só aparece após o aceite no link)`}</div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum entregador cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">Clique no botão acima para adicionar.</p>
          </div>
        ) : (
          drivers.map(driver => (
            <div key={driver.id} className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${driver.active ? 'border-teal-200 ring-1 ring-teal-50' : 'border-gray-200 opacity-75'}`}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{driver.name}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${driver.active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'}`}>
                  {driver.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-gray-600 mb-4">{driver.phone}</p>
              
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-auto">
                <button
                  onClick={() => toggleActive(driver)}
                  className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${driver.active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                >
                  {driver.active ? <><Square className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Ativar</>}
                </button>
                <button onClick={() => openForm(driver)} className="p-2 text-gray-400 hover:text-amazii-primary hover:bg-purple-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(driver.id, driver.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                {editingDriver ? 'Editar Entregador' : 'Novo Entregador'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                    placeholder="Ex: 5511999999999"
                  />
                  <p className="text-xs text-gray-500 mt-1">Formato internacional (Ex: 55DDDNumero)</p>
                </div>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-5 h-5 text-amazii-primary rounded focus:ring-amazii-primary"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Entregador Ativo</span>
                    <span className="block text-xs text-gray-500">Irá receber notificações de novos pedidos</span>
                  </div>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-amazii-primary hover:bg-amazii-dark text-white font-medium rounded-lg transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
