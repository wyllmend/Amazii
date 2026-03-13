import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useTenantStore } from '@/store/tenantStore';

export default function AdminLoginPage() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { restaurantId, setTenant, clearTenant } = useTenantStore();
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState(false);

  useEffect(() => {
    async function resolveTenant() {
      if (!tenantSlug) {
        clearTenant();
        setTenantLoading(false);
        setTenantError(true);
        return;
      }
      try {
        const rest = await supabaseService.getRestaurantBySlug(tenantSlug);
        if (rest && rest.active) {
          setTenant(rest.id, tenantSlug);
          setTenantError(false);
        } else {
          clearTenant();
          setTenantError(true);
        }
      } catch (err) {
        clearTenant();
        setTenantError(true);
      } finally {
        setTenantLoading(false);
      }
    }
    resolveTenant();
  }, [tenantSlug, setTenant, clearTenant]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    setLoading(true);

    try {
      if (await supabaseService.loginAdmin(email, password, restaurantId)) {
        toast.success('Bem-vindo de volta!');
        navigate(`/admin/${tenantSlug}/dashboard`);
      } else {
        toast.error('Credenciais inválidas');
      }
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-amazii-light flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  if (tenantError) {
    return (
      <div className="min-h-screen bg-amazii-light flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
          <p className="text-gray-500">A página de login deste restaurante não está acessível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amazii-light flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amazii-gradient rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg shadow-purple-200">
            A
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Amazii Admin</h1>
          <p className="text-gray-500 mt-2">Faça login para gerenciar sua loja</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all"
                placeholder="admin@amazii.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 focus:border-amazii-primary outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amazii-primary hover:bg-amazii-dark text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

