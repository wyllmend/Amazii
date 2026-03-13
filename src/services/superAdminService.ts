import { supabase } from '../lib/supabase';

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SystemMetrics = {
  totalOrders: number;
  totalProducts: number;
  totalCategories: number;
  totalLogs: number;
  totalArchived: number;
  totalRestaurants: number;
  activeRestaurants: number;
  uniqueCustomers: number;
  whatsappMessagesSent: number;
};

export type RestaurantStats = Restaurant & {
  orderCount: number;
  totalRevenue: number;
};

class SuperAdminService {
  private readonly SUPER_ADMIN_KEY = 'elevare_superadmin_logged';
  // fallback for first login before DB row exists
  private readonly DEFAULT_PASSWORD = import.meta.env.VITE_SUPER_ADMIN_PASSWORD || 'elevaremenu@superadmin2026';

  isAuthenticated(): boolean {
    return localStorage.getItem(this.SUPER_ADMIN_KEY) === 'true';
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('super_admin_settings')
        .select('email, password_hash')
        .limit(1)
        .single();

      if (error || !data) {
        // fallback: no DB row yet, use env/default password only
        if (password === this.DEFAULT_PASSWORD) {
          localStorage.setItem(this.SUPER_ADMIN_KEY, 'true');
          return true;
        }
        return false;
      }

      if (email === data.email && password === data.password_hash) {
        localStorage.setItem(this.SUPER_ADMIN_KEY, 'true');
        return true;
      }
      return false;
    } catch {
      // Fallback in case table doesn't exist yet
      if (password === this.DEFAULT_PASSWORD) {
        localStorage.setItem(this.SUPER_ADMIN_KEY, 'true');
        return true;
      }
      return false;
    }
  }

  async getCredentials(): Promise<{ email: string } | null> {
    try {
      const { data } = await supabase
        .from('super_admin_settings')
        .select('email')
        .limit(1)
        .single();
      return data ? { email: data.email } : null;
    } catch {
      return null;
    }
  }

  async updateCredentials(newEmail: string, newPassword: string): Promise<void> {
    const { data: existing } = await supabase
      .from('super_admin_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing?.id) {
      const { error } = await supabase
        .from('super_admin_settings')
        .update({ email: newEmail, password_hash: newPassword, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('super_admin_settings')
        .insert({ email: newEmail, password_hash: newPassword });
      if (error) throw error;
    }
  }

  logout(): void {
    localStorage.removeItem(this.SUPER_ADMIN_KEY);
  }

  async getRestaurants(): Promise<Restaurant[]> {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getRestaurantsWithStats(): Promise<RestaurantStats[]> {
    const restaurants = await this.getRestaurants();

    const statsPromises = restaurants.map(async (restaurant) => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', restaurant.id);

      if (error) {
        return { ...restaurant, orderCount: 0, totalRevenue: 0 };
      }

      const validOrders = (orders || []).filter(o => o.status !== 'cancelado');
      const finalizedOrders = (orders || []).filter(o => o.status === 'finalizado');
      const totalRevenue = finalizedOrders.reduce((acc, o) => acc + Number(o.total), 0);

      return { ...restaurant, orderCount: validOrders.length, totalRevenue };
    });

    return Promise.all(statsPromises);
  }

  async toggleRestaurant(id: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('restaurants')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      ordersResult,
      productsResult,
      categoriesResult,
      logsResult,
      archivedResult,
      restaurantsResult,
      waMetricsResult,
    ] = await Promise.all([
      supabase.from('orders').select('customer_phone', { count: 'exact' }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('system_logs').select('id', { count: 'exact', head: true }),
      supabase.from('orders_archive').select('id', { count: 'exact', head: true }),
      supabase.from('restaurants').select('id, active', { count: 'exact' }),
      supabase.from('system_metrics').select('value').eq('metric_type', 'whatsapp_message'),
    ]);

    const phones = new Set((ordersResult.data || []).map((o: any) => o.customer_phone));
    
    const totalRestaurants = restaurantsResult.count || 0;
    const activeRestaurants = (restaurantsResult.data || []).filter((r: any) => r.active).length;

    const waMessages = (waMetricsResult.data || []).reduce((acc: number, m: any) => acc + (m.value || 0), 0);

    return {
      totalOrders: ordersResult.count || 0,
      totalProducts: productsResult.count || 0,
      totalCategories: categoriesResult.count || 0,
      totalLogs: logsResult.count || 0,
      totalArchived: archivedResult.count || 0,
      totalRestaurants,
      activeRestaurants,
      uniqueCustomers: phones.size,
      whatsappMessagesSent: waMessages,
    };
  }

  async archiveOldOrders(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffISO = cutoffDate.toISOString();

    const { data: oldOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .lt('created_at', cutoffISO)
      .in('status', ['finalizado', 'cancelado']);

    if (fetchError) throw fetchError;
    if (!oldOrders || oldOrders.length === 0) return 0;

    const archiveRows = oldOrders.map(o => ({
      id: o.id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address: o.address,
      neighborhood: o.neighborhood,
      observation: o.observation,
      items: o.items,
      subtotal: o.subtotal,
      delivery_fee: o.delivery_fee,
      discount: o.discount,
      total: o.total,
      status: o.status,
      payment_method: o.payment_method,
      change_for: o.change_for,
      delivery_method: o.delivery_method,
      customer_ip: o.customer_ip,
      created_at: o.created_at,
      updated_at: o.updated_at,
      restaurant_id: o.restaurant_id,
    }));

    const { error: insertError } = await supabase.from('orders_archive').upsert(archiveRows);
    if (insertError) throw insertError;

    const ids = oldOrders.map(o => o.id);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);
    if (deleteError) throw deleteError;

    return oldOrders.length;
  }

  async clearOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    const { count, error: countError } = await supabase
      .from('system_logs')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoffISO);

    if (countError) throw countError;

    const { error } = await supabase
      .from('system_logs')
      .delete()
      .lt('created_at', cutoffISO);

    if (error) throw error;
    return count || 0;
  }

  async exportOrdersCSV(restaurantId?: string): Promise<string> {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return '';

    const headers = [
      'ID', 'Restaurante', 'Cliente', 'Telefone', 'Endereço', 'Bairro',
      'Total', 'Status', 'Pagamento', 'Método Entrega', 'Data'
    ];

    const rows = data.map(o => [
      o.id,
      o.restaurant_id || 'default',
      o.customer_name,
      o.customer_phone,
      o.address || '',
      o.neighborhood || '',
      Number(o.total).toFixed(2),
      o.status,
      o.payment_method,
      o.delivery_method,
      new Date(o.created_at).toLocaleString('pt-BR'),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export const superAdminService = new SuperAdminService();
