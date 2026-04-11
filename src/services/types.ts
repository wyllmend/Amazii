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
  description?: string;
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
  sort_order?: number;
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
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'dinheiro';
  cardSubtype?: 'credit' | 'debit';
  cardFee?: number;
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
  adminEmail?: string; 
  adminPassword?: string; 
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
  catalogTitleColor?: string;
  catalogSubtitle?: string; 
  catalogSubtitleColor?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  creditCardFeeEnabled?: boolean;
  creditCardFeeType?: 'percent' | 'fixed';
  creditCardFeePercent?: number;
  debitCardFeeEnabled?: boolean;
  debitCardFeeType?: 'percent' | 'fixed';
  debitCardFeePercent?: number;
  printerWidth?: '80mm' | '58mm' | 'A4';
  paymentPixEnabled?: boolean;
  paymentCashEnabled?: boolean;
  paymentCreditCardEnabled?: boolean;
  paymentDebitCardEnabled?: boolean;
  msg_order_confirmed?: string;
  msg_order_preparing?: string;
  msg_order_out_delivery?: string;
  msg_order_ready_pickup?: string;
  msg_order_finished?: string;
  msg_order_cancelled?: string;
  msg_order_delivery_driver?: string;
  msg_order_received?: string;
  msg_lead_inactive_3days?: string;
};

export type DeliveryDriver = {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  active: boolean;
  created_at: string;
};
