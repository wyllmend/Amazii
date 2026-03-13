import { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { StoreSettings } from '@/services/types';
import { useTenantStore } from '@/store/tenantStore';

const cachedSettings: Record<string, StoreSettings | null> = {};

export function useSettings() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [settings, setSettings] = useState<StoreSettings | null>(
    restaurantId && restaurantId in cachedSettings ? cachedSettings[restaurantId] : null
  );
  const [loading, setLoading] = useState(
    restaurantId ? !(restaurantId in cachedSettings) : true
  );

  const refreshSettings = useCallback(async () => {
    if (!restaurantId) return null;
    try {
      const data = await supabaseService.getSettings(restaurantId);
      cachedSettings[restaurantId] = data;
      setSettings(data);
      return data;
    } catch (err) {
      console.error('Error refreshing settings:', err);
      throw err;
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    if (!(restaurantId in cachedSettings)) {
      setLoading(true);
      refreshSettings().finally(() => setLoading(false));
    } else {
      setSettings(cachedSettings[restaurantId]);
      setLoading(false);
    }
  }, [restaurantId, refreshSettings]);

  useEffect(() => {
    if (!settings) return;

    // Update document identity
    if (settings.storeName) {
      document.title = settings.storeName;
    }
    
    if (settings.storeLogo) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = settings.storeLogo;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = settings.storeLogo;
        document.head.appendChild(newLink);
      }
    }

    // Update CSS Variables
    const root = document.documentElement;
    root.style.setProperty('--amazii-primary', settings.primaryColor || '#7c3aed');
    root.style.setProperty('--amazii-secondary', settings.secondaryColor || '#a78bfa');
    root.style.setProperty('--amazii-dark', `color-mix(in srgb, ${settings.primaryColor || '#7c3aed'}, black 20%)`);
    root.style.setProperty('--amazii-muted', `color-mix(in srgb, ${settings.primaryColor || '#7c3aed'}, transparent 90%)`);
  }, [settings]);

  return { settings, loading, refreshSettings };
}
