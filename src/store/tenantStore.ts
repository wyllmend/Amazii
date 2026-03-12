import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TenantState = {
  restaurantId: string | null;
  slug: string | null;
  setTenant: (restaurantId: string, slug: string) => void;
  clearTenant: () => void;
};

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      restaurantId: null,
      slug: null,
      setTenant: (restaurantId, slug) => set({ restaurantId, slug }),
      clearTenant: () => set({ restaurantId: null, slug: null }),
    }),
    {
      name: 'amazii-tenant-storage',
    }
  )
);
