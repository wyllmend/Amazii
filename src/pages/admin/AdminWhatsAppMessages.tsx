import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { useTenantStore } from '@/store/tenantStore';
import { toast } from 'sonner';
import { MessageCircle, Save, RefreshCw, Info } from 'lucide-react';

const VARIABLES = [
  { key: '{nome}', desc: 'Nome do cliente' },
  { key: '{pedido}', desc: 'Número do pedido' },
  { key: '{total}', desc: 'Valor total do pedido' },
  { key: '{loja}', desc: 'Nome da loja' },
  { key: '{endereco}', desc: 'Endereço de entrega' },
  { key: '{frete}', desc: 'Valor do frete' },
  { key: '{rota}', desc: 'Link do GPS/Rota' },
  { key: '{telefone}', desc: 'Telefone do cliente' },
  { key: '{resumo_pedido}', desc: 'Itens do pedido' },
  { key: '{bairro}', desc: 'Bairro do cliente' },
  { key: '{link_aceite}', desc: 'Link de aceite (Entregador)' },
  { key: '{link_entrega}', desc: 'Link da entrega (Entregador ativo)' },
];

const DEFAULT_MESSAGES = {
  msg_order_confirmed: '✅ Olá {nome}! Seu pedido #{pedido} foi *confirmado* e está sendo preparado. Total: {total}',
  msg_order_preparing: '👨‍🍳 Pedido #{pedido} está *em preparo*! Em breve estará pronto.',
  msg_order_out_delivery: '🛵 Pedido #{pedido} *saiu para entrega*! Aguarde, estamos a caminho.',
  msg_order_ready_pickup: '🏪 Pedido #{pedido} está *pronto para retirada*! Pode vir buscar.',
  msg_order_finished: '🎉 Pedido #{pedido} *finalizado*! Obrigado pela preferência, {nome}! Volte sempre 😊',
  msg_order_cancelled: '❌ Seu pedido #{pedido} foi *cancelado*. Em caso de dúvidas, entre em contato.',
  msg_order_delivery_driver: 'Novo pedido disponível! 📦\nCliente: {nome} - {telefone}\nEndereço: {endereco}\nValor Frete: {frete}\nLink da Rota: {rota}\nItens:\n{resumo_pedido}',
  msg_order_received: '✅ *Pedido recebido em {loja}!*\nNº {pedido}\n\n{resumo_pedido}',
  msg_lead_inactive_3days: 'E aí {nome}, bateu aquela fome de novo? 😄\nNosso cardápio tá aqui: {loja}',
  msg_delivery_available: '🚀 NOVA ENTREGA DISPONÍVEL!\n📍 Bairro: {bairro}\n💰 Taxa: {frete}\n🔗 Clique para garantir: {link_aceite}\n(Atenção: O endereço completo só aparece após o aceite no link)',
  msg_delivery_confirmed: '📦 Entrega confirmada! Você garantiu esta corrida.\n\nCliente: {nome} - {telefone}\nEndereço: {endereco}\nValor Frete: {frete}\n\nItens:\n{resumo_pedido}\n\n📍 Link da Rota: {rota}\n\n🔗 Seu link de entrega (salve!):\n{link_entrega}\n\n_(O link expira quando a entrega for finalizada)_',
};

const MESSAGE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  msg_order_confirmed:    { label: 'Pedido Confirmado (Aceito)',    color: 'bg-indigo-50 border-indigo-200',  emoji: '✅' },
  msg_order_preparing:    { label: 'Em Preparo',                   color: 'bg-orange-50 border-orange-200',  emoji: '👨‍🍳' },
  msg_order_out_delivery: { label: 'Saiu para Entrega',            color: 'bg-blue-50 border-blue-200',      emoji: '🛵' },
  msg_order_ready_pickup: { label: 'Pronto para Retirada',         color: 'bg-violet-50 border-violet-200',  emoji: '🏪' },
  msg_order_finished:     { label: 'Pedido Finalizado',            color: 'bg-green-50 border-green-200',    emoji: '🎉' },
  msg_order_cancelled:    { label: 'Pedido Cancelado',             color: 'bg-red-50 border-red-200',        emoji: '❌' },
  msg_order_delivery_driver:{ label: 'Aviso para o Entregador Fixo', color: 'bg-teal-50 border-teal-200',      emoji: '🛵' },
  msg_order_received:     { label: 'Recebido pelo Sistema (Novo)', color: 'bg-yellow-50 border-yellow-200',  emoji: '📥' },
  msg_lead_inactive_3days:{ label: 'Cliente Inativo (3 dias sem pedir)', color: 'bg-orange-50 border-orange-200', emoji: '❤️' },
  msg_delivery_available:   { label: 'Nova Entrega Disponível (Pool de Entregadores)', color: 'bg-teal-50 border-teal-200',      emoji: '🚀' },
  msg_delivery_confirmed:   { label: 'Entrega Confirmada ao Entregador', color: 'bg-emerald-50 border-emerald-200',      emoji: '📦' },
};

