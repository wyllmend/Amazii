import { supabase } from '../lib/supabase';
import { 
  Product, Category, Order, Coupon, StoreSettings, 
  OrderStatus, OrderItem 
} from './types';
import { normalizePhone } from '@/lib/utils';

class SupabaseService {
  private orderListeners: Array<(order: Order, event: 'INSERT' | 'UPDATE' | 'DELETE') => void> = [];
  private orderChannel: any = null;

  // --- Products ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(p => ({
      ...p,
      categoryId: p.category_id,
      optionGroups: p.option_groups
    }));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return undefined;
    if (!data) return undefined;

    return {
      ...data,
      categoryId: data.category_id,
      optionGroups: data.option_groups
    };
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        category_id: product.categoryId,
        featured: product.featured,
        active: product.active,
        available: product.available,
        option_groups: product.optionGroups
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      categoryId: data.category_id,
      optionGroups: data.option_groups
    };
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const payload: any = { ...updates };
    if (updates.categoryId) {
      payload.category_id = updates.categoryId;
      delete payload.categoryId;
    }
    if (updates.optionGroups) {
      payload.option_groups = updates.optionGroups;
      delete payload.optionGroups;
    }

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      categoryId: data.category_id,
      optionGroups: data.option_groups
    };
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // --- Categories ---
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // --- Orders ---
  private mapOrder(o: any): Order {
    return {
      ...o,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      paymentMethod: o.payment_method,
      deliveryMethod: o.delivery_method,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      changeFor: o.change_for,
      customerIp: o.customer_ip,
      deliveryFee: o.delivery_fee
    };
  }

  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(o => this.mapOrder(o));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return undefined;
    return this.mapOrder(data);
  }

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>, couponCode?: string): Promise<Order> {
    const normalizedPhone = normalizePhone(orderData.customerPhone);
    const shortId = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const { data, error } = await supabase
      .from('orders')
      .insert({
        id: shortId,
        customer_name: orderData.customerName,
        customer_phone: normalizedPhone,
        address: orderData.address ?? null,
        neighborhood: orderData.neighborhood ?? null,
        observation: orderData.observation ?? null,
        items: orderData.items,
        subtotal: orderData.subtotal,
        delivery_fee: orderData.deliveryFee,
        discount: orderData.discount,
        total: orderData.total,
        status: 'aguardando_pagamento',
        payment_method: orderData.paymentMethod,
        change_for: orderData.changeFor ?? null,
        delivery_method: orderData.deliveryMethod,
        customer_ip: orderData.customerIp ?? null
      })
      .select()
      .single();

    if (error) throw error;

    // Update coupon usage if applicable
    if (couponCode) {
      await this.incrementCouponUsage(couponCode, orderData.customerPhone);
    }

    return this.mapOrder(data);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapOrder(data);
  }

  subscribeToOrders(callback: (order: Order, event: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    this.orderListeners.push(callback);

    if (!this.orderChannel) {
      this.orderChannel = supabase
        .channel('orders-global')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('Realtime event received:', payload.eventType, (payload.new as any)?.id);
            const mappedOrder = this.mapOrder(payload.new || payload.old);
            this.orderListeners.forEach(listener => listener(mappedOrder, payload.eventType as any));
          }
        )
        .subscribe((status) => {
          console.log('Supabase Realtime Status:', status);
        });
    }

    return {
      unsubscribe: () => {
        this.orderListeners = this.orderListeners.filter(l => l !== callback);
        if (this.orderListeners.length === 0 && this.orderChannel) {
          this.orderChannel.unsubscribe();
          this.orderChannel = null;
        }
      }
    };
  }

  // --- Coupons ---
  async getCoupons(): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(c => ({
      ...c,
      expirationDate: c.expiration_date,
      usageLimit: c.usage_limit,
      usageCount: c.usage_count,
      firstPurchaseOnly: c.first_purchase_only,
      usedBy: c.used_by
    }));
  }

  async validateCoupon(code: string, customerPhone?: string, customerIp?: string): Promise<Coupon | null> {
    const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : undefined;
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('active', true)
      .single();

    if (error || !coupon) return null;

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) return null;
    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) return null;

    if (coupon.first_purchase_only) {
      // Check phone if provided
      if (normalizedPhone) {
        const { count: phoneCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_phone', normalizedPhone)
          .neq('status', 'cancelado');
        if (phoneCount && phoneCount > 0) return null;
      }

      // Check IP if provided
      if (customerIp) {
        const { count: ipCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_ip', customerIp)
          .neq('status', 'cancelado');
        if (ipCount && ipCount > 0) return null;
      }
    }

    if (normalizedPhone && coupon.used_by?.includes(normalizedPhone)) {
      return null;
    }

    return {
      ...coupon,
      expirationDate: coupon.expiration_date,
      usageLimit: coupon.usage_limit,
      usageCount: coupon.usage_count,
      firstPurchaseOnly: coupon.first_purchase_only,
      usedBy: coupon.used_by
    };
  }

  async createCoupon(coupon: Omit<Coupon, 'id' | 'usageCount'>): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        min_purchase: coupon.minPurchase,
        expiration_date: coupon.expirationDate,
        usage_limit: coupon.usageLimit,
        active: coupon.active,
        first_purchase_only: coupon.firstPurchaseOnly
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      expirationDate: data.expiration_date,
      usageLimit: data.usage_limit,
      usageCount: data.usage_count,
      firstPurchaseOnly: data.first_purchase_only,
      usedBy: data.used_by
    };
  }

  private async incrementCouponUsage(code: string, customerPhone: string) {
    const normalizedPhone = normalizePhone(customerPhone);
    const { data: coupon } = await supabase
      .from('coupons')
      .select('usage_count, used_by')
      .eq('code', code)
      .single();
    
    if (coupon) {
      await supabase
        .from('coupons')
        .update({
          usage_count: (coupon.usage_count || 0) + 1,
          used_by: [...(coupon.used_by || []), normalizedPhone]
        })
        .eq('code', code);
    }
  }

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    const payload: any = { ...updates };
    if (updates.expirationDate) {
      payload.expiration_date = updates.expirationDate;
      delete payload.expirationDate;
    }
    if (updates.usageLimit) {
      payload.usage_limit = updates.usageLimit;
      delete payload.usageLimit;
    }
    if (updates.firstPurchaseOnly) {
      payload.first_purchase_only = updates.firstPurchaseOnly;
      delete payload.firstPurchaseOnly;
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      expirationDate: data.expiration_date,
      usageLimit: data.usage_limit,
      usageCount: data.usage_count,
      firstPurchaseOnly: data.first_purchase_only,
      usedBy: data.used_by
    };
  }

  async deleteCoupon(id: string): Promise<void> {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // --- Settings ---
  async getSettings(): Promise<StoreSettings> {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    
    return {
      storeName: data.store_name,
      storeLogo: data.store_logo,
      storeAddress: data.store_address,
      adminEmail: data.admin_email,
      adminPassword: data.admin_password,
      deliveryFeeBase: data.delivery_fee_base,
      deliveryFeesByNeighborhood: data.delivery_fees_by_neighborhood,
      minOrderValue: data.min_order_value,
      whatsappNumber: data.whatsapp_number,
      whatsappPrefix: data.whatsapp_prefix,
      deliveryTimeMin: data.delivery_time_min,
      deliveryTimeMax: data.delivery_time_max,
      allowPickup: data.allow_pickup,
      openingHours: data.opening_hours,
      emergencyClosed: data.emergency_closed,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      banners: data.banners,
      catalogTitle: data.catalog_title,
      catalogSubtitle: data.catalog_subtitle,
      socialLinks: data.social_links
    };
  }

  async updateSettings(settings: StoreSettings): Promise<StoreSettings> {
    const { data, error } = await supabase
      .from('store_settings')
      .upsert({
        id: 1,
        store_name: settings.storeName,
        store_logo: settings.storeLogo,
        store_address: settings.storeAddress,
        admin_email: settings.adminEmail,
        admin_password: settings.adminPassword,
        delivery_fee_base: settings.deliveryFeeBase,
        delivery_fees_by_neighborhood: settings.deliveryFeesByNeighborhood,
        min_order_value: settings.minOrderValue,
        whatsapp_number: settings.whatsappNumber,
        whatsapp_prefix: settings.whatsappPrefix,
        delivery_time_min: settings.deliveryTimeMin,
        delivery_time_max: settings.deliveryTimeMax,
        allow_pickup: settings.allowPickup,
        opening_hours: settings.openingHours,
        emergency_closed: settings.emergencyClosed,
        primary_color: settings.primaryColor,
        secondary_color: settings.secondaryColor,
        banners: settings.banners,
        catalog_title: settings.catalogTitle,
        catalog_subtitle: settings.catalogSubtitle,
        social_links: settings.socialLinks,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase updateSettings Error:', error);
      throw error;
    }
    
    return {
      storeName: data.store_name,
      storeLogo: data.store_logo,
      storeAddress: data.store_address,
      adminEmail: data.admin_email,
      adminPassword: data.admin_password,
      deliveryFeeBase: data.delivery_fee_base,
      deliveryFeesByNeighborhood: data.delivery_fees_by_neighborhood,
      minOrderValue: data.min_order_value,
      whatsappNumber: data.whatsapp_number,
      whatsappPrefix: data.whatsapp_prefix,
      deliveryTimeMin: data.delivery_time_min,
      deliveryTimeMax: data.delivery_time_max,
      allowPickup: data.allow_pickup,
      openingHours: data.opening_hours,
      emergencyClosed: data.emergency_closed,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      banners: data.banners,
      catalogTitle: data.catalog_title,
      catalogSubtitle: data.catalog_subtitle,
      socialLinks: data.social_links
    };
  }

  // --- Auth ---
  async isAuthenticated(): Promise<boolean> {
    const isAdmin = localStorage.getItem('amazii_admin_logged') === 'true';
    if (isAdmin) return true;
    
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  async loginAdmin(email: string, pass: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (email === settings.adminEmail && pass === settings.adminPassword) {
      localStorage.setItem('amazii_admin_logged', 'true');
      return true;
    }
    return false;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('amazii_admin_logged');
    await supabase.auth.signOut();
  }

  async logoutAdmin(): Promise<void> {
    await this.logout();
  }

  // --- Helpers ---
  async getDeliveryFee(neighborhood: string): Promise<number> {
    const settings = await this.getSettings();
    const rule = settings.deliveryFeesByNeighborhood?.find(
      r => r.neighborhood.toLowerCase() === neighborhood.toLowerCase()
    );
    return rule ? rule.fee : settings.deliveryFeeBase;
  }

  async isStoreOpen(): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      if (!settings || !settings.openingHours) return false;
      if (settings.emergencyClosed) return false;

      const now = new Date();
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const daySettings = settings.openingHours[dayName];

      if (!daySettings || !daySettings.active) return false;

      const [openH, openM] = daySettings.open.split(':').map(Number);
      const [closeH, closeM] = daySettings.close.split(':').map(Number);

      const openTime = new Date(now);
      openTime.setHours(openH, openM, 0, 0);

      const closeTime = new Date(now);
      closeTime.setHours(closeH, closeM, 0, 0);

      // Handle closing hours past midnight
      if (closeTime < openTime) {
        closeTime.setDate(closeTime.getDate() + 1);
      }

      return now >= openTime && now <= closeTime;
    } catch (error) {
      console.error('Error checking store status:', error);
      return false;
    }
  }

  async clearOrders(): Promise<void> {
    const { error } = await supabase.from('orders').delete().neq('id', ''); // Delete all
    if (error) throw error;
  }

  // --- Upload ---
  async uploadFile(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('amazii-assets')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('amazii-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  }
}

export const supabaseService = new SupabaseService();
