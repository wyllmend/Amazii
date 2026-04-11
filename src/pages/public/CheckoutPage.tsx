import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCartStore } from '@/store/cartStore';
import { supabaseService } from '@/services/supabaseService';
import { whatsappService } from '@/services/whatsappService';
import { formatCurrency, normalizePhone } from '@/lib/utils';
import { Loader2, CreditCard, QrCode, User, CheckCircle, Store, Bike, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { StoreSettings } from '@/services/types';
import { useTenantStore } from '@/store/tenantStore';

const checkoutSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  phone: z.string().min(10, 'Telefone inválido'),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  street: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  neighborhood: z.string().optional(),
  observation: z.string().optional(),
  paymentMethod: z.enum(['pix', 'credit_card', 'dinheiro']),
  cardSubtype: z.enum(['credit', 'debit']).optional(),
  changeFor: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { items, subtotal, coupon, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [customerIp, setCustomerIp] = useState<string>('');
  
  const restaurantId = useTenantStore((state) => state.restaurantId);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Builds a WhatsApp confirmation message that mirrors the printed receipt. */
  const buildConfirmationMessage = (order: any, storeName: string): string => {
    const trackingUrl = `${window.location.origin}/pedido/${order.id}`;

    const paymentLabel = (() => {
      if (order.paymentMethod === 'credit_card') return `Cartão de ${order.cardSubtype === 'debit' ? 'Débito' : 'Crédito'}`;
      if (order.paymentMethod === 'dinheiro') {
        if (order.changeFor) {
          const troco = order.changeFor - order.total;
          return `Dinheiro (Troco para ${formatCurrency(order.changeFor)} — levar ${formatCurrency(troco)} de troco)`;
        }
        return 'Dinheiro (Sem troco)';
      }
      return 'Pix';
    })();

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
      })
      .join('\n');

    const deliveryLine =
      order.deliveryMethod === 'delivery'
        ? `🛵 *Entrega*\n📍 ${order.address}, ${order.neighborhood}`
        : `🛍️ *Retirada na loja*`;

    let totalsText = `Subtotal: ${formatCurrency(order.subtotal)}\n`;
    if (order.deliveryFee > 0) totalsText += `Entrega: ${formatCurrency(order.deliveryFee)}\n`;
    if (order.discount > 0)    totalsText += `Desconto: - ${formatCurrency(order.discount)}\n`;
    if (order.cardFee > 0)     totalsText += `Taxa Cartão: ${formatCurrency(order.cardFee)}\n`;
    totalsText += `*TOTAL: ${formatCurrency(order.total)}*`;

    const receiptParts = [
      deliveryLine,
      '',
      '*Itens:*',
      itemsText,
      '',
      totalsText,
      `💳 Pagamento: ${paymentLabel}`,
      order.observation ? `📝 Obs: ${order.observation}` : '',
      '',
      `📦 Acompanhe seu pedido:`,
      trackingUrl,
    ].filter(l => l !== null).join('\n');

    let template = settings?.msg_order_received || '✅ *Pedido recebido em {loja}!*\nNº {pedido}\n\n{resumo_pedido}';
    
    if (template.includes('{resumo_pedido}')) {
       template = template.replace('{resumo_pedido}', receiptParts);
    } else {
       template += `\n\n${receiptParts}`;
    }

    return template
        .replace(/{nome}/g, order.customerName || '')
        .replace(/{pedido}/g, order.id.slice(0, 8).toUpperCase())
        .replace(/{total}/g, formatCurrency(order.total))
        .replace(/{loja}/g, storeName)
        .replace(/{endereco}/g, order.address || '')
        .replace(/{frete}/g, formatCurrency(order.deliveryFee || 0));
  };

  useEffect(() => {
    if (!restaurantId) return;
    setSettingsLoading(true);
    supabaseService.getSettings(restaurantId)
      .then(s => {
        setSettings(s);
        setSettingsError(false);
      })
      .catch(() => {
        setSettingsError(true);
        toast.error('Erro ao carregar configurações. Tente recarregar.');
      })
      .finally(() => setSettingsLoading(false));

    // Fetch client IP — non-critical, failure is fine
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setCustomerIp(data?.ip || ''))
      .catch(() => {}); // silently ignore
  }, [restaurantId]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      deliveryMethod: 'delivery',
      paymentMethod: 'pix',
      name: (() => { try { return localStorage.getItem('amazii_customer_name') || ''; } catch { return ''; } })(),
      phone: (() => { try { return localStorage.getItem('amazii_customer_phone') || ''; } catch { return ''; } })(),
    }
  });

  const deliveryMethod = watch('deliveryMethod');
  const selectedNeighborhood = watch('neighborhood');
  const paymentMethod = watch('paymentMethod');

  // Safe accessors — never throw even if settings is null
  const neighborhoods = settings?.deliveryFeesByNeighborhood ?? [];
  const deliveryFeeBase = settings?.deliveryFeeBase ?? 0;
  const allowPickup = settings?.allowPickup ?? false;
  const storeAddress = settings?.storeAddress ?? '';

  const getRawDeliveryFee = (): number | null => {
    if (deliveryMethod === 'pickup') return 0;
    if (selectedNeighborhood && Array.isArray(neighborhoods)) {
      const rule = neighborhoods.find(r => r.neighborhood === selectedNeighborhood);
      if (rule) return rule.fee;
      return deliveryFeeBase; // fallback if neighborhood not found
    }
    return null; // Don't charge base fee before they pick a neighborhood
  };

  const rawFee = getRawDeliveryFee();

  const calculateDiscount = (): number => {
    if (!coupon) return 0;
    const sub = subtotal();
    if (coupon.type === 'percentage') return sub * (coupon.value / 100);
    if (coupon.type === 'fixed') return Math.min(coupon.value, sub);
    if (coupon.type === 'free_shipping') return rawFee ?? 0;
    return 0;
  };

  const discount = calculateDiscount();
  const deliveryFee = coupon?.type === 'free_shipping' ? 0 : rawFee;
  
  const cardSubtype = watch('cardSubtype');
  
  const calculateCardFee = () => {
    if (paymentMethod !== 'credit_card' || !cardSubtype) return 0;
    
    const baseTotal = subtotal() + (deliveryFee ?? 0) - discount;
    
    if (cardSubtype === 'credit' && settings?.creditCardFeeEnabled) {
      if (settings.creditCardFeeType === 'percent') {
        return baseTotal * ((settings.creditCardFeePercent ?? 0) / 100);
      } else {
        return settings.creditCardFeePercent ?? 0;
      }
    }
    
    if (cardSubtype === 'debit' && settings?.debitCardFeeEnabled) {
      if (settings.debitCardFeeType === 'percent') {
        return baseTotal * ((settings.debitCardFeePercent ?? 0) / 100);
      } else {
        return settings.debitCardFeePercent ?? 0;
      }
    }
    return 0;
  };

  const cardFeeAmount = calculateCardFee();
  const finalTotal = Math.max(0, subtotal() + (deliveryFee ?? 0) - discount + cardFeeAmount);

  const onSubmit = async (data: CheckoutForm) => {
    if (loading) return;
    setLoading(true);

    try {
      if (items.length === 0) {
        toast.error('Carrinho vazio');
        return;
      }

      if (data.deliveryMethod === 'delivery') {
        if (!data.street || data.street.length < 3) {
          toast.error('Informe a rua para entrega');
          setLoading(false);
          return;
        }
        if (!data.addressNumber) {
          toast.error('Informe o número para entrega');
          setLoading(false);
          return;
        }
        if (!data.neighborhood) {
          toast.error('Selecione um bairro para entrega');
          setLoading(false);
          return;
        }
        if (deliveryFee === null) {
          toast.error('Não foi possível calcular a taxa de entrega deste bairro.');
          setLoading(false);
          return;
        }
      }

      if (data.paymentMethod === 'credit_card' && !data.cardSubtype) {
        toast.error('Selecione se o cartão é de Crédito ou Débito');
        setLoading(false);
        return;
      }

      const changeForValue = data.changeFor ? Number(data.changeFor) : undefined;

      if (data.paymentMethod === 'dinheiro' && changeForValue && changeForValue < finalTotal) {
        toast.error('O valor do troco deve ser maior que o total do pedido');
        return;
      }

      if (!restaurantId) {
        toast.error('Restaurante não encontrado. Tente recarregar a página.');
        return;
      }

      const isStoreOpen = await supabaseService.isStoreOpen(restaurantId).catch(() => true);
      if (!isStoreOpen) {
        toast.error('A loja está fechada no momento. Tente mais tarde.');
        return;
      }

      const normalizedPhone = normalizePhone(data.phone);

      if (coupon) {
        const result = await supabaseService.validateCoupon(coupon.code, restaurantId, normalizedPhone, customerIp).catch(() => ({ coupon: null, error: 'Erro de conexão' }));
        if (!result || !result.coupon) {
          toast.error(result?.error || 'Cupom inválido');
          return;
        }
      }

      const fullAddress = data.deliveryMethod === 'delivery' 
        ? `${data.street}, ${data.addressNumber}${data.addressComplement ? ` - ${data.addressComplement}` : ''}`
        : undefined;

      const order = await supabaseService.createOrder({
        customerName: data.name,
        customerPhone: normalizedPhone,
        address: fullAddress,
        neighborhood: data.deliveryMethod === 'delivery' ? (data.neighborhood ?? '') : undefined,
        observation: data.observation ?? '',
        items: items.map(i => ({
          productId: i.id,
          productName: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.totalPrice * i.quantity,
          selectedOptions: i.selectedOptions ?? []
        })),
        subtotal: subtotal(),
        deliveryFee: deliveryFee ?? 0,
        discount,
        total: finalTotal,
        paymentMethod: data.paymentMethod,
        cardSubtype: data.cardSubtype,
        cardFee: cardFeeAmount > 0 ? cardFeeAmount : undefined,
        changeFor: data.paymentMethod === 'dinheiro' ? changeForValue : undefined,
        deliveryMethod: data.deliveryMethod,
        customerIp: customerIp || undefined,
      }, restaurantId, coupon?.code);

      try {
        localStorage.setItem('amazii_customer_name', data.name);
        localStorage.setItem('amazii_customer_phone', normalizedPhone);
      } catch { /* localStorage might be blocked in some mobile browsers */ }

      clearCart();
      toast.success('Pedido realizado com sucesso!');

      // Send WhatsApp confirmation to customer (non-blocking)
      try {
        const storeName = settings?.storeName || 'nossa loja';
        const msg = buildConfirmationMessage(order, storeName);
        whatsappService.sendMessage(tenantSlug || 'default', normalizedPhone, msg);
      } catch (err) {
        console.warn('WhatsApp confirmation skipped:', err);
      }

      navigate(`/${tenantSlug}/pedido/${order.id}`);
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    navigate(tenantSlug ? `/${tenantSlug}/carrinho` : '/carrinho');
    return null;
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
        <p className="text-gray-600">Não foi possível carregar as configurações.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-amazii-primary text-white px-6 py-3 rounded-xl font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">Finalizar seu Pedido</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">

          {/* Personal Info */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-amazii-primary" />
              Seus Dados
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                {...register('name')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                placeholder="Ex: João Silva"
                autoComplete="name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
              <input
                {...register('phone')}
                type="tel"
                inputMode="tel"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
          </div>

          {/* Delivery Method */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              {deliveryMethod === 'delivery' ? <Bike className="w-5 h-5 text-amazii-primary" /> : <Store className="w-5 h-5 text-amazii-primary" />}
              Entrega / Retirada
            </h3>

            <div className={`grid gap-4 ${allowPickup ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                deliveryMethod === 'delivery'
                  ? 'border-amazii-primary bg-amazii-muted text-amazii-primary ring-1 ring-amazii-primary'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" value="delivery" {...register('deliveryMethod')} className="sr-only" />
                <Bike className="w-6 h-6" />
                <span className="font-medium text-sm">Entrega</span>
              </label>

              {allowPickup && (
                <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                  deliveryMethod === 'pickup'
                    ? 'border-amazii-primary bg-amazii-muted text-amazii-primary ring-1 ring-amazii-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" value="pickup" {...register('deliveryMethod')} className="sr-only" />
                  <Store className="w-6 h-6" />
                  <span className="font-medium text-sm">Retirada</span>
                </label>
              )}
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <select
                    {...register('neighborhood')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all bg-white text-base"
                  >
                    <option value="">Selecione seu bairro...</option>
                    {Array.isArray(neighborhoods) && neighborhoods.map((rule, idx) => (
                      <option key={idx} value={rule.neighborhood}>
                        {rule.neighborhood} {rule.fee > 0 ? `(+ ${formatCurrency(rule.fee)})` : '(Grátis)'}
                      </option>
                    ))}
                  </select>
                  {errors.neighborhood && <p className="text-red-500 text-xs mt-1">{errors.neighborhood.message}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
                    <input
                      {...register('street')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                      placeholder="Nome da sua rua"
                      autoComplete="street-address"
                    />
                    {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>}
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                    <input
                      {...register('addressNumber')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                      placeholder="Nº"
                    />
                    {errors.addressNumber && <p className="text-red-500 text-xs mt-1">{errors.addressNumber.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complemento (Opcional)</label>
                  <input
                    {...register('addressComplement')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                    placeholder="Apto, Bloco, Casa 2, Ponto de ref..."
                  />
                </div>
              </div>
            )}

            {deliveryMethod === 'pickup' && (
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-start gap-3 bg-amazii-muted p-4 rounded-xl">
                  <Store className="w-5 h-5 text-amazii-primary mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amazii-primary">Retirada na Loja</p>
                    {storeAddress && typeof storeAddress === 'string' && <p className="text-gray-600 mt-1">{storeAddress}</p>}
                    <p className="text-gray-500 mt-1 text-xs">Você será notificado quando o pedido estiver pronto.</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação (Opcional)</label>
              <textarea
                {...register('observation')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                placeholder="Ex: Retirar cebola, campainha não funciona..."
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Payment */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amazii-primary" />
              Pagamento
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'pix', label: 'Pix', icon: <QrCode className="w-5 h-5" />, enabled: settings?.paymentPixEnabled !== false },
                { value: 'credit_card', label: 'Cartão', icon: <CreditCard className="w-5 h-5" />, enabled: (settings?.paymentCreditCardEnabled !== false || settings?.paymentDebitCardEnabled !== false) },
                { value: 'dinheiro', label: 'Dinheiro', icon: <Banknote className="w-5 h-5" />, enabled: settings?.paymentCashEnabled !== false },
              ].filter(opt => opt.enabled).map(opt => (
                <label key={opt.value} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all text-center ${
                  paymentMethod === opt.value
                    ? 'border-amazii-primary bg-amazii-muted text-amazii-primary ring-1 ring-amazii-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" value={opt.value} {...register('paymentMethod')} className="sr-only" />
                  {opt.icon}
                  <span className="font-medium text-xs">{opt.label}</span>
                </label>
              ))}
            </div>

            {paymentMethod === 'credit_card' && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Qual tipo de cartão?</label>
                <div className="grid grid-cols-2 gap-3">
                  {settings?.paymentCreditCardEnabled !== false && (
                    <label className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all text-center ${
                      cardSubtype === 'credit'
                        ? 'border-amazii-primary bg-amazii-muted text-amazii-primary ring-1 ring-amazii-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" value="credit" {...register('cardSubtype')} className="sr-only" />
                      <span className="font-medium text-sm">Crédito</span>
                    </label>
                  )}
                  {settings?.paymentDebitCardEnabled !== false && (
                    <label className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all text-center ${
                      cardSubtype === 'debit'
                        ? 'border-amazii-primary bg-amazii-muted text-amazii-primary ring-1 ring-amazii-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" value="debit" {...register('cardSubtype')} className="sr-only" />
                      <span className="font-medium text-sm">Débito</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'dinheiro' && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Troco para quanto? (Opcional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    {...register('changeFor')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all text-base"
                    placeholder="50,00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
                <span>{formatCurrency(subtotal())}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{deliveryMethod === 'pickup' ? 'Retirada' : 'Entrega'}</span>
                <span>{deliveryMethod === 'pickup' || deliveryFee === 0 ? 'Grátis' : (deliveryFee === null ? 'A calcular' : formatCurrency(deliveryFee))}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-amazii-green font-medium">
                  <span>Desconto {coupon ? `(${coupon.code})` : ''}</span>
                  <span>- {formatCurrency(discount)}</span>
                </div>
              )}
              {cardFeeAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Taxa Cartão ({cardSubtype === 'credit' ? 'Crédito' : 'Débito'})</span>
                  <span>{formatCurrency(cardFeeAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Total</span>
                <span>{deliveryMethod === 'delivery' && deliveryFee === null ? 'A calcular' : formatCurrency(finalTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amazii-primary hover:bg-amazii-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-amazii-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Pedido
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
