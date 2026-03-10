import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Order, OrderStatus, StoreSettings } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { 
  Search, MessageCircle, Phone, MapPin, User, Store, 
  Printer, Bell, ShoppingCart, CheckSquare, Clock, Bike, ThumbsUp, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { whatsappService } from '@/services/whatsappService';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => 
    localStorage.getItem('admin_notifications_enabled') !== 'false'
  );

  useEffect(() => {
    fetchOrders();
    supabaseService.getSettings().then(setSettings);
    
    // Subscribe to real-time changes
    const subscription = supabaseService.subscribeToOrders((order, event) => {
      if (event === 'INSERT') {
        setOrders(prev => {
          const exists = prev.some(o => o.id === order.id);
          if (exists) return prev;
          return [order, ...prev];
        });
      } else if (event === 'UPDATE') {
        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      } else if (event === 'DELETE') {
        setOrders(prev => prev.filter(o => o.id === order.id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await supabaseService.getOrders();
      // Sort by date desc
      const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
      
      // Select first order if none selected
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

    switch (newStatus) {
      case 'aceito':
        message = `Olá ${order.customerName}! Seu pedido na ${storeName} foi confirmado! 🍧`;
        break;
      case 'em_preparo':
        message = `Seu pedido na ${storeName} já está em preparo! 👨‍🍳`;
        break;
      case 'saiu_entrega':
        message = `Ótimas notícias! Seu pedido na ${storeName} saiu para entrega! 🛵`;
        break;
      case 'pronto_retirada':
        message = `Seu pedido na ${storeName} está pronto para retirada! 🛍️`;
        break;
      case 'finalizado':
        message = `Pedido finalizado! Esperamos que goste do seu açaí. Avalie-nos quando puder! ⭐`;
        break;
      case 'cancelado':
        message = `Infelizmente seu pedido na ${storeName} precisou ser cancelado. Entre em contato para mais detalhes.`;
        break;
    }

    if (message) {
      try {
        await whatsappService.sendMessage(order.customerPhone, message);
        console.log(`WhatsApp notification sent for order ${order.id}`);
      } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
      }
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: OrderStatus) => {
    try {
      const updatedOrder = await supabaseService.updateOrderStatus(id, newStatus);
      setOrders(orders.map(o => o.id === id ? updatedOrder : o));
      if (selectedOrder?.id === id) {
        setSelectedOrder(updatedOrder);
      }
      
      // Send WhatsApp notification
      sendStatusNotification(updatedOrder, newStatus);
      
      toast.success(`Status atualizado para ${STATUS_LABELS[newStatus]}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
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


  const filteredOrders = orders.filter(order => 
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPaymentMethodLabel = (order: Order) => {
    if (order.paymentMethod === 'credit_card') return 'Cartão de Crédito';
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filtre por nome, número do pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 shadow-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {filteredOrders.map((order) => (
            <div 
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={cn(
                "bg-white p-4 rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                selectedOrder?.id === order.id 
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
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'em_preparo')}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="text-xs font-medium">Confirmar</span>
                </button>

                <button 
                  onClick={() => handleStatusUpdate(
                    selectedOrder.id, 
                    selectedOrder.deliveryMethod === 'delivery' ? 'saiu_entrega' : 'pronto_retirada'
                  )}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors"
                >
                  <CheckSquare className="w-5 h-5" />
                  <span className="text-xs font-medium">
                    {selectedOrder.deliveryMethod === 'delivery' ? 'Saiu p/ Entrega' : 'Pronto p/ Retirada'}
                  </span>
                </button>

                {/* Removed 'Aguardando' button as requested */}

                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'finalizado')}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-amazii-primary transition-colors"
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="text-xs font-medium">Finalizado</span>
                </button>

                <button 
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelado')}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-500 transition-colors"
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

      {/* Printable Receipt (Hidden on screen, visible on print) */}
      {selectedOrder && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-4 text-black font-mono text-sm leading-tight">
          <div className="max-w-[300px] mx-auto">
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
      )}
    </div>
  );
}

