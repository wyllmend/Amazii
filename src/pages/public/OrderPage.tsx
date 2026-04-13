import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabaseService } from '@/services/supabaseService';
import { Order } from '@/services/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Loader2, CheckCircle, Clock, Package, Truck, XCircle, MapPin, Store, Phone, CreditCard, ArrowRight } from 'lucide-react';

export default function OrderPage() {
  const { id, tenantSlug } = useParams<{ id?: string, tenantSlug?: string }>();
  const baseUrl = tenantSlug ? `/${tenantSlug}` : '/';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const data = await supabaseService.getOrderById(id);
        setOrder(data || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 px-4">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Pedido não encontrado</h2>
        <Link to={baseUrl} className="text-amazii-primary font-medium">Voltar à loja →</Link>
      </div>
    );
  }

  const steps = [
    { key: 'aguardando_pagamento', label: 'Recebido', icon: Clock },
    { key: 'em_preparo', label: 'Preparando', icon: Package },
    order.deliveryMethod === 'delivery'
      ? { key: 'saiu_entrega', label: 'A caminho', icon: Truck }
      : { key: 'pronto_retirada', label: 'Pronto', icon: Package },
    { key: 'finalizado', label: order.deliveryMethod === 'delivery' ? 'Entregue' : 'Retirado', icon: CheckCircle },
  ];

  const currentStep = steps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelado';

  return (
    <div className="max-w-xl mx-auto pb-10 space-y-4">

      {/* Header Card */}
      <div className="bg-amazii-gradient rounded-3xl p-6 text-white text-center">
        <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-90" />
        <h1 className="text-xl font-bold">Pedido #{order.id}</h1>
        <p className="text-white/70 text-sm mt-1">{formatDate(order.createdAt)}</p>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        {isCancelled ? (
          <div className="flex flex-col items-center text-red-500 py-4">
            <XCircle className="w-12 h-12 mb-2" />
            <h2 className="font-bold text-lg">Pedido Cancelado</h2>
          </div>
        ) : (
          <div className="relative flex justify-between items-start">
            <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-100 -z-10" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-amazii-green -z-10 transition-all duration-500"
              style={{ width: `${(Math.max(0, currentStep) / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step, index) => {
              const isActive = index <= currentStep;
              const isCurrent = index === currentStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1 bg-white px-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                    isActive ? "bg-amazii-green text-white" : "bg-gray-100 text-gray-400",
                    isCurrent && "ring-4 ring-green-100 scale-110"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium text-center leading-tight",
                    isActive ? "text-amazii-green" : "text-gray-400"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-amazii-primary" />
          Itens
        </h3>
        <div className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex flex-col text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  <span className="font-bold text-gray-900">{item.quantity}x</span> {item.productName}
                </span>
                <span className="font-medium shrink-0 ml-2">{formatCurrency(item.total)}</span>
              </div>
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <div className="text-xs text-gray-400 pl-5 mt-0.5 space-y-0.5">
                  {item.selectedOptions.map((opt, i) => (
                    <div key={i}>+ {opt.quantity > 1 ? `${opt.quantity}x ` : ''}{opt.optionName}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Entrega</span>
            <span>{order.deliveryFee > 0 ? formatCurrency(order.deliveryFee) : 'Grátis'}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-amazii-green">
              <span>Desconto</span>
              <span>- {formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-1">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Delivery / Contact / Payment */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        {/* Delivery */}
        <div className="flex items-start gap-3">
          {order.deliveryMethod === 'delivery'
            ? <MapPin className="w-4 h-4 text-amazii-primary mt-0.5 shrink-0" />
            : <Store className="w-4 h-4 text-amazii-primary mt-0.5 shrink-0" />
          }
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">
              {order.deliveryMethod === 'delivery' ? 'Endereço' : 'Retirada'}
            </p>
            <p className="text-sm text-gray-700 mt-0.5">
              {order.deliveryMethod === 'delivery'
                ? [order.address, order.neighborhood].filter(Boolean).join(', ') || '—'
                : 'Retirada na loja'
              }
            </p>
            {order.observation && (
              <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg mt-1 border border-yellow-100">
                Obs: {order.observation}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Contact */}
        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-amazii-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Contato</p>
            <p className="text-sm text-gray-700 mt-0.5">{order.customerName}</p>
            <p className="text-sm text-gray-500">{order.customerPhone}</p>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Payment */}
        <div className="flex items-start gap-3">
          <CreditCard className="w-4 h-4 text-amazii-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Pagamento</p>
            <p className="text-sm text-gray-700 mt-0.5">
              {order.paymentMethod === 'credit_card' && 'Cartão de Crédito'}
              {order.paymentMethod === 'pix' && 'Pix'}
              {order.paymentMethod === 'dinheiro' && (
                order.changeFor
                  ? `Dinheiro (Troco para ${formatCurrency(order.changeFor)})`
                  : 'Dinheiro (Sem troco)'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <a
          href={baseUrl}
          className="inline-flex items-center gap-2 bg-amazii-primary text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-amazii-primary/20 transition-all active:scale-[0.98]"
        >
          Fazer outro pedido
          <ArrowRight className="w-4 h-4" />
        </a>
        <p className="text-gray-400 text-xs mt-3">Atualiza automaticamente a cada 5s</p>
      </div>
    </div>
  );
}
