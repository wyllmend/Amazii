import React, { useState, useEffect, useRef } from 'react';
import { whatsappService } from '@/services/whatsappService';
import { 
  Search, Send, User, MessageCircle, Loader2, 
  CheckCheck, Check, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Chat {
  id: string;
  remoteJid: string;
  pushName?: string;
  unreadCount: number;
  message?: string;
  messageTimestamp?: number;
}

interface Message {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number;
  status?: string;
}

export default function AdminChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [connectionState, setConnectionState] = useState<string>('open');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chats
  const fetchChats = async (showLoading = false) => {
    if (showLoading) setLoadingChats(true);
    try {
      // Check connection first
      const state = await whatsappService.getConnectionState();
      setConnectionState(state);
      
      if (state !== 'open') {
        setChats([]);
        return;
      }

      const data = await whatsappService.findChats();
      console.log('WhatsApp findChats response:', data);
      
      // Evolution API v2 usually returns an array directly or inside a 'chats' property
      let chatList = [];
      if (Array.isArray(data)) {
        chatList = data;
      } else if (data && Array.isArray(data.chats)) {
        chatList = data.chats;
      } else if (data && typeof data === 'object') {
        // Some versions might have different nesting
        chatList = data.data || data.records || [];
      }
      
      setChats(chatList);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      if (showLoading) setLoadingChats(false);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (remoteJid: string, showLoading = false) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const data = await whatsappService.findMessages(remoteJid);
      console.log(`WhatsApp findMessages [${remoteJid}] response:`, data);
      
      let msgList = [];
      if (Array.isArray(data)) {
        msgList = data;
      } else if (data && Array.isArray(data.messages)) {
        msgList = data.messages;
      } else if (data && typeof data === 'object') {
        msgList = data.data || data.records || [];
      }

      // Sort messages by timestamp
      const sortedMessages = msgList.sort((a, b) => 
        (a.messageTimestamp || 0) - (b.messageTimestamp || 0)
      );
      setMessages(sortedMessages);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  // Initial load and polling for chats
  useEffect(() => {
    fetchChats(true);
    const chatInterval = setInterval(() => fetchChats(), 30000); // 30s
    return () => clearInterval(chatInterval);
  }, []);

  // Polling for messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.remoteJid, true);
      const msgInterval = setInterval(() => fetchMessages(selectedChat.remoteJid), 5000); // 5s
      return () => clearInterval(msgInterval);
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await whatsappService.sendMessage(selectedChat.remoteJid, newMessage);
      setNewMessage('');
      // Refresh messages immediately
      fetchMessages(selectedChat.remoteJid);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const getMessageText = (msg: Message) => {
    return msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  };

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    return format(new Date(timestamp * 1000), 'HH:mm', { locale: ptBR });
  };

  const filteredChats = chats.filter(chat => 
    (chat.pushName || chat.remoteJid).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] bg-white rounded-2xl border border-gray-200 shadow-sm flex overflow-hidden">
      {/* Sidebar: Chat List */}
      <div className="w-full md:w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Conversas</h2>
            <button 
              onClick={() => fetchChats(true)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              title="Atualizar conversas"
            >
              <RefreshCw className={cn("w-4 h-4 text-gray-400", loadingChats && "animate-spin")} />
            </button>
          </div>
          
          {connectionState !== 'open' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs font-medium animate-pulse">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>WhatsApp Desconectado</span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm border-none focus:ring-2 focus:ring-amazii-primary/20 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-amazii-primary" />
            </div>
          ) : connectionState !== 'open' ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-gray-500 text-sm">
                Conecte o WhatsApp na aba Configurações para carregar suas conversas.
              </p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhuma conversa encontrada
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={cn(
                  "p-4 flex items-start gap-3 cursor-pointer transition-colors border-b border-gray-50",
                  selectedChat?.remoteJid === chat.remoteJid ? "bg-purple-50" : "hover:bg-gray-50"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-gray-900 truncate">
                      {chat.pushName || chat.remoteJid.split('@')[0]}
                    </span>
                    {chat.messageTimestamp && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {formatMessageTime(chat.messageTimestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {chat.message || 'Sem mensagens'}
                  </p>
                </div>
                {chat.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-amazii-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                    {chat.unreadCount}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col bg-gray-50 relative">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-gray-100 flex items-center px-6 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-none mb-1">
                    {selectedChat.pushName || selectedChat.remoteJid.split('@')[0]}
                  </h3>
                  <span className="text-[10px] text-green-500 font-medium">Online</span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-amazii-primary opacity-20" />
                </div>
              ) : (
                messages.map((msg) => {
                  const text = getMessageText(msg);
                  if (!text) return null;
                  
                  return (
                    <div 
                      key={msg.key.id}
                      className={cn(
                        "flex flex-col max-w-[80%] md:max-w-[70%]",
                        msg.key.fromMe ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      <div className={cn(
                        "px-4 py-2 rounded-2xl text-sm shadow-sm",
                        msg.key.fromMe 
                          ? "bg-amazii-primary text-white rounded-tr-none" 
                          : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                      )}>
                        {text}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-gray-400">
                          {formatMessageTime(msg.messageTimestamp)}
                        </span>
                        {msg.key.fromMe && (
                          <div className="text-amazii-primary">
                            {msg.status === 'READ' ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amazii-primary/20 border-none"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-10 h-10 bg-amazii-primary hover:bg-amazii-dark text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Seus Chats</h3>
            <p className="text-gray-500 max-w-xs">
              Selecione uma conversa na lista lateral para começar a enviar mensagens em tempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
