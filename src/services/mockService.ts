import { 
  Product, Category, Order, Coupon, StoreSettings 
} from './types';

const STORAGE_KEYS = {
  PRODUCTS: 'amazii_products',
  CATEGORIES: 'amazii_categories',
  ORDERS: 'amazii_orders',
  COUPONS: 'amazii_coupons',
  SETTINGS: 'amazii_settings',
};

class MockService {
  private get<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  private set(key: string, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Products ---
  async getProducts(): Promise<Product[]> {
    return this.get<Product[]>(STORAGE_KEYS.PRODUCTS) || [];
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const products = await this.getProducts();
    return products.find(p => p.id === id);
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const products = await this.getProducts();
    const newProduct = { ...product, id: Math.random().toString(36).substring(2, 9) } as Product;
    this.set(STORAGE_KEYS.PRODUCTS, [...products, newProduct]);
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const products = await this.getProducts();
    const updated = products.map(p => p.id === id ? { ...p, ...updates } : p);
    this.set(STORAGE_KEYS.PRODUCTS, updated);
    return updated.find(p => p.id === id)!;
  }

  async deleteProduct(id: string): Promise<void> {
    const products = await this.getProducts();
    this.set(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
  }

  // --- Categories ---
  async getCategories(): Promise<Category[]> {
    return this.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
  }

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const categories = await this.getCategories();
    const newCategory = { ...category, id: Math.random().toString(36).substring(2, 9) } as Category;
    this.set(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const categories = await this.getCategories();
    const updated = categories.map(c => c.id === id ? { ...c, ...updates } : c);
    this.set(STORAGE_KEYS.CATEGORIES, updated);
    return updated.find(c => c.id === id)!;
  }

  async deleteCategory(id: string): Promise<void> {
    const categories = await this.getCategories();
    this.set(STORAGE_KEYS.CATEGORIES, categories.filter(c => c.id !== id));
  }

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    return this.get<Order[]>(STORAGE_KEYS.ORDERS) || [];
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const orders = await this.getOrders();
    return orders.find(o => o.id === id);
  }

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>, couponCode?: string): Promise<Order> {
    const orders = await this.getOrders();
    const newOrder: Order = {
      ...orderData,
      id: Math.random().toString(36).substring(2, 7).toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'aguardando_pagamento'
    };
    this.set(STORAGE_KEYS.ORDERS, [newOrder, ...orders]);
    
    if (couponCode) {
      await this.incrementCouponUsage(couponCode);
    }

    return newOrder;
  }

  async updateOrderStatus(id: string, status: any): Promise<Order> {
    const orders = await this.getOrders();
    const updated = orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o);
    this.set(STORAGE_KEYS.ORDERS, updated);
    return updated.find(o => o.id === id)!;
  }

  // --- Coupons ---
  async getCoupons(): Promise<Coupon[]> {
    return this.get<Coupon[]>(STORAGE_KEYS.COUPONS) || [];
  }

  async validateCoupon(code: string): Promise<{ coupon: Coupon | null; error?: string }> {
    const coupons = await this.getCoupons();
    const coupon = coupons.find(c => c.code === code && c.active);
    if (!coupon) return { coupon: null, error: 'Cupom não encontrado ou inativo.' };
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return { coupon: null, error: 'Este cupom esgotou o limite de usos.' };
    if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) return { coupon: null, error: 'Este cupom está expirado.' };
    return { coupon };
  }

  async createCoupon(coupon: Omit<Coupon, 'id' | 'usageCount'>): Promise<Coupon> {
    const coupons = await this.getCoupons();
    const newCoupon = { ...coupon, id: Math.random().toString(36).substring(2, 9), usageCount: 0 } as Coupon;
    this.set(STORAGE_KEYS.COUPONS, [...coupons, newCoupon]);
    return newCoupon;
  }

  private async incrementCouponUsage(code: string) {
    const coupons = await this.getCoupons();
    const updated = coupons.map(c => c.code === code ? { ...c, usageCount: (c.usageCount || 0) + 1 } : c);
    this.set(STORAGE_KEYS.COUPONS, updated);
  }

  // --- Settings ---
  async getSettings(): Promise<StoreSettings> {
    const settings = this.get<StoreSettings>(STORAGE_KEYS.SETTINGS);
    if (settings) return settings;

    // Default settings
    const defaultSettings: StoreSettings = {
      storeName: 'Açaí da Villa',
      adminEmail: 'admin@amazii.com',
      adminPassword: 'admin',
      deliveryFeeBase: 5,
      deliveryFeesByNeighborhood: [],
      minOrderValue: 15,
      whatsappNumber: '5500000000000',
      whatsappPrefix: 'Olá! Gostaria de fazer um pedido:',
      deliveryTimeMin: 30,
      deliveryTimeMax: 50,
      allowPickup: true,
      openingHours: {},
      emergencyClosed: false
    };
    this.set(STORAGE_KEYS.SETTINGS, defaultSettings);
    return defaultSettings;
  }

  async updateSettings(settings: StoreSettings): Promise<StoreSettings> {
    this.set(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  }
}

export const mockService = new MockService();
