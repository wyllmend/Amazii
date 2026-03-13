import React, { useState, useEffect } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, CheckCircle2, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { superAdminService } from '@/services/superAdminService';
import { toast } from 'sonner';

export default function SuperAdminConfig() {
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(true);

  useEffect(() => {
    superAdminService.getCredentials().then(creds => {
      if (creds) {
        setCurrentEmail(creds.email);
        setNewEmail(creds.email);
      }
      setLoadingCreds(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Informe a senha atual para confirmar as alterações.');
      return;
    }

    // Verify current password
    const valid = await superAdminService.login(currentEmail, currentPassword);
    if (!valid) {
      toast.error('Senha atual incorreta. Tente novamente.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('As novas senhas não coincidem.');
      return;
    }

    if (newPassword && newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const emailToSave = newEmail.trim() || currentEmail;
      const passwordToSave = newPassword.trim() || currentPassword;
      await superAdminService.updateCredentials(emailToSave, passwordToSave);
      toast.success('✅ Credenciais atualizadas com sucesso!');
      setCurrentEmail(emailToSave);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Configurações do Super Admin</h1>
          <p className="text-sm text-gray-500">Gerencie as credenciais de acesso ao painel global</p>
        </div>
      </div>

      {/* Current credentials info */}
      {loadingCreds ? (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-gray-800/50 border border-gray-700/50">
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
          <span className="text-sm text-gray-400">Carregando credenciais...</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <CheckCircle2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-300">E-mail atual</p>
            <p className="text-xs text-gray-400">{currentEmail}</p>
          </div>
        </div>
      )}

      {/* Security warning */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-yellow-300">Atenção</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Após alterar as credenciais, você precisará fazer login novamente com as novas informações.
            Guarde-as em local seguro.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-gray-900/60 rounded-2xl border border-gray-800/80 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold uppercase tracking-widest text-gray-400">Alterar Credenciais</span>
        </div>

        {/* New Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Novo E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="novo@email.com"
              className="w-full pl-11 pr-4 py-3 bg-gray-800/60 border border-gray-700/50 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
            />
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nova Senha <span className="text-gray-500 font-normal">(deixe em branco para manter a atual)</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-12 py-3 bg-gray-800/60 border border-gray-700/50 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
            />
            <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        {newPassword && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-11 pr-12 py-3 bg-gray-800/60 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm text-white placeholder-gray-500 ${
                  confirmPassword && confirmPassword !== newPassword ? 'border-red-500/60' : 'border-gray-700/50'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-400 mt-1">As senhas não coincidem.</p>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-700/40 pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            🔐 Senha Atual <span className="text-orange-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Confirme com sua senha atual"
              required
              className="w-full pl-11 pr-4 py-3 bg-gray-800/60 border border-gray-700/50 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Necessária para confirmar as alterações.</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !currentPassword}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Salvar Alterações</>
          )}
        </button>
      </form>
    </div>
  );
}
