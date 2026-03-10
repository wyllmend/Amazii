export type ProductOption = {
  id: string;
  name: string;
  price: number;
  available?: boolean;
  active?: boolean;
};

export type ProductOptionGroup = {
  id: string;
  title: string;
  min: number;
  max: number;
  required: boolean;
  available?: boolean;
  active?: boolean;
  options: ProductOption[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  featured: boolean;
  active: boolean;
  available?: boolean;
  optionGroups: ProductOptionGroup[];
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
};

export type OrderStatus = 'aguardando_pagamento' | 'pago' | 'aceito' | 'em_preparo' | 'saiu_entrega' | 'pronto_retirada' | 'finalizado' | 'cancelado';

export type OrderItemOption = {
  groupTitle: string;
  optionName: string;
  price: number;
  quantity: number;
};

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  selectedOptions: OrderItemOption[];
};

export type DeliveryMethod = 'delivery' | 'pickup';

export type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  neighborhood?: string;
  observation?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'pix' | 'credit_card' | 'dinheiro';
  changeFor?: number;
  deliveryMethod: DeliveryMethod;
  customerIp?: string;
  createdAt: string;
  updatedAt: string;
};

export type CouponType = 'percentage' | 'fixed' | 'free_shipping';

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minPurchase?: number;
  expirationDate?: string;
  usageLimit?: number;
  usageCount: number;
  active: boolean;
  firstPurchaseOnly?: boolean;
  usedBy?: string[];
};

export type DeliveryFeeRule = {
  neighborhood: string;
  fee: number;
};

export type OpeningHours = {
  [key: string]: { open: string; close: string; active: boolean };
};

export type Banner = {
  id: string;
  imageUrlMobile: string;
  imageUrlDesktop: string;
  link?: string;
  active: boolean;
};

export type StoreSettings = {
  storeName: string;
  storeLogo?: string;
  storeAddress?: string;
  adminEmail: string; 
  adminPassword: string; 
  deliveryFeeBase: number;
  deliveryFeesByNeighborhood: DeliveryFeeRule[] | null;
  minOrderValue: number;
  whatsappNumber: string;
  whatsappPrefix: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  allowPickup: boolean;
  openingHours: OpeningHours;
  emergencyClosed: boolean;
  primaryColor?: string; 
  secondaryColor?: string; 
  banners?: Banner[]; 
  catalogTitle?: string; 
  catalogSubtitle?: string; 
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
};
