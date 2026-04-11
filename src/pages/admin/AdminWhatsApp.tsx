import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, RefreshCw, CheckCircle2, AlertCircle, Loader2, Send, MessageSquare, Settings2, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { whatsappService, InstanceSettings, DEFAULT_INSTANCE_SETTINGS } from '@/services/whatsappService';
import { useParams } from 'react-router-dom';

const INSTANCE_STORAGE_KEY = (slug: string) => `wa_instance_${slug}`;

function getStoredInstance(slug: string): string {
  return localStorage.getItem(INSTANCE_STORAGE_KEY(slug)) || slug;
}

function saveStoredInstance(slug: string, instanceName: string) {
  localStorage.setItem(INSTANCE_STORAGE_KEY(slug), instanceName);
}

const SETTINGS_CONFIG: Array<{ key: keyof InstanceSettings; label: string; description: string; recommended: boolean }> = [
  { key: 'rejectCall', label: 'Rejeitar chamadas', description: 'Rejeitar todas as chamadas recebidas automaticamente', recommended: true },
  { key: 'groupsIgnore', label: 'Ignorar grupos', description: 'Ignorar todas as mensagens de grupos', recommended: true },
  { key: 'alwaysOnline', label: 'Sempre online', description: 'Manter o WhatsApp sempre com status online', recommended: true },
  { key: 'readMessages', label: 'Ler mensagens', description: 'Marcar todas as mensagens recebidas como lidas', recommended: false },
  { key: 'syncFullHistory', label: 'Sincronizar histórico completo', description: 'Sincronizar todo o histórico ao escanear o QR Code', recommended: false },
  { key: 'readStatus', label: 'Ler status', description: 'Marcar todos os status como lidos automaticamente', recommended: false },
];

