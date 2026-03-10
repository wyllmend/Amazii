import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (await supabaseService.loginAdmin(email, password)) {
      toast.success('Bem-vindo de volta!');
      navigate('/admin/dashboard');
    } else {
      toast.error('Credenciais inválidas');
      setLoading(false);
    }
  };

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
            <p className="text-xs text-gray-400 mt-2 text-right">Dica: admin123</p>
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

