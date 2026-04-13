import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabaseService } from '@/services/supabaseService';
import { Order, OrderItem, OrderStatus, StoreSettings, Product } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { 
  Search,
  Printer, Bell, ShoppingCart, CheckSquare, ThumbsUp, Trash2,
  History, Eraser, Pencil, X, Plus, Minus, Save, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { whatsappService } from '@/services/whatsappService';
import { Link, useParams } from 'react-router-dom';
import { useTenantStore } from '@/store/tenantStore';

// Active statuses shown in the main orders panel
const ACTIVE_STATUSES: OrderStatus[] = [
  'aguardando_pagamento', 'pago', 'aceito', 'em_preparo',
  'saiu_entrega', 'pronto_retirada'
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  'aguardando_pagamento': 'Novo (Não Pago)',
  'pago': 'Pago',
  'aceito': 'Confirmado',
  'em_preparo': 'Em Preparo',
  'saiu_entrega': 'Saiu para Entrega',
  'pronto_retirada': 'Pronto para Retirada',
  'finalizado': 'Finalizado',
  'cancelado': 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  'aguardando_pagamento': 'bg-yellow-500 text-white',
  'pago': 'bg-blue-500 text-white',
  'aceito': 'bg-indigo-500 text-white',
  'em_preparo': 'bg-orange-500 text-white',
  'saiu_entrega': 'bg-purple-500 text-white',
  'pronto_retirada': 'bg-purple-500 text-white',
  'finalizado': 'bg-green-500 text-white',
  'cancelado': 'bg-red-500 text-white',
};

export default function AdminOrders() {
  const { tenantSlug = 'default' } = useParams<{ tenantSlug: string }>();
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const settingsRef = useRef<StoreSettings | null>(null); // always holds the latest settings
  const ordersRef = useRef<Order[]>([]); // stable ref for subscription callback reads
  const [printWidth, setPrintWidth] = useState<string>('80mm'); // used in print CSS
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => 
    localStorage.getItem('admin_notifications_enabled') !== 'false'
  );

  // ── Edit Order Modal ────────────────────────────────────────────────────────
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editProducts, setEditProducts] = useState<Product[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Keep ordersRef in sync (used inside subscription callbacks) ─────────
  useEffect(() => { ordersRef.current = orders; }, [orders]);



  // ── Main data-loading useEffect ──────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    fetchOrders();

    supabaseService.getSettings(restaurantId).then(s => {
      setSettings(s);
      settingsRef.current = s;
      if (s?.printerWidth) setPrintWidth(s.printerWidth);
    });
    
    // Unlock audio context on first interaction in this view
    const unlockAudio = () => {
      window.dispatchEvent(new CustomEvent('admin-unlock-audio'));
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    
    // Subscribe to real-time changes
    const subscription = supabaseService.subscribeToOrders(restaurantId, (order, event) => {
      if (event === 'INSERT') {
        setOrders(prev => {
          const exists = prev.some(o => o.id === order.id);
          if (exists) return prev;
          return [order, ...prev];
        });
      } else if (event === 'UPDATE') {
        // Read previous state from ref (safe outside state updater)
        const existing = ordersRef.current.find(o => o.id === order.id);
        const isNewDriverClaim = !existing?.driverName && !!order.driverName;

        if (isNewDriverClaim) {
          toast.success(`🛵 ${order.driverName} aceitou a entrega do pedido ${order.id.slice(0, 6)}!`, {
            duration: 6000,
          });
        }

        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
        if (selectedOrder?.id === order.id) setSelectedOrder(order);
      } else if (event === 'DELETE') {
        setOrders(prev => prev.filter(o => o.id !== order.id));
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, [restaurantId]);

  const fetchOrders = async () => {
    if (!restaurantId) return;
    try {
      const data = await supabaseService.getOrders(restaurantId);
      const sorted = data
        .filter(o => ACTIVE_STATUSES.includes(o.status))  // only active orders
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
      if (!selectedOrder && sorted.length > 0) {
        setSelectedOrder(sorted[0]);
      }
    } catch (error) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const sendStatusNotification = async (order: Order, newStatus: OrderStatus) => {
    let message = '';
    const storeName = settings?.storeName || 'nossa loja';

    const applyVariables = (msg: string) => {
      if (!msg) return '';
      // Create components for address and maps
      const addressString = [order.address, order.neighborhood].filter(Boolean).join(', ') || 'Endereço não informado';
      const mapsQuery = encodeURIComponent(addressString);
      
      const itemsText = order.items
        .map((item: any) => {
          let line = `${item.quantity}x ${item.productName} — ${formatCurrency(item.total)}`;
          if (item.selectedOptions?.length > 0) {
            const opts = item.selectedOptions
              .map((o: any) => `  + ${o.quantity > 1 ? `${o.quantity}x ` : ''}${o.optionName}`)
              .join('\n');
            line += `\n${opts}`;
          }
          return line;
        }).join('\n');
      
      return msg
        .replace('{nome}', order.customerName)
        .replace('{telefone}', order.customerPhone)
        .replace('{pedido}', order.id.slice(0, 8))
        .replace('{total}', formatCurrency(order.total))
        .replace('{loja}', storeName)
        .replace('{endereco}', addressString)
        .replace('{frete}', formatCurrency(order.deliveryFee))
        .replace('{rota}', `https://maps.google.com/?q=${mapsQuery}`)
        .replace('{resumo_pedido}', itemsText);
    };

    switch (newStatus) {
      case 'aceito':
        message = settings?.msg_order_confirmed 
          ? applyVariables(settings.msg_order_confirmed)
          : `Olá ${order.customerName}! Seu pedido na ${storeName} foi confirmado! 🍧`;
        break;
      case 'em_preparo':
        message = settings?.msg_order_preparing
          ? applyVariables(settings.msg_order_preparing)
          : `Seu pedido na ${storeName} já está em preparo! 👨‍🍳`;
        break;
      case 'saiu_entrega':
        message = settings?.msg_order_out_delivery
          ? applyVariables(settings.msg_order_out_delivery)
          : `Ótimas notícias! Seu pedido na ${storeName} saiu para entrega! 🛵`;
        break;
      case 'pronto_retirada':
        message = settings?.msg_order_ready_pickup
          ? applyVariables(settings.msg_order_ready_pickup)
          : `Seu pedido na ${storeName} está pronto para retirada! 🛍️`;
        break;
      case 'finalizado':
        message = settings?.msg_order_finished
          ? applyVariables(settings.msg_order_finished)
          : `Pedido finalizado! Esperamos que goste do seu açaí. Avalie-nos quando puder! ⭐`;
        break;
      case 'cancelado':
        message = settings?.msg_order_cancelled
          ? applyVariables(settings.msg_order_cancelled)
          : `Infelizmente seu pedido na ${storeName} precisou ser cancelado. Entre em contato para mais detalhes.`;
        break;
    }

    if (message) {
      try {
        await whatsappService.sendMessage(tenantSlug, order.customerPhone, message);
        console.log(`WhatsApp notification sent for order ${order.id}`);
      } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
      }
    }

    // --- Notificação para o Entregador Fixo ---
    if (newStatus === 'aceito' && order.deliveryMethod === 'delivery' && restaurantId) {
      try {
        const drivers = await supabaseService.getDeliveryDrivers(restaurantId);
        const activeDrivers = drivers.filter(d => d.active);

        if (activeDrivers.length > 0) {
          const queueMode = settingsRef.current?.driverQueueMode ?? false;

          if (queueMode) {
            // ── Modo Fila: envia link competitivo ──────────────────────────
            const claimUrl = `https://elevare-menu.vercel.app/${tenantSlug}/aceitar/${order.id}`;
            const defaultQueueMsg =
              `🚀 NOVA ENTREGA DISPONÍVEL!\n` +
              `📍 Bairro: {bairro}\n` +
              `💰 Taxa: {frete}\n` +
              `🔗 Clique para garantir: {link_aceite}\n` +
              `(Atenção: O endereço completo só aparece após o aceite no link)`;
            const queueTemplate = settingsRef.current?.msg_delivery_available || defaultQueueMsg;
            const queueMsg = applyVariables(queueTemplate)
              .replace('{bairro}', order.neighborhood || 'Verificar no link')
              .replace('{link_aceite}', claimUrl);

            for (const driver of activeDrivers) {
              await whatsappService.sendMessage(tenantSlug, driver.phone, queueMsg);
              console.log(`[Fila] Link de aceite enviado para ${driver.name} - ${driver.phone}`);
            }
          } else {
            // ── Modo Direto: envia endereço completo imediatamente ─────────
            const defaultDriverMsg = 'Novo pedido disponível! 📦\nEndereço: {endereco}\nValor Frete: {frete}\nLink da Rota: {rota}';
            const driverMsgTemplate = settingsRef.current?.msg_order_delivery_driver || defaultDriverMsg;
            const finalDriverMsg = applyVariables(driverMsgTemplate);

            for (const driver of activeDrivers) {
              await whatsappService.sendMessage(tenantSlug, driver.phone, finalDriverMsg);
              console.log(`[Direto] Notificação enviada para ${driver.name} - ${driver.phone}`);
            }
          }
        }
      } catch (error) {
        console.error('Failed to notify drivers:', error);
      }
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: OrderStatus) => {
    if (updatingStatusId === id) return;
    setUpdatingStatusId(id);
    try {
      const updatedOrder = await supabaseService.updateOrderStatus(id, newStatus);
      
      if (newStatus === 'finalizado' || newStatus === 'cancelado') {
        setOrders(prev => prev.filter(o => o.id !== id));
        setSelectedOrder(null);
        toast.success(`Pedido ${newStatus === 'finalizado' ? 'finalizado' : 'cancelado'} — movido para o Histórico`);
      } else {
        setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
        if (selectedOrder?.id === id) setSelectedOrder(updatedOrder);
        toast.success(`Status atualizado para ${STATUS_LABELS[newStatus]}`);
        
        // Auto-print twice when accepting — always reload settings first to get fresh printerWidth
        if (newStatus === 'aceito') {
          try {
            if (restaurantId) {
              const freshSettings = await supabaseService.getSettings(restaurantId);
              if (freshSettings) {
                setSettings(freshSettings);
                settingsRef.current = freshSettings;
              }
            }
          } catch { /* silently ignore */ }
          // Read printerWidth directly from ref (synchronous — no re-render needed)
          const pw = settingsRef.current?.printerWidth || '80mm';
          console.log('[Impressão] printerWidth =', pw);
          setPrintWidth(pw);
          // Small delay to flush the CSS width state before printing
          setTimeout(() => {
            console.log('Iniciando impressão 1...');
            window.print();
            setTimeout(() => {
              console.log('Iniciando impressão 2...');
              window.print();
            }, 1200);
          }, 300);
        }
      }

      sendStatusNotification(updatedOrder, newStatus);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Limpar: dismiss ALL currently visible orders from view (session-only)
  const handleLimpar = () => {
    const visibleIds = new Set(orders.map(o => o.id));
    setDismissedIds(prev => new Set([...prev, ...visibleIds]));
    setSelectedOrder(null);
    toast.success('Painel limpo! Novos pedidos continuarão aparecendo.');
  };

  const handleRestoreAll = () => {
    setDismissedIds(new Set());
    toast.info('Pedidos restaurados');
  };

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('admin_notifications_enabled', String(newValue));
    // Dispatch custom event to notify AdminLayout
    window.dispatchEvent(new CustomEvent('admin-notifications-toggle', { detail: newValue }));
    
    if (newValue) {
      toast.info('Notificações e som ativados');
    } else {
      toast.info('Notificações e som desativados');
    }
  };

  // ── Edit Order handlers ──────────────────────────────────────────────────────
  const openEditModal = async (order: Order) => {
    setEditingOrder(order);
    setEditItems(order.items.map(i => ({ ...i })));
    setAddProductId('');
    if (restaurantId) {
      try {
        const prods = await supabaseService.getProducts(restaurantId);
        setEditProducts(prods.filter(p => p.active));
      } catch { /* silently ignore */ }
    }
  };

  const handleEditQty = (idx: number, delta: number) => {
    setEditItems(prev => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) return updated.filter((_, i) => i !== idx);
      updated[idx] = { ...updated[idx], quantity: newQty, total: updated[idx].price * newQty };
      return updated;
    });
  };

  const handleEditRemove = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEditAddProduct = () => {
    const product = editProducts.find(p => p.id === addProductId);
    if (!product) return;
    // If already in list (no options), just increment qty
    const existingIdx = editItems.findIndex(i => i.productId === product.id && i.selectedOptions.length === 0);
    if (existingIdx >= 0) {
      setEditItems(prev => {
        const updated = [...prev];
        const q = updated[existingIdx].quantity + 1;
        updated[existingIdx] = { ...updated[existingIdx], quantity: q, total: updated[existingIdx].price * q };
        return updated;
      });
    } else {
      setEditItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
        selectedOptions: [],
      }]);
    }
    setAddProductId('');
  };

  const handleSaveEdit = async () => {
    if (!editingOrder || editItems.length === 0) return;
    setEditSaving(true);
    try {
      const newSubtotal = editItems.reduce((s, i) => s + i.total, 0);
      const newTotal = newSubtotal + editingOrder.deliveryFee - (editingOrder.discount || 0);
      const updated = await supabaseService.updateOrderItems(
        editingOrder.id, editItems, newSubtotal, editingOrder.discount, newTotal
      );
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
      toast.success('Pedido atualizado com sucesso!');
      setEditingOrder(null);
    } catch {
      toast.error('Erro ao salvar pedido. Tente novamente.');
    } finally {
      setEditSaving(false);
    }
  };


  // Filter: active statuses + not dismissed + search term
  const filteredOrders = orders
    .filter(o => !dismissedIds.has(o.id))
    .filter(order => 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getPaymentMethodLabel = (order: Order) => {
    if (order.paymentMethod === 'credit_card') {
      const typeLabel = order.cardSubtype === 'debit' ? 'Débito' : 'Crédito';
      return `Cartão de ${typeLabel}${order.cardFee ? ` (+ ${formatCurrency(order.cardFee)})` : ''}`;
    }
    if (order.paymentMethod === 'dinheiro') {
      if (order.changeFor) {
        const troco = order.changeFor - order.total;
        return `Dinheiro (Troco para ${formatCurrency(order.changeFor)} - Levar ${formatCurrency(troco)} de troco)`;
      }
      return 'Dinheiro (Sem troco)';
    }
    return 'Pix';
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-4">
      {/* Left Column: Order List */}
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filtre por nome, número do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 shadow-sm"
            />
          </div>
          <button
            onClick={dismissedIds.size > 0 ? handleRestoreAll : handleLimpar}
            title={dismissedIds.size > 0 ? 'Mostrar todos' : 'Limpar painel'}
            className={`p-3 rounded-lg border bg-white transition-colors shadow-sm flex-shrink-0 ${
              dismissedIds.size > 0
                ? 'border-purple-200 text-amazii-primary hover:bg-purple-50'
                : 'border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200'
            }`}
          >
            {dismissedIds.size > 0 ? <History className="w-4 h-4" /> : <Eraser className="w-4 h-4" />}
          </button>
          <Link
            to={`/admin/${tenantSlug}/historico-pedidos`}
            title="Ver histórico completo"
            className="p-3 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-amazii-primary hover:border-purple-200 transition-colors shadow-sm flex-shrink-0"
          >
            <History className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {filteredOrders.map((order) => (
            <div 
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={cn(
                "bg-white p-4 rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                order.driverName
                  ? "border-l-4 border-l-blue-500 border-y-blue-100 border-r-blue-100 bg-blue-50/30"
                  : selectedOrder?.id === order.id 
                    ? "border-l-4 border-l-red-500 border-y-gray-200 border-r-gray-200" 
                    : "border-gray-100 border-l-4 border-l-transparent"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-gray-900">Pedido {order.id.slice(0, 8)}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold uppercase",
                  STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
                )}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              
              <div className="text-sm text-gray-500 mb-1">
                {formatDate(order.createdAt)}
              </div>
              
              <div className="font-medium text-gray-800 mb-1">
                {order.customerName}
              </div>
              
              <div className="text-sm text-gray-500">
                {order.customerPhone}
              </div>

              {/* Driver badge — only shown in queue mode after a driver claims */}
              {order.driverName && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded-lg px-2 py-1 w-fit">
                  🛵 {order.driverName}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Order Details */}
      <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 flex flex-col overflow-hidden print:hidden">
        {selectedOrder ? (
          <>
            {/* Header Toolbar */}
            <div className="bg-white p-4 border-b border-gray-200 flex justify-end gap-4">
              <button 
                onClick={toggleNotifications}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  notificationsEnabled ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Bell className={cn("w-4 h-4", notificationsEnabled && "fill-current animate-pulse")} />
                {notificationsEnabled ? 'Notificações habilitadas' : 'Notificações desabilitadas'}
              </button>
              <button 
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" />
                Imprimir pedido
              </button>
              <button
                onClick={() => openEditModal(selectedOrder)}
                className="flex items-center gap-2 text-amazii-primary hover:text-amazii-dark text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar Pedido
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <span className={cn(
                    "px-3 py-1 rounded text-xs font-bold uppercase text-white",
                    selectedOrder.deliveryMethod === 'delivery' ? "bg-green-500" : "bg-blue-500"
                  )}>
                    {selectedOrder.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
                  </span>
                  <span className="font-bold text-lg text-gray-900">
                    Pedido {selectedOrder.id.slice(0, 8)}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {formatDate(selectedOrder.createdAt)}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-gray-900">{selectedOrder.customerName}</h3>
                  <p className="text-gray-600">{selectedOrder.customerPhone}</p>
                  {selectedOrder.deliveryMethod === 'delivery' && (
                    <p className="text-gray-600">
                      {selectedOrder.address} | {selectedOrder.neighborhood}
                    </p>
                  )}
                  {selectedOrder.driverName && (
                    <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                      <span className="text-lg">🛵</span>
                      <div>
                        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Entregador (Modo Fila)</p>
                        <p className="font-bold text-blue-800">{selectedOrder.driverName}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="space-y-4">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                      <div>
                        <div className="font-bold text-gray-900">
                          {item.quantity} x {item.productName}
                        </div>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-sm text-gray-500 pl-4 mt-1 space-y-0.5">
                            {item.selectedOptions.map((opt, i) => (
                              <div key={i}>+ {opt.quantity > 1 ? `${opt.quantity}x ` : ''}{opt.optionName}</div>
                            ))}
                          </div>
                        )}
                        {selectedOrder.observation && idx === selectedOrder.items.length - 1 && (
                          <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
                            <span className="font-bold">Obs:</span> {selectedOrder.observation}
                          </div>
                        )}
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(item.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Entrega:</span>
                    <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto:</span>
                      <span>- {formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  {selectedOrder.cardFee && selectedOrder.cardFee > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Taxa Cartão ({selectedOrder.cardSubtype === 'credit' ? 'Crédito' : 'Débito'}):</span>
                      <span>{formatCurrency(selectedOrder.cardFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    Tipo de pagamento: {getPaymentMethodLabel(selectedOrder)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="grid grid-cols-5 gap-2">
                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'aceito')}
                  disabled={updatingStatusId === selectedOrder.id}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="text-xs font-medium">Aceitar</span>
                </button>
                
                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'em_preparo')}
                  disabled={updatingStatusId === selectedOrder.id}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="text-xs font-medium">Preparo</span>
                </button>

                <button 
                  onClick={() => handleStatusUpdate(
                    selectedOrder.id, 
                    selectedOrder.deliveryMethod === 'delivery' ? 'saiu_entrega' : 'pronto_retirada'
                  )}
                  disabled={updatingStatusId === selectedOrder.id}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckSquare className="w-5 h-5" />
                  <span className="text-xs font-medium">
                    {selectedOrder.deliveryMethod === 'delivery' ? 'Saiu p/ Entrega' : 'Pronto p/ Retirada'}
                  </span>
                </button>

                {/* Removed 'Aguardando' button as requested */}

                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'finalizado')}
                  disabled={updatingStatusId === selectedOrder.id}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="text-xs font-medium">Finalizado</span>
                </button>

                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelado')}
                  disabled={updatingStatusId === selectedOrder.id}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-xs font-medium">Cancelar</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Selecione um pedido para ver os detalhes</p>
            </div>
          </div>
        )}
      </div>

      {/* Printable Receipt (Hidden on screen, visible on print via Portal) */}
      {selectedOrder && createPortal(
        <div id="printable-receipt-container" className="hidden print:block">
          <style type="text/css" media="print">
            {`
              @page {
                margin: 0;
                size: ${printWidth === 'A4' ? 'A4 portrait' : `${printWidth} auto`};
              }
              body > * {
                display: none !important;
              }
              #printable-receipt-container {
                display: block !important;
                position: absolute;
                top: 0;
                left: 0;
                width: ${printWidth === 'A4' ? '210mm' : printWidth} !important;
                margin: 0;
                background-color: white;
              }
            `}
          </style>
          <div 
            className="p-4 text-black font-mono text-sm leading-tight bg-white mx-auto"
            style={{ width: printWidth === 'A4' ? '210mm' : printWidth }}
          >
            <div className="mx-auto">
              <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
                <h1 className="font-bold text-lg uppercase">{settings?.storeName || 'Loja'}</h1>
                <p className="text-xs">Pedido #{selectedOrder.id.slice(0, 8)}</p>
                <p className="text-xs">{formatDate(selectedOrder.createdAt)}</p>
              </div>

              <div className="mb-4 border-b border-black pb-2 border-dashed">
                <p className="font-bold uppercase mb-1">
                  {selectedOrder.deliveryMethod === 'delivery' ? 'ENTREGA' : 'RETIRADA'}
                </p>
                <p className="font-bold">{selectedOrder.customerName}</p>
                <p>{selectedOrder.customerPhone}</p>
                {selectedOrder.deliveryMethod === 'delivery' && (
                  <div className="mt-1">
                    <p>{selectedOrder.address}</p>
                    <p>{selectedOrder.neighborhood}</p>
                  </div>
                )}
              </div>

              <div className="mb-4 border-b border-black pb-2 border-dashed">
                <p className="font-bold mb-2">ITENS</p>
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="flex justify-between">
                      <span>{item.quantity}x {item.productName}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="pl-4 text-xs mt-1">
                        {item.selectedOptions.map((opt, i) => (
                          <div key={i}>+ {opt.quantity > 1 ? `${opt.quantity}x ` : ''}{opt.optionName}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedOrder.observation && (
                <div className="mb-4 border-b border-black pb-2 border-dashed">
                  <p className="font-bold">OBSERVAÇÃO:</p>
                  <p>{selectedOrder.observation}</p>
                </div>
              )}

              <div className="space-y-1 mb-4 border-b border-black pb-2 border-dashed">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entrega</span>
                  <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Desconto</span>
                    <span>- {formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                {selectedOrder.cardFee && selectedOrder.cardFee > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa Cartão</span>
                    <span>{formatCurrency(selectedOrder.cardFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              <div className="text-center text-xs">
                <p>Pagamento: {getPaymentMethodLabel(selectedOrder)}</p>
                <p className="mt-2">Obrigado pela preferência!</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit Order Modal ───────────────────────────────────────────────── */}
      {editingOrder && (() => {
        const editSubtotal = editItems.reduce((s, i) => s + i.total, 0);
        const editTotal = editSubtotal + editingOrder.deliveryFee - (editingOrder.discount || 0);
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setEditingOrder(null)}>
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Editar Pedido #{editingOrder.id.slice(0, 8)}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{editingOrder.customerName} · {editingOrder.customerPhone}</p>
                </div>
                <button onClick={() => setEditingOrder(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {editItems.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">Nenhum item. Adicione produtos abaixo.</p>
                )}
                {editItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.productName}</p>
                      {item.selectedOptions.length > 0 && (
                        <p className="text-xs text-gray-400 truncate">{item.selectedOptions.map(o => o.optionName).join(', ')}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.price)} cada</p>
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleEditQty(idx, -1)}
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-500 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm text-gray-900">{item.quantity}</span>
                      <button
                        onClick={() => handleEditQty(idx, 1)}
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-green-50 hover:border-green-200 hover:text-green-600 text-gray-500 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-16 text-right font-bold text-gray-900 text-sm flex-shrink-0">
                      {formatCurrency(item.total)}
                    </div>
                    <button
                      onClick={() => handleEditRemove(idx)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add Product */}
                <div className="border border-dashed border-gray-200 rounded-xl p-3 mt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Adicionar produto</p>
                  <div className="flex gap-2">
                    <select
                      value={addProductId}
                      onChange={e => setAddProductId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 bg-white"
                    >
                      <option value="">Selecione um produto...</option>
                      {editProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleEditAddProduct}
                      disabled={!addProductId}
                      className="px-4 py-2 bg-amazii-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-amazii-dark transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer: Totals + Save */}
              <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex-shrink-0">
                <div className="space-y-1 mb-4 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(editSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Entrega</span>
                    <span>{formatCurrency(editingOrder.deliveryFee)}</span>
                  </div>
                  {editingOrder.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto</span>
                      <span>– {formatCurrency(editingOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base text-gray-900 pt-1.5 border-t border-gray-200">
                    <span>Total</span>
                    <span>{formatCurrency(editTotal)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving || editItems.length === 0}
                    className="flex-1 py-3 rounded-xl bg-amazii-primary text-white font-semibold hover:bg-amazii-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {editSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                      : <><Save className="w-4 h-4" />Salvar Pedido</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