export default function AdminWhatsApp() {
  const { tenantSlug = 'default' } = useParams<{ tenantSlug: string }>();
  const [instanceName, setInstanceName] = useState(() => getStoredInstance(tenantSlug));
  const [isConnected, setIsConnected] = useState(false);
  const [isBroken, setIsBroken] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [instanceSettings, setInstanceSettings] = useState<InstanceSettings>(DEFAULT_INSTANCE_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [allInstances, setAllInstances] = useState<{ name: string; state: string }[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState<string | null>(null);

  // Connection status polling
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const state = await whatsappService.getConnectionState(instanceName);
        setIsConnected(state === 'open');
        if (state !== 'open') setIsBroken(false);
      } catch {
        setIsConnected(false);
        setIsBroken(false);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [instanceName]);

  // Load the list of all instances for this tenant
  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const list = await whatsappService.listInstances(tenantSlug);
      setAllInstances(list);
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    loadInstances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // Load instance settings when connected
  useEffect(() => {
    if (!isConnected || isBroken) return;
    setLoadingSettings(true);
    whatsappService.getInstanceSettings(instanceName)
      .then(s => setInstanceSettings(s))
      .catch(() => setInstanceSettings(DEFAULT_INSTANCE_SETTINGS))
      .finally(() => setLoadingSettings(false));
  }, [isConnected, isBroken, instanceName]);

  const generateQR = async () => {
    setLoadingQR(true);
    setQrCode(null);
    setIsBroken(false);
    try {
      const data = await whatsappService.connect(instanceName);
      if (data.base64) {
        setQrCode(data.base64);
        toast.success('QR Code gerado — escaneie com o WhatsApp');
      } else if (data.state === 'open') {
        setIsBroken(true);
        toast.info('A instância pode estar com problema. Tente "Criar Nova Instância".');
      } else {
        toast.error('Erro ao gerar QR Code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar instância');
    } finally {
      setLoadingQR(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Deseja desconectar o WhatsApp? As mensagens automáticas pararão de ser enviadas.')) return;
    try {
      await whatsappService.logout(instanceName);
      setIsConnected(false);
      setIsBroken(false);
      setQrCode(null);
      toast.info('WhatsApp desconectado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao desconectar');
    }
  };

  const handleCreateNewInstance = async () => {
    if (!window.confirm('Isso criará uma nova instância do WhatsApp. Você precisará escanear um novo QR Code. Deseja continuar?')) return;
    setCreatingNew(true);
    try {
      const suffix = Date.now().toString(36);
      const newName = `${tenantSlug}-${suffix}`;
      const data = await whatsappService.connect(newName);
      if (data.base64) {
        saveStoredInstance(tenantSlug, newName);
        setInstanceName(newName);
        setIsConnected(false);
        setIsBroken(false);
        setQrCode(data.base64);
        toast.success(`Nova instância criada! Escaneie o QR Code.`);
        loadInstances(); // refresh list
      } else {
        toast.error('Não foi possível criar nova instância');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar nova instância');
    } finally {
      setCreatingNew(false);
    }
  };

  /**
   * Force-deletes an instance from the Evolution API.
   * Even if the API returns 400/500 (zombie instance), we:
   *  1. Remove it from the local list so the UI stays clean.
   *  2. Clear the active instance in localStorage if it matches.
   */
  const handleForceDelete = async (targetInstance: string) => {
    if (!window.confirm(`Deletar a instância "${targetInstance}"?\n\nEsta ação irá remover o registro da API, mesmo que a sessão já esteja morta.`)) return;
    setDeletingInstance(targetInstance);
    try {
      const result = await whatsappService.deleteInstance(targetInstance, true);
      // Always clean local state first — the UI must never get stuck
      setAllInstances(prev => prev.filter(i => i.name !== targetInstance));
      if (targetInstance === instanceName) {
        // The active instance was deleted — reset to the slug default
        const fallback = tenantSlug;
        saveStoredInstance(tenantSlug, fallback);
        setInstanceName(fallback);
        setIsConnected(false);
        setIsBroken(false);
        setQrCode(null);
        localStorage.removeItem(`wa_instance_${tenantSlug}`);
      }
      if (result.forced) {
        toast.warning(`Instância deletada com force (a API retornou erro, mas o registro foi limpo localmente).`);
      } else {
        toast.success(`Instância "${targetInstance}" deletada com sucesso.`);
      }
    } catch (error: any) {
      // Should not reach here in force mode, but handle gracefully
      toast.error(error.message || 'Erro inesperado ao deletar instância');
    } finally {
      setDeletingInstance(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await whatsappService.updateInstanceSettings(instanceName, instanceSettings);
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar configurações: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) { toast.error('Digite um número de telefone'); return; }
    setSendingTest(true);
    try {
      await whatsappService.sendMessage(instanceName, testPhone, 'Olá! Esta é uma mensagem de teste do seu sistema de delivery. 🍧');
      toast.success(`Mensagem de teste enviada para ${testPhone}`);
      setTestPhone('');
      setIsBroken(false);
    } catch (error: any) {
      if (error.message?.includes('Connection Closed') || error.message?.includes('400') || error.message?.includes('500')) {
        setIsBroken(true);
      }
      toast.error(error.message || 'Erro ao enviar mensagem de teste');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração do WhatsApp</h1>
          <p className="text-gray-500">Conecte seu número para enviar notificações automáticas de pedidos</p>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 w-fit",
          isConnected && !isBroken ? "bg-green-100 text-green-700" : isBroken ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
        )}>
          {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> :
            isConnected && !isBroken ? <><CheckCircle2 className="w-4 h-4" /> Conectado</> :
            isBroken ? <><AlertTriangle className="w-4 h-4" /> Conexão com problema</> :
            <><AlertCircle className="w-4 h-4" /> Desconectado</>}
        </div>
      </div>

      {/* Instance Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
        <Settings2 className="w-4 h-4 shrink-0" />
        <span>Instância ativa: <strong>{instanceName}</strong></span>
      </div>

      {/* Broken state warning */}
      {isBroken && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-yellow-800 font-bold">
            <AlertTriangle className="w-5 h-5" />
            Instância com problema de conexão
          </div>
          <p className="text-sm text-yellow-700">
            A sessão do WhatsApp foi encerrada (aparelho removido dos dispositivos conectados).
            Crie uma nova instância e escaneie o QR Code novamente.
          </p>
          <button onClick={handleCreateNewInstance} disabled={creatingNew}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-70">
            {creatingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Criar Nova Instância
          </button>
        </div>
      )}

      {/* ── Instance Manager Panel ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2 text-gray-800">
            <Settings2 className="w-4 h-4 text-amazii-primary" />
            Gerenciar Instâncias
          </h3>
          <button
            onClick={loadInstances}
            disabled={loadingInstances}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amazii-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loadingInstances && 'animate-spin')} />
            Atualizar
          </button>
        </div>

        <div className="px-6 py-4">
          {loadingInstances ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-amazii-primary" />
            </div>
          ) : allInstances.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma instância encontrada para este tenant.</p>
          ) : (
            <ul className="divide-y divide-gray-50 -mx-6 px-6">
              {allInstances.map(inst => {
                const isActive = inst.name === instanceName;
                const stateColor =
                  inst.state === 'open' ? 'bg-green-100 text-green-700'
                  : inst.state === 'connecting' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-600';
                const stateLabel =
                  inst.state === 'open' ? 'Conectada'
                  : inst.state === 'connecting' ? 'Conectando'
                  : inst.state === 'close' ? 'Fechada'
                  : inst.state;

                return (
                  <li key={inst.name} className="flex items-center gap-3 py-3">
                    {/* Active badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-800 truncate max-w-[240px]" title={inst.name}>
                          {inst.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-amazii-primary/10 text-amazii-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">
                            Ativa
                          </span>
                        )}
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block', stateColor)}>
                        {stateLabel}
                      </span>
                    </div>

                    {/* Force Delete button */}
                    <button
                      onClick={() => handleForceDelete(inst.name)}
                      disabled={deletingInstance === inst.name}
                      title="Deletar instância (força)"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {deletingInstance === inst.name
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      {deletingInstance === inst.name ? 'Deletando...' : 'Force Delete'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Connection Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          {isConnected && !isBroken ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Conectado!</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  Seu sistema está pronto para enviar mensagens automáticas.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={handleDisconnect}
                  className="px-6 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
                  Desconectar Sessão
                </button>
                <button onClick={handleCreateNewInstance} disabled={creatingNew}
                  className="px-6 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70">
                  {creatingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Criar Nova Instância
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amazii-primary" />
                  Como conectar:
                </h3>
                <ol className="space-y-4 text-gray-600">
                  {['Abra o WhatsApp no seu celular',
                    'Toque em Mais opções (Android) ou Configurações (iPhone)',
                    'Toque em Aparelhos conectados → Conectar aparelho',
                    'Aponte a câmera para o QR Code ao lado'].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center">{i + 1}</span>
                      <span dangerouslySetInnerHTML={{ __html: step.replace(/(Mais opções|Configurações|Aparelhos conectados|Conectar aparelho)/g, '<strong>$1</strong>') }} />
                    </li>
                  ))}
                </ol>
                <div className="pt-2 flex flex-col gap-3">
                  <button onClick={generateQR} disabled={loadingQR || !!qrCode}
                    className="px-6 py-3 bg-amazii-primary hover:bg-amazii-dark text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                    {loadingQR ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    {qrCode ? 'QR Code Disponível' : 'Gerar Novo QR Code'}
                  </button>
                  <button onClick={handleCreateNewInstance} disabled={creatingNew}
                    className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                    {creatingNew ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Criar Nova Instância
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 min-h-[300px]">
                {loadingQR || creatingNew ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-amazii-primary animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">
                      {creatingNew ? 'Criando nova instância...' : 'Gerando código seguro...'}
                    </p>
                  </div>
                ) : qrCode ? (
                  <div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 md:w-56 md:h-56 mix-blend-multiply" />
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">O QR Code expira em ~60 segundos</p>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-48 h-48 md:w-56 md:h-56 bg-gray-200 rounded-lg flex items-center justify-center mx-auto">
                      <QrCode className="w-16 h-16 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">Clique em "Gerar Novo QR Code" para iniciar</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instance Settings */}
      {isConnected && !isBroken && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-amazii-primary" />
            Configurações da Instância
          </h3>

          {loadingSettings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amazii-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {SETTINGS_CONFIG.map(({ key, label, description, recommended }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">{label}</span>
                      {recommended && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Recomendado</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={instanceSettings[key]}
                      onChange={(e) => setInstanceSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amazii-primary" />
                  </label>
                </div>
              ))}

              <button onClick={handleSaveSettings} disabled={savingSettings}
                className="w-full mt-2 px-6 py-3 bg-amazii-primary hover:bg-amazii-dark text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Configurações
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test Connection */}
      {isConnected && !isBroken && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amazii-primary" />
            Testar Conexão
          </h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Teste (WhatsApp)</label>
              <input type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
            <button onClick={handleSendTest} disabled={sendingTest || !testPhone}
              className="px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 h-[42px]">
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Teste
            </button>
          </div>
          <p className="text-xs text-gray-500">* Envia uma mensagem de teste "Olá! Esta é uma mensagem de teste..." para o número informado.</p>
        </div>
      )}
    </div>
  );
}
