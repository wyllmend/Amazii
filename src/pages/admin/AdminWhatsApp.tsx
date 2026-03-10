import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, RefreshCw, CheckCircle2, AlertCircle, Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { whatsappService } from '@/services/whatsappService';

export default function AdminWhatsApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Connection status polling
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const state = await whatsappService.getConnectionState();
        setIsConnected(state === 'open');
      } catch (error) {
        setIsConnected(false);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const generateQR = async () => {
    setLoadingQR(true);
    setQrCode(null);
    try {
      const data = await whatsappService.connect();
      if (data.base64) {
        setQrCode(data.base64);
        toast.success('Novo QR Code gerado');
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
    if (window.confirm('Deseja desconectar o WhatsApp? As mensagens automáticas pararão de ser enviadas.')) {
      try {
        await whatsappService.logout();
        setIsConnected(false);
        setQrCode(null);
        toast.info('WhatsApp desconectado');
      } catch (error: any) {
        toast.error(error.message || 'Erro ao desconectar');
      }
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      toast.error('Digite um número de telefone');
      return;
    }
    
    setSendingTest(true);
    try {
      await whatsappService.sendMessage(testPhone, 'Olá! Esta é uma mensagem de teste do seu sistema de delivery. 🍧');
      toast.success(`Mensagem de teste enviada para ${testPhone}`);
      setTestPhone('');
    } catch (error: any) {
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
          isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        )}>
          {isConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Conectado
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              Desconectado
            </>
          )}
        </div>
      </div>

      {/* Connection Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          {isConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                <Smartphone className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Conectado!</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  Seu sistema está pronto para enviar mensagens automáticas. 
                  Você pode desconectar a qualquer momento se precisar trocar de número.
                </p>
              </div>
              <button 
                onClick={handleDisconnect}
                className="px-6 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                Desconectar Sessão
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Instructions */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amazii-primary" />
                  Como conectar:
                </h3>
                
                <ol className="space-y-4 text-gray-600">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center">1</span>
                    <span>Abra o WhatsApp no seu celular</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center">2</span>
                    <span>Toque em <strong>Mais opções</strong> (Android) ou <strong>Configurações</strong> (iPhone)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center">3</span>
                    <span>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar aparelho</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center">4</span>
                    <span>Aponte a câmera para o QR Code ao lado</span>
                  </li>
                </ol>

                <div className="pt-4">
                  <button 
                    onClick={generateQR}
                    disabled={loadingQR || !!qrCode}
                    className="w-full md:w-auto px-6 py-3 bg-amazii-primary hover:bg-amazii-dark text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loadingQR ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                    {qrCode ? 'QR Code Disponível' : 'Gerar Novo QR Code'}
                  </button>
                </div>
              </div>

              {/* QR Code Area */}
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 min-h-[300px]">
                {loadingQR ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-amazii-primary animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">Gerando código seguro...</p>
                  </div>
                ) : qrCode ? (
                  <div className="relative group">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 md:w-56 md:h-56 mix-blend-multiply" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-48 h-48 md:w-56 md:h-56 bg-gray-200 rounded-lg flex items-center justify-center mx-auto">
                      <QrCode className="w-16 h-16 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Clique em "Gerar Novo QR Code" para iniciar
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Connection */}
      {isConnected && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 animate-in slide-in-from-bottom-4">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amazii-primary" />
            Testar Conexão
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Teste (WhatsApp)</label>
              <input 
                type="text" 
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none"
              />
            </div>
            <button 
              onClick={handleSendTest}
              disabled={sendingTest || !testPhone}
              className="px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 h-[42px]"
            >
              {sendingTest ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Mensagem de Teste
            </button>
          </div>
          <p className="text-xs text-gray-500">
            * Isso enviará uma mensagem "Olá! Esta é uma mensagem de teste do seu sistema de delivery." para o número informado.
          </p>
        </div>
      )}
    </div>
  );
}

