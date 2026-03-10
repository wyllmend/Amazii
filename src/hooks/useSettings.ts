import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { StoreSettings } from '@/services/types';

let cachedSettings: StoreSettings | null = null;

export function useSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(cachedSettings);
  const [loading, setLoading] = useState(!cachedSettings);

  const refreshSettings = async () => {
    try {
      const data = await supabaseService.getSettings();
      cachedSettings = data;
      setSettings(data);
      return data;
    } catch (err) {
      console.error('Error refreshing settings:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!cachedSettings) {
      refreshSettings().finally(() => setLoading(false));
    }
  }, []);

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
