import { supabase } from '../lib/supabase';
import { 
  Product, Category, Order, Coupon, StoreSettings, 
  OrderStatus, OrderItem 
} from './types';
import { normalizePhone } from '@/lib/utils';

class SupabaseService {
  private orderListeners: Array<(order: Order, event: 'INSERT' | 'UPDATE' | 'DELETE') => void> = [];
  private orderChannel: any = null;

  // --- Tenants ---
  async getRestaurantBySlug(slug: string): Promise<{ id: string, name: string, active: boolean } | null> {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, active')
      .eq('slug', slug)
      .single();
    
    if (error || !data) return null;
    return data;
  }

  // --- Products ---
  async getProducts(restaurantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(p => ({
      ...p,
      categoryId: p.category_id,
      optionGroups: p.option_groups
    }));
  }

  async getProductById(id: string, restaurantId?: string): Promise<Product | undefined> {
    let query = supabase
      .from('products')
      .select('*')
      .eq('id', id);
      
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    
    const { data, error } = await query.single();

    if (error) return undefined;
    if (!data) return undefined;

    return {
      ...data,
      categoryId: data.category_id,
      optionGroups: data.option_groups
    };
  }

  async createProduct(product: Omit<Product, 'id'>, restaurantId: string): Promise<Product> {
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
        option_groups: product.optionGroups,
        restaurant_id: restaurantId
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
  async getCategories(restaurantId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async updateCategoryOrder(orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({ id, sort_order: index + 1 }));
    for (const update of updates) {
      const { error } = await supabase
        .from('categories')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
      if (error) throw error;
    }
  }

  async createCategory(category: Omit<Category, 'id'>, restaurantId: string): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...category, restaurant_id: restaurantId })
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
      deliveryFee: o.delivery_fee,
      cardSubtype: o.card_subtype,
      cardFee: o.card_fee,
      driverName: o.driver_name ?? null,
      driverPhone: o.driver_phone ?? null,
      driverClaimedAt: o.driver_claimed_at ?? null,
    };
  }

  async getOrders(restaurantId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(o => this.mapOrder(o));
  }

  async getOrderById(id: string, restaurantId?: string): Promise<Order | undefined> {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('id', id);

    if (restaurantId) query = query.eq('restaurant_id', restaurantId);

    const { data, error } = await query.single();

    if (error) return undefined;
    return this.mapOrder(data);
  }

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>, restaurantId: string, couponCode?: string): Promise<Order> {
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
        customer_ip: orderData.customerIp ?? null,
        card_subtype: orderData.cardSubtype ?? null,
        card_fee: orderData.cardFee ?? null,
        restaurant_id: restaurantId
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

  async updateOrderItems(id: string, items: OrderItem[], subtotal: number, discount: number, total: number): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({ items, subtotal, discount, total, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapOrder(data);
  }

  subscribeToOrders(restaurantId: string, callback: (order: Order, event: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    this.orderListeners.push(callback);

    if (!this.orderChannel) {
      this.orderChannel = supabase
        .channel(`orders-${restaurantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
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
  async getCoupons(restaurantId: string): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('restaurant_id', restaurantId)
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

  async validateCoupon(code: string, restaurantId: string, customerPhone?: string, customerIp?: string): Promise<{ coupon: Coupon | null; error?: string }> {
    const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : undefined;
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .single();

    if (error || !coupon) return { coupon: null, error: 'Cupom não encontrado ou inativo.' };

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) return { coupon: null, error: 'Este cupom atingiu o limite máximo de usos.' };
    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) return { coupon: null, error: 'Este cupom está expirado.' };

    if (coupon.first_purchase_only) {
      // Check phone if provided
      if (normalizedPhone) {
        const { count: phoneCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_phone', normalizedPhone)
          .neq('status', 'cancelado');
        if (phoneCount && phoneCount > 0) return { coupon: null, error: 'Este cupom é válido apenas para a primeira compra.' };
      }

      // Check IP if provided
      if (customerIp) {
        const { count: ipCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_ip', customerIp)
          .neq('status', 'cancelado');
        if (ipCount && ipCount > 0) return { coupon: null, error: 'Este cupom é válido apenas para a primeira compra no seu dispositivo.' };
      }
    }

    if (normalizedPhone && coupon.used_by?.includes(normalizedPhone)) {
      return { coupon: null, error: 'Você já utilizou este cupom anteriormente.' };
    }

    return {
      coupon: {
        ...coupon,
        expirationDate: coupon.expiration_date,
        usageLimit: coupon.usage_limit,
        usageCount: coupon.usage_count,
        firstPurchaseOnly: coupon.first_purchase_only,
        usedBy: coupon.used_by
      }
    };
  }

  async createCoupon(coupon: Omit<Coupon, 'id' | 'usageCount'>, restaurantId: string): Promise<Coupon> {
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
        first_purchase_only: coupon.firstPurchaseOnly,
        restaurant_id: restaurantId
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

  private async incrementCouponUsage(code: string, customerPhone: string, restaurantId?: string) {
    const normalizedPhone = normalizePhone(customerPhone);
    let query = supabase
      .from('coupons')
      .select('id, usage_count, used_by')
      .eq('code', code);
      
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    
    const { data: coupon } = await query.single();
    
    if (coupon) {
      await supabase
        .from('coupons')
        .update({
          usage_count: (coupon.usage_count || 0) + 1,
          used_by: [...(coupon.used_by || []), normalizedPhone]
        })
        .eq('id', coupon.id);
    }
  }

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    const payload: any = { ...updates };
    if ('expirationDate' in updates) {
      if (updates.expirationDate !== undefined) payload.expiration_date = updates.expirationDate;
      else payload.expiration_date = null;
      delete payload.expirationDate;
    }
    if ('usageLimit' in updates) {
      if (updates.usageLimit !== undefined) payload.usage_limit = updates.usageLimit;
      else payload.usage_limit = null;
      delete payload.usageLimit;
    }
    if ('firstPurchaseOnly' in updates) {
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

  // --- Delivery Drivers ---
  async getDeliveryDrivers(restaurantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (error) throw error;
    return data || [];
  }

  async createDeliveryDriver(driver: any): Promise<any> {
    const { data, error } = await supabase
      .from('delivery_drivers')
      .insert(driver)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateDeliveryDriver(id: string, updates: any): Promise<any> {
    const { data, error } = await supabase
      .from('delivery_drivers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDeliveryDriver(id: string): Promise<void> {
    const { error } = await supabase.from('delivery_drivers').delete().eq('id', id);
    if (error) throw error;
  }

  /**
   * Reads safe (non-sensitive) order data without authentication.
   * Uses the get_order_public RPC (SECURITY DEFINER) to bypass RLS.
   * Returns neighborhood + fee before claim; does NOT reveal address/phone.
   */
  async getOrderPublic(orderId: string): Promise<{
    found: boolean;
    id?: string;
    neighborhood?: string;
    deliveryFee?: number;
    driverName?: string | null;
    driverClaimedAt?: string | null;
    status?: string;
    claimable?: boolean;
    // Full details — populated when order is already claimed
    customerName?: string;
    customerPhone?: string;
    address?: string;
    items?: any[];
    observation?: string;
  }> {
    const { data, error } = await supabase.rpc('get_order_public', { p_order_id: orderId });
    if (error) throw error;
    if (!data?.found) return { found: false };
    return {
      found: true,
      id: data.id,
      neighborhood: data.neighborhood,
      deliveryFee: Number(data.delivery_fee),
      driverName: data.driver_name ?? null,
      driverClaimedAt: data.driver_claimed_at ?? null,
      status: data.status,
      claimable: data.claimable,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      address: data.address,
      items: data.items,
      observation: data.observation,
    };
  }

  /**
   * Atomically claims a delivery for a driver.
   * The PostgreSQL RPC guarantees only ONE driver can win the race.
   * Uses claim_delivery RPC (SECURITY DEFINER) to bypass RLS.
   */
  async claimDelivery(orderId: string, driverName: string, driverPhone: string): Promise<{
    success: boolean;
    claimedBy?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    neighborhood?: string;
    deliveryFee?: number;
    observation?: string;
    items?: any[];
    driverPhone?: string;
  }> {
    const { data, error } = await supabase.rpc('claim_delivery', {
      p_order_id:     orderId,
      p_driver_name:  driverName,
      p_driver_phone: driverPhone,
    });
    if (error) throw error;
    if (!data.success) {
      return { success: false, claimedBy: data.claimed_by };
    }
    return {
      success: true,
      customerName:  data.customer_name,
      customerPhone: data.customer_phone,
      address:       data.address,
      neighborhood:  data.neighborhood,
      deliveryFee:   Number(data.delivery_fee),
      observation:   data.observation,
      items:         data.items ?? [],
      driverPhone:   data.driver_phone,
    };
  }

  // --- Settings ---
  async getSettings(restaurantId: string): Promise<StoreSettings | null> {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    
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
      catalogTitleColor: data.catalog_title_color,
      catalogSubtitle: data.catalog_subtitle,
      catalogSubtitleColor: data.catalog_subtitle_color,
      socialLinks: data.social_links,
      creditCardFeeEnabled: data.credit_card_fee_enabled,
      creditCardFeeType: data.credit_card_fee_type,
      creditCardFeePercent: data.credit_card_fee_percent,
      debitCardFeeEnabled: data.debit_card_fee_enabled,
      debitCardFeeType: data.debit_card_fee_type,
      debitCardFeePercent: data.debit_card_fee_percent,
      printerWidth: data.printer_width,
      paymentPixEnabled: data.payment_pix_enabled,
      paymentCashEnabled: data.payment_cash_enabled,
      paymentCreditCardEnabled: data.payment_credit_card_enabled,
      paymentDebitCardEnabled: data.payment_debit_card_enabled,
      msg_order_confirmed: data.msg_order_confirmed,
      msg_order_preparing: data.msg_order_preparing,
      msg_order_out_delivery: data.msg_order_out_delivery,
      msg_order_ready_pickup: data.msg_order_ready_pickup,
      msg_order_finished: data.msg_order_finished,
      msg_order_cancelled: data.msg_order_cancelled,
      msg_order_delivery_driver: data.msg_order_delivery_driver,
      msg_order_received: data.msg_order_received,
      msg_lead_inactive_3days: data.msg_lead_inactive_3days,
      driverQueueMode: data.driver_queue_mode ?? false,
    };
  }

  async updateSettings(settings: StoreSettings, restaurantId: string): Promise<StoreSettings> {
    // First find the existing setting id for this restaurant
    const existing = await supabase
      .from('store_settings')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .single();
      
    const payload = {
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
        catalog_title_color: settings.catalogTitleColor,
        catalog_subtitle: settings.catalogSubtitle,
        catalog_subtitle_color: settings.catalogSubtitleColor,
        social_links: settings.socialLinks,
        credit_card_fee_enabled: settings.creditCardFeeEnabled,
        credit_card_fee_type: settings.creditCardFeeType,
        credit_card_fee_percent: settings.creditCardFeePercent,
        debit_card_fee_enabled: settings.debitCardFeeEnabled,
        debit_card_fee_type: settings.debitCardFeeType,
        debit_card_fee_percent: settings.debitCardFeePercent,
        printer_width: settings.printerWidth,
        payment_pix_enabled: settings.paymentPixEnabled,
        payment_cash_enabled: settings.paymentCashEnabled,
        payment_credit_card_enabled: settings.paymentCreditCardEnabled,
        payment_debit_card_enabled: settings.paymentDebitCardEnabled,
        msg_order_confirmed: settings.msg_order_confirmed,
        msg_order_preparing: settings.msg_order_preparing,
        msg_order_out_delivery: settings.msg_order_out_delivery,
        msg_order_ready_pickup: settings.msg_order_ready_pickup,
        msg_order_cancelled: settings.msg_order_cancelled,
        msg_order_delivery_driver: settings.msg_order_delivery_driver,
        msg_order_received: settings.msg_order_received,
        msg_lead_inactive_3days: settings.msg_lead_inactive_3days,
        driver_queue_mode: settings.driverQueueMode ?? false,
        updated_at: new Date().toISOString(),
        restaurant_id: restaurantId
      };

    let query;
    if (existing.data?.id) {
       query = supabase.from('store_settings').update(payload).eq('id', existing.data.id).select().single();
    } else {
       query = supabase.from('store_settings').insert(payload).select().single();
    }
    
    const { data, error } = await query;

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
      catalogTitleColor: data.catalog_title_color,
      catalogSubtitle: data.catalog_subtitle,
      catalogSubtitleColor: data.catalog_subtitle_color,
      socialLinks: data.social_links,
      creditCardFeeEnabled: data.credit_card_fee_enabled,
      creditCardFeeType: data.credit_card_fee_type,
      creditCardFeePercent: data.credit_card_fee_percent,
      debitCardFeeEnabled: data.debit_card_fee_enabled,
      debitCardFeeType: data.debit_card_fee_type,
      debitCardFeePercent: data.debit_card_fee_percent,
      printerWidth: data.printer_width,
      paymentPixEnabled: data.payment_pix_enabled,
      paymentCashEnabled: data.payment_cash_enabled,
      paymentCreditCardEnabled: data.payment_credit_card_enabled,
      paymentDebitCardEnabled: data.payment_debit_card_enabled,
      msg_order_confirmed: data.msg_order_confirmed,
      msg_order_preparing: data.msg_order_preparing,
      msg_order_out_delivery: data.msg_order_out_delivery,
      msg_order_ready_pickup: data.msg_order_ready_pickup,
      msg_order_finished: data.msg_order_finished,
      msg_order_cancelled: data.msg_order_cancelled,
      msg_order_delivery_driver: data.msg_order_delivery_driver,
      msg_order_received: data.msg_order_received,
      msg_lead_inactive_3days: data.msg_lead_inactive_3days,
      driverQueueMode: data.driver_queue_mode ?? false,
    };
  }

  // --- Auth ---
  isAuthenticated(): boolean {
    return localStorage.getItem('amazii_admin_logged') === 'true';
  }

  async checkSession(): Promise<boolean> {
    const isAdmin = localStorage.getItem('amazii_admin_logged') === 'true';
    if (isAdmin) return true;
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  async loginAdmin(email: string, pass: string, restaurantId: string): Promise<boolean> {
    try {
      const settings = await this.getSettings(restaurantId);
      if (!settings) return false;
      if (email === settings.adminEmail && pass === settings.adminPassword) {
        localStorage.setItem('amazii_admin_logged', 'true');
        return true;
      }
    } catch (e) {}
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
  async getDeliveryFee(neighborhood: string, restaurantId: string): Promise<number> {
    const settings = await this.getSettings(restaurantId);
    if (!settings) return 0;
    
    const rule = settings.deliveryFeesByNeighborhood?.find(
      r => r.neighborhood.toLowerCase() === neighborhood.toLowerCase()
    );
    return rule ? rule.fee : settings.deliveryFeeBase;
  }

  async isStoreOpen(restaurantId: string): Promise<boolean> {
    try {
      const settings = await this.getSettings(restaurantId);
      if (!settings) return false;
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
  private compressImage(file: File, maxWidth = 1000, quality = 0.85): Promise<File> {
    return new Promise((resolve) => {
      // Android/iOS sometimes drop the file type on direct camera uploads. We check extensions too.
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);
      if (!isImage || file.type === 'image/gif' || /\.gif$/i.test(file.name)) {
        return resolve(file);
      }

      const img = new Image();
      const objUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        
        const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
        
        if (!isPng) {
          // Fill white background for JPEGs to avoid transparent pixels turning black
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const outType = isPng ? 'image/png' : 'image/jpeg';
        const newExt = isPng ? '.png' : '.jpg';
        
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const newName = file.name.replace(/\.[^/.]+$/, "") + newExt;
          resolve(new File([blob], newName, { type: outType, lastModified: Date.now() }));
        }, outType, quality);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file); // fallback to original file if format isn't readable by canvas
      };

      img.src = objUrl;
    });
  }

  async uploadFile(file: File): Promise<string> {
    const compressedFile = await this.compressImage(file);
    const fileExt = compressedFile.name.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('amazii-assets')
      .upload(filePath, compressedFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('amazii-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  }
}

export const supabaseService = new SupabaseService();
