import { useState, useEffect } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { Product, Category, StoreSettings } from '@/services/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { useTenantStore } from '@/store/tenantStore';

export default function HomePage() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const baseUrl = tenantSlug ? `/${tenantSlug}` : '';
  const restaurantId = useTenantStore((state) => state.restaurantId);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabaseService.getProducts(restaurantId),
      supabaseService.getCategories(restaurantId),
      supabaseService.getSettings(restaurantId)
    ])
      .then(([prods, cats, storeSettings]) => {
        setProducts(prods ?? []);
        setCategories(cats ?? []);
        setSettings(storeSettings);
      })
      .catch(() => toast.error('Erro ao carregar produtos'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(term) || (product.description || '').toLowerCase().includes(term);
    return matchesCategory && matchesSearch && product.active;
  });

  const activeBanners = settings?.banners?.filter(b => b.active) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32">

      {/* Banners */}
      {activeBanners.length > 0 && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 -mx-3 px-3">
          {activeBanners.map((banner) => (
            <div key={banner.id} className="min-w-full snap-center rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
              {banner.link ? (
                <a href={banner.link} target="_blank" rel="noopener noreferrer">
                  <picture>
                    <source media="(min-width: 640px)" srcSet={banner.imageUrlDesktop} />
                    <img src={banner.imageUrlMobile} alt="Banner" className="w-full h-auto object-cover max-h-[220px] sm:max-h-[380px]" referrerPolicy="no-referrer" />
                  </picture>
                </a>
              ) : (
                <picture>
                  <source media="(min-width: 640px)" srcSet={banner.imageUrlDesktop} />
                  <img src={banner.imageUrlMobile} alt="Banner" className="w-full h-auto object-cover max-h-[220px] sm:max-h-[380px]" referrerPolicy="no-referrer" />
                </picture>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div
        className="rounded-2xl p-4 sm:p-6 text-white"
        style={{ background: 'linear-gradient(135deg, var(--amazii-primary), var(--amazii-secondary))' }}
      >
        {settings?.catalogTitle && (
          <h1 className="text-xl sm:text-2xl font-bold mb-1">{settings.catalogTitle}</h1>
        )}
        {settings?.catalogSubtitle && (
          <p className="text-white/80 text-sm mb-3 hidden sm:block">{settings.catalogSubtitle}</p>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="search"
            placeholder="Buscar produtos..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
            selectedCategory === 'all'
              ? "bg-amazii-primary text-white shadow-sm"
              : "bg-white text-gray-600 border border-gray-200"
          )}
        >
          Todos
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              selectedCategory === category.id
                ? "bg-amazii-primary text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredProducts.map((product) => (
          <Link
            key={product.id}
            to={`${baseUrl}/produto/${product.id}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group active:scale-[0.98]"
          >
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-300",
                  product.available === false ? "grayscale" : "group-hover:scale-105"
                )}
                referrerPolicy="no-referrer"
              />
              {product.available === false && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold uppercase shadow transform -rotate-12 border border-white">
                    Esgotado
                  </span>
                </div>
              )}
              {product.featured && product.available !== false && (
                <span className="absolute top-2 left-2 bg-amazii-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Destaque
                </span>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <h3 className="font-bold text-sm text-gray-900 mb-1 line-clamp-2 leading-tight">{product.name}</h3>
              <p className="text-gray-400 text-xs line-clamp-2 mb-3 flex-1 hidden sm:block">{product.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className={cn(
                  "font-bold text-sm",
                  product.available === false ? "text-gray-400 line-through" : "text-amazii-primary"
                )}>
                  {formatCurrency(product.price)}
                </span>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                  product.available === false
                    ? "bg-gray-100 text-gray-400"
                    : "bg-amazii-muted text-amazii-primary"
                )}>
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum produto encontrado.</p>
        </div>
      )}
    </div>
  );
}
