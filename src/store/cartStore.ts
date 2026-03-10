import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Coupon, OrderItemOption } from '@/services/types';

interface CartItem extends Product {
  cartId: string; // Unique ID for cart item (product + options combination)
  quantity: number;
  selectedOptions: OrderItemOption[];
  totalPrice: number; // Unit price + options price
}

interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  deliveryMethod: 'delivery' | 'pickup';
  addItem: (product: Product, quantity: number, options: OrderItemOption[]) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  applyCoupon: (coupon: Coupon | null) => void;
  setDeliveryMethod: (method: 'delivery' | 'pickup') => void;
  clearCart: () => void;
  subtotal: () => number;
  total: (deliveryFee: number, discount: number) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      deliveryMethod: 'delivery',
      addItem: (product, quantity, options) => {
        const items = get().items;
        
        // Calculate unit price with options (factoring in quantities)
        const optionsPrice = options.reduce((sum, opt) => sum + (opt.price * opt.quantity), 0);
        const totalPrice = product.price + optionsPrice;

        // Generate a unique key based on product ID, sorted options, AND their quantities
        const optionsKey = JSON.stringify(
          [...options].sort((a, b) => a.optionName.localeCompare(b.optionName))
            .map(o => `${o.groupTitle}-${o.optionName}-${o.quantity}`)
        );
        
        const existingItem = items.find(
          (i) => i.id === product.id && 
                 JSON.stringify([...i.selectedOptions].sort((a, b) => a.optionName.localeCompare(b.optionName)).map(o => `${o.groupTitle}-${o.optionName}-${o.quantity}`)) === optionsKey
        );

        if (existingItem) {
          set({
            items: items.map((i) =>
              i.cartId === existingItem.cartId ? { ...i, quantity: i.quantity + quantity } : i
            ),
          });
        } else {
          set({ 
            items: [
              ...items, 
              { 
                ...product, 
                cartId: `${product.id}-${Date.now()}`,
                quantity, 
                selectedOptions: options,
                totalPrice
              }
            ] 
          });
        }
      },
      removeItem: (cartId) => {
        set({ items: get().items.filter((i) => i.cartId !== cartId) });
      },
      updateQuantity: (cartId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.cartId === cartId ? { ...i, quantity } : i
          ),
        });
      },
      applyCoupon: (coupon) => set({ coupon }),
      setDeliveryMethod: (method) => set({ deliveryMethod: method }),
      clearCart: () => set({ items: [], coupon: null }),
      subtotal: () => {
        return get().items.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
      },
      total: (deliveryFee, discount) => {
        const sub = get().subtotal();
        const fee = get().deliveryMethod === 'pickup' ? 0 : deliveryFee;
        return Math.max(0, sub + fee - discount);
      },
    }),
    {
      name: 'amazii-cart',
    }
  )
);
