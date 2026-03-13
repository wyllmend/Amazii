import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { supabaseService } from '@/services/supabaseService';
import { formatCurrency } from '@/lib/utils';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useTenantStore } from '@/store/tenantStore';

export default function CartPage() {
  const navigate = useNavigate();
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const tenantSlug = useTenantStore((state) => state.slug);
  const { items, removeItem, updateQuantity, coupon, applyCoupon, subtotal, total } = useCartStore();
  const [couponCode, setCouponCode] = useState('');
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  const [settings, setSettings] = useState<{ deliveryFeeBase: number } | null>(null);
  const [customerIp, setCustomerIp] = useState('');

  useEffect(() => {
    if (!restaurantId) return;
    supabaseService.getSettings(restaurantId)
      .then(s => setSettings(s))
      .catch(() => {});
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => setCustomerIp(d?.ip || ''))
      .catch(() => {});
  }, []);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code || !restaurantId) return;
    setLoadingCoupon(true);
    try {
      const result = await supabaseService.validateCoupon(code, restaurantId, undefined, customerIp);
      if (result.coupon) {
        applyCoupon(result.coupon);
        toast.success('Cupom aplicado!');
        setCouponCode('');
      } else {
        toast.error(result.error || 'Cupom inválido ou expirado');
        applyCoupon(null);
      }
    } catch {
      toast.error('Erro ao validar cupom');
    } finally {
      setLoadingCoupon(false);
    }
  };

  const calculateDiscount = () => {
    if (!coupon) return 0;
    const sub = subtotal();
    if (coupon.type === 'percentage') return sub * (coupon.value / 100);
    if (coupon.type === 'fixed') return Math.min(coupon.value, sub);
    if (coupon.type === 'free_shipping') return settings?.deliveryFeeBase ?? 0;
    return 0;
  };

  const discount = calculateDiscount();
  const finalTotal = total(0, discount);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
          <ShoppingCart className="w-9 h-9 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Carrinho vazio</h2>
        <p className="text-gray-400 text-sm mb-7">Adicione produtos para continuar.</p>
        <Link
          to={tenantSlug ? `/${tenantSlug}` : '/'}
          className="bg-amazii-primary text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-amazii-primary/20 active:scale-[0.98] transition-all"
        >
          Ver Cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-40">
      <h1 className="text-xl font-bold mb-4">Seu Carrinho</h1>

      {/* Items */}
      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.cartId} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex gap-3 p-3">
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-16 object-cover rounded-xl bg-gray-100 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 leading-snug">{item.name}</h3>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.selectedOptions.map(o => o.quantity > 1 ? `${o.quantity}x ${o.optionName}` : o.optionName).join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.cartId)}
                  className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden h-8">
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                    className="w-8 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                    className="w-8 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-bold text-sm text-gray-900">
                  {formatCurrency(item.totalPrice * item.quantity)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Cupom de desconto</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
              placeholder="CÓDIGO"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 uppercase"
            />
          </div>
          <button
            onClick={handleApplyCoupon}
            disabled={loadingCoupon || !couponCode}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors active:scale-[0.98]"
          >
            Aplicar
          </button>
        </div>
        {coupon && (
          <div className="mt-2 flex items-center justify-between text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg">
            <span>✓ Cupom <strong>{coupon.code}</strong> aplicado!</span>
            <button onClick={() => applyCoupon(null)} className="text-red-500 font-medium">Remover</button>
          </div>
        )}
      </div>

      {/* Summary — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl px-4 pt-4 pb-6 z-40">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal())}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Entrega</span>
            <span className="text-xs">Calculado no checkout</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-amazii-green font-medium">
              <span>Desconto</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
            <span>Total estimado</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
          <button
            onClick={() => navigate(tenantSlug ? `/${tenantSlug}/checkout` : '/checkout')}
            className="w-full bg-amazii-primary hover:bg-amazii-dark text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-amazii-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
          >
            Finalizar Compra
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