type Messages = Record<string, string>;

export default function AdminWhatsAppMessages() {
  const restaurantId = useTenantStore((s) => s.restaurantId);
  const [messages, setMessages] = useState<Messages>({ ...DEFAULT_MESSAGES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    loadMessages();
  }, [restaurantId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();

      if (data) {
        setMessages({
          msg_order_confirmed:    data.msg_order_confirmed    || DEFAULT_MESSAGES.msg_order_confirmed,
          msg_order_preparing:    data.msg_order_preparing    || DEFAULT_MESSAGES.msg_order_preparing,
          msg_order_out_delivery: data.msg_order_out_delivery || DEFAULT_MESSAGES.msg_order_out_delivery,
          msg_order_ready_pickup: data.msg_order_ready_pickup || DEFAULT_MESSAGES.msg_order_ready_pickup,
          msg_order_finished:     data.msg_order_finished     || DEFAULT_MESSAGES.msg_order_finished,
          msg_order_cancelled:    data.msg_order_cancelled    || DEFAULT_MESSAGES.msg_order_cancelled,
          msg_order_delivery_driver: data.msg_order_delivery_driver || DEFAULT_MESSAGES.msg_order_delivery_driver,
          msg_order_received:     data.msg_order_received     || DEFAULT_MESSAGES.msg_order_received,
          msg_lead_inactive_3days: data.msg_lead_inactive_3days || DEFAULT_MESSAGES.msg_lead_inactive_3days,
          msg_delivery_available: data.msg_delivery_available || DEFAULT_MESSAGES.msg_delivery_available,
          msg_delivery_confirmed: data.msg_delivery_confirmed || DEFAULT_MESSAGES.msg_delivery_confirmed,
        });
      }
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('store_settings')
        .update({
          msg_order_confirmed:    messages.msg_order_confirmed,
          msg_order_preparing:    messages.msg_order_preparing,
          msg_order_out_delivery: messages.msg_order_out_delivery,
          msg_order_ready_pickup: messages.msg_order_ready_pickup,
          msg_order_finished:     messages.msg_order_finished,
          msg_order_cancelled:    messages.msg_order_cancelled,
          msg_order_delivery_driver: messages.msg_order_delivery_driver,
          msg_order_received:     messages.msg_order_received,
          msg_lead_inactive_3days: messages.msg_lead_inactive_3days,
          msg_delivery_available: messages.msg_delivery_available,
          msg_delivery_confirmed: messages.msg_delivery_confirmed,
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      toast.success('Mensagens salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar mensagens');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: string) => {
    setMessages(prev => ({ ...prev, [key]: DEFAULT_MESSAGES[key] }));
    toast.info('Mensagem redefinida para o padrão');
  };

  const insertVariable = (variable: string) => {
    if (!activeField) return;
    setMessages(prev => ({
      ...prev,
      [activeField]: (prev[activeField] || '') + variable,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amazii-primary rounded-full border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-500" />
            Mensagens do WhatsApp
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Personalize as mensagens automáticas enviadas para os clientes a cada etapa do pedido.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Tudo'}
        </button>
      </div>

      {/* Variables guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm mb-2">Variáveis disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-mono font-medium transition-colors"
                  title={`Clique para inserir no campo ativo: ${v.desc}`}
                >
                  {v.key}
                  <span className="font-sans text-amber-600 font-normal">— {v.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              💡 Clique em uma variável para inserí-la no campo que você está editando.
            </p>
          </div>
        </div>
      </div>

      {/* Message Cards */}
      <div className="space-y-4">
        {Object.entries(MESSAGE_LABELS).map(([key, meta]) => (
          <div key={key} className={`border rounded-xl p-5 ${meta.color}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.emoji}</span>
                <h3 className="font-bold text-gray-800">{meta.label}</h3>
              </div>
              <button
                onClick={() => handleReset(key)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-white/60 px-2 py-1 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Redefinir padrão
              </button>
            </div>
            <textarea
              value={messages[key] || ''}
              onChange={e => setMessages(prev => ({ ...prev, [key]: e.target.value }))}
              onFocus={() => setActiveField(key)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-white/70 bg-white/80 focus:bg-white focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-sm font-mono resize-none"
              placeholder="Digite a mensagem..."
            />
            {/* Live preview */}
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Prévia: </span>
              <span className="font-mono">
                {(messages[key] || '')
                  .replace('{nome}', 'João')
                  .replace('{pedido}', 'ABC12345')
                  .replace('{total}', 'R$ 45,90')
                  .replace('{loja}', 'Minha Loja')
                  .replace('{endereco}', 'Rua X, 123, Bairro Centro')
                  .replace('{frete}', 'R$ 5,00')
                  .replace('{rota}', 'https://maps.google.com/?q=...')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Save button at bottom */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Mensagens'}
        </button>
      </div>
    </div>
  );
}
