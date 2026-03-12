import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '@/services/supabaseService';
import { Product, ProductOption, OrderItemOption } from '@/services/types';
import { useCartStore } from '@/store/cartStore';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, ArrowLeft, Plus, Minus, ShoppingCart, MessageCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, { option: ProductOption; quantity: number }[]>>({});
  const [settings, setSettings] = useState<any>(null);
  
  const restaurantId = useTenantStore((state) => state.restaurantId);

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!id || !restaurantId) return;
    Promise.all([
      supabaseService.getProductById(id, restaurantId),
      supabaseService.getSettings(restaurantId)
    ])
      .then(([prodData, settingsData]) => {
        if (prodData) {
          setProduct(prodData);
        } else {
          toast.error('Produto não encontrado');
          navigate('/');
        }
        setSettings(settingsData);
      })
      .catch(() => toast.error('Erro ao carregar produto'))
      .finally(() => setLoading(false));
  }, [id, restaurantId, navigate]);

  const handleOptionQuantity = (groupId: string, option: ProductOption, delta: number, isMulti: boolean) => {
    setSelectedOptions(prev => {
      const currentGroup = prev[groupId] || [];
      const existingOpt = currentGroup.find(o => o.option.id === option.id);
      
      const group = product?.optionGroups?.find(g => g.id === groupId);
      const totalSelectedInGroup = currentGroup.reduce((sum, o) => sum + o.quantity, 0);

      // If subtracting
      if (delta < 0) {
        if (!existingOpt) return prev;
        if (existingOpt.quantity <= 1) {
          return { ...prev, [groupId]: currentGroup.filter(o => o.option.id !== option.id) };
        }
        return {
          ...prev,
          [groupId]: currentGroup.map(o => o.option.id === option.id ? { ...o, quantity: o.quantity - 1 } : o)
        };
      }

      // If adding
      if (!isMulti) {
        // Radio behavior: replace entire group
        return { ...prev, [groupId]: [{ option, quantity: 1 }] };
      }

      // Check max constraint for multi-select
      if (group && group.max > 0 && totalSelectedInGroup >= group.max) {
        toast.error(`Máximo de ${group.max} itens neste grupo`);
        return prev;
      }

      if (existingOpt) {
        return {
          ...prev,
          [groupId]: currentGroup.map(o => o.option.id === option.id ? { ...o, quantity: o.quantity + 1 } : o)
        };
      }

      return { ...prev, [groupId]: [...currentGroup, { option, quantity: 1 }] };
    });
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const optionsArray = Object.values(selectedOptions).flat() as { option: ProductOption; quantity: number }[];
    const optionsTotal = optionsArray.reduce((s, o) => s + (o.option.price * o.quantity), 0);
    return (product.price + optionsTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (!product) return;
    for (const group of product.optionGroups ?? []) {
      const selected = selectedOptions[group.id] || [];
      const totalQuantity = selected.reduce((sum, o) => sum + o.quantity, 0);
      if (group.required && totalQuantity < group.min) {
        toast.error(`Selecione pelo menos ${group.min} em "${group.title}"`);
        return;
      }
    }
    const orderOptions: OrderItemOption[] = [];
    Object.entries(selectedOptions).forEach(([groupId, items]) => {
      const group = product.optionGroups?.find(g => g.id === groupId);
      if (group && Array.isArray(items)) {
        items.forEach((item: { option: ProductOption; quantity: number }) => {
          orderOptions.push({
            groupTitle: group.title,
            optionName: item.option.name,
            price: item.option.price,
            quantity: item.quantity
          });
        });
      }
    });
    addItem(product, quantity, orderOptions);
    toast.success('Adicionado ao carrinho!');
    navigate('/');
  };

  const handleWhatsApp = () => {
    if (!product || !settings) return;
    const msg = `${settings.whatsappPrefix || 'Olá!'} ${product.name}`;
    window.open(`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  if (!product) return null;

  const hasOptions = (product.optionGroups?.filter(g => g.active !== false) ?? []).length > 0;

  return (
    <div className="max-w-3xl mx-auto pb-40">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-gray-500 hover:text-amazii-primary mb-4 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Product Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Image */}
        <div className="w-full aspect-[4/3] sm:aspect-[16/9] bg-gray-100 relative">
          <img
            src={product.image}
            alt={product.name}
            className={cn("w-full h-full object-cover", product.available === false && "grayscale")}
            referrerPolicy="no-referrer"
          />
          {product.available === false && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-red-600 text-white px-5 py-2 rounded-full text-lg font-bold uppercase shadow-lg transform -rotate-12 border-2 border-white">
                Esgotado
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{product.name}</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">{product.description}</p>
          <div className="text-2xl font-bold text-amazii-primary mb-4">{formatCurrency(product.price)}</div>

          {/* Option Groups */}
          {hasOptions && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              {(product.optionGroups ?? []).filter(g => g.active !== false).map(group => {
                const isAvailable = group.available !== false;
                const selected = selectedOptions[group.id] || [];
                return (
                  <div key={group.id} className={cn(!isAvailable && "opacity-50 pointer-events-none")}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">
                          {group.title}
                          {!isAvailable && <span className="ml-1 text-xs text-red-500">(Indisponível)</span>}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {group.required ? 'Obrigatório' : 'Opcional'} · {group.max > 1 ? `Até ${group.max}` : 'Escolha 1'}
                        </p>
                      </div>
                      {group.required && selected.reduce((s,o)=>s+o.quantity, 0) < group.min && (
                        <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                          Selecione {group.min}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.options.filter(o => o.active !== false).map(option => {
                        const existingSelection = selected.find(s => s.option.id === option.id);
                        const isSelected = !!existingSelection;
                        const optionQuantity = existingSelection?.quantity || 0;
                        const isOptionAvailable = isAvailable && option.available !== false;
                        const isMulti = group.max !== 1;

                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              !isOptionAvailable
                                ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                                : isSelected
                                  ? "border-amazii-primary bg-amazii-muted/30"
                                  : "border-gray-100 hover:border-gray-200"
                            )}
                          >
                            <label className="flex items-center gap-3 cursor-pointer flex-1"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isOptionAvailable) {
                                  if (!isMulti && !isSelected) {
                                    handleOptionQuantity(group.id, option, 1, isMulti);
                                  } else if (!isMulti && isSelected) {
                                    handleOptionQuantity(group.id, option, -1, isMulti);
                                  } else if (isMulti && optionQuantity === 0) {
                                    handleOptionQuantity(group.id, option, 1, isMulti);
                                  }
                                }
                              }}
                            >
                              {!isMulti && (
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                  isSelected ? "border-amazii-primary bg-amazii-primary" : "border-gray-300"
                                )}>
                                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                              )}
                              <span className="text-sm text-gray-800">
                                {option.name}
                                {option.available === false && <span className="ml-1 text-xs text-red-400">(Esgotado)</span>}
                              </span>
                            </label>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              {option.price > 0 && (
                                <span className="text-sm text-gray-500">+ {formatCurrency(option.price)}</span>
                              )}
                              
                              {isMulti && (
                                <div className={cn("flex items-center border rounded-lg overflow-hidden h-8 bg-white transition-colors", isSelected ? "border-amazii-primary/40" : "border-gray-200")}>
                                  <button
                                    disabled={!isOptionAvailable || optionQuantity === 0}
                                    onClick={(e) => { e.preventDefault(); handleOptionQuantity(group.id, option, -1, isMulti); }}
                                    className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className={cn("w-6 text-center text-sm font-bold", isSelected ? "text-amazii-primary" : "text-gray-600")}>{optionQuantity}</span>
                                  <button
                                    disabled={!isOptionAvailable}
                                    onClick={(e) => { e.preventDefault(); handleOptionQuantity(group.id, option, 1, isMulti); }}
                                    className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl px-4 pt-3 pb-6 z-40">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden h-10">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {settings?.whatsappNumber && (
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-2 text-sm text-green-600 font-medium px-3 py-2 rounded-xl border border-green-200 hover:bg-green-50 active:bg-green-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Dúvidas?
              </button>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.available === false}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
              product.available === false
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-amazii-primary text-white shadow-lg shadow-amazii-primary/20"
            )}
          >
            <ShoppingCart className="w-5 h-5" />
            {product.available === false ? 'Indisponível' : `Adicionar · ${formatCurrency(calculateTotal())}`}
          </button>
        </div>
      </div>
    </div>
  );
}
