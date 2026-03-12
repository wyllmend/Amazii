import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseService } from '@/services/supabaseService';
import { whatsappService } from '@/services/whatsappService';
import { Order, OrderStatus } from '@/services/types';
import {
  Send, Loader2, Search, MessageCircle, RefreshCw, Zap,
  AlertCircle, CheckCheck, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTenantStore } from '@/store/tenantStore';

// ─── Types (matching Evolution API field names) ────────────────────────────
interface EvChat {
  id: string;
  remoteJid: string;
  pushName?: string;
  unreadCount: number;
  message?: string;
  messageTimestamp?: number;
}

interface EvMessage {
  key: { id: string; remoteJid: string; fromMe: boolean };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
  messageTimestamp: number;
  status?: string;
}

// ─── Order status label config ────────────────────────────────────────────
const STATUS_CFG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  aguardando_pagamento: { label: 'Pedido Novo',         bg: 'bg-blue-100',   text: 'text-blue-700' },
  pago:                 { label: 'Pago',                bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  aceito:               { label: 'Aceito',              bg: 'bg-indigo-100', text: 'text-indigo-700' },
  em_preparo:           { label: 'Em Preparo',          bg: 'bg-yellow-100', text: 'text-yellow-700' },
  saiu_entrega:         { label: 'Saiu p/ Entrega',    bg: 'bg-orange-100', text: 'text-orange-700' },
  pronto_retirada:      { label: 'Pronto p/ Retirada', bg: 'bg-purple-100', text: 'text-purple-700' },
  finalizado:           { label: 'Finalizado',          bg: 'bg-green-100',  text: 'text-green-700' },
  cancelado:            { label: 'Cancelado',           bg: 'bg-red-100',    text: 'text-red-700' },
};

const QUICK_REPLIES = [
  '✅ Pedido confirmado!',
  '🍽️ Seu pedido está sendo preparado...',
  '🛵 Seu pedido saiu para entrega!',
  '😊 Pedido entregue! Obrigado pela preferência!',
  '⏱️ Em breve chegará, aguarde!',
];

function getMsgText(msg: EvMessage): string {
  return msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
}

function fmtTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function AdminKanban() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [chats, setChats]           = useState<EvChat[]>([]);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<EvChat | null>(null);
  const [messages, setMessages]     = useState<EvMessage[]>([]);
  const [text, setText]             = useState('');
  const [sending, setSending]       = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [connState, setConnState]   = useState('open');
  const [orders, setOrders]         = useState<Order[]>([]);
  const bottomRef                   = useRef<HTMLDivElement>(null);

  // ── Real-time orders for status labels ────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    supabaseService.getOrders(restaurantId).then(setOrders);
    const sub = supabaseService.subscribeToOrders(restaurantId, (order, event) => {
      if (event === 'INSERT') setOrders(p => [order, ...p]);
      else if (event === 'UPDATE') setOrders(p => p.map(o => o.id === order.id ? order : o));
      else if (event === 'DELETE') setOrders(p => p.filter(o => o.id !== order.id));
    });
    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [restaurantId]);

  // ── Get latest order status for a phone ──────────────────────────────
  const getStatus = useCallback((remoteJid: string): OrderStatus | null => {
    const chatPhone = remoteJid.split('@')[0].replace(/\D/g, '');
    const matches = orders
      .filter(o => o.customerPhone.replace(/\D/g, '').endsWith(chatPhone.slice(-8)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matches[0]?.status ?? null;
  }, [orders]);

  // ── Load chats ─────────────────────────────────────────────────────
  const fetchChats = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingChats(true);
    try {
      const state = await whatsappService.getConnectionState();
      setConnState(state);
      if (state !== 'open') { setChats([]); return; }

      const data = await whatsappService.findChats();
      console.log('[Chat] findChats raw:', data);

      // Evolution API response variants:
      // v1: array directly
      // v2: { chats: Chat[] }
      // v2 paginated: { chats: { total, records: Chat[] } }
      // some: { data: Chat[] } or { records: Chat[] }
      let list: EvChat[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.chats) {
        if (Array.isArray(data.chats)) list = data.chats;
        else if (Array.isArray(data.chats?.records)) list = data.chats.records;
      } else if (Array.isArray(data?.data)) {
        list = data.data;
      } else if (Array.isArray(data?.records)) {
        list = data.records;
      }

      const individual = list.filter((c: any) =>
        c.remoteJid?.endsWith('@s.whatsapp.net')
      );
      setChats(individual);
    } catch (err) {
      console.error('[Chat] fetchChats error:', err);
      toast.error('Erro ao carregar conversas');
    } finally {
      if (showLoading) setLoadingChats(false);
    }
  }, []);

  // Initial + polling chats (30s)
  useEffect(() => {
    fetchChats(true);
    const t = setInterval(() => fetchChats(), 30000);
    return () => clearInterval(t);
  }, [fetchChats]);

  // ── Load messages ─────────────────────────────────────────────────
  const fetchMessages = useCallback(async (chat: EvChat, showLoading = false) => {
    if (showLoading) setLoadingMsgs(true);
    try {
      const data = await whatsappService.findMessages(chat.remoteJid);
      console.log('[Chat] findMessages raw:', data);

      // Evolution API response variants:
      // v1: array directly
      // v2: { messages: Message[] }
      // v2 paginated: { messages: { total, records: Message[] } }  ← most common
      // some: { data: Message[] } or { records: Message[] }
      let list: EvMessage[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.messages) {
        if (Array.isArray(data.messages)) list = data.messages;
        else if (Array.isArray(data.messages?.records)) list = data.messages.records;
      } else if (Array.isArray(data?.data)) {
        list = data.data;
      } else if (Array.isArray(data?.records)) {
        list = data.records;
      }

      // Sort oldest → newest
      list.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
      setMessages(list);
    } catch (err) {
      console.error('[Chat] fetchMessages error:', err);
    } finally {
      if (showLoading) setLoadingMsgs(false);
    }
  }, []);

  // Polling messages for selected chat (5s)
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    setMessages([]);               // ← clear immediately on chat change
    fetchMessages(selected, true);
    const t = setInterval(() => fetchMessages(selected), 5000);
    return () => clearInterval(t);
  }, [selected, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────
  const handleSend = async (msg?: string) => {
    if (!selected) return;
    const content = msg || text.trim();
    if (!content) return;
    setSending(true);
    try {
      // sendMessage expects phone or JID — use remoteJid directly
      await whatsappService.sendMessage(selected.remoteJid, content);
      setText('');
      // refresh immediately after send
      setTimeout(() => fetchMessages(selected), 2000);
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = chats.filter(c =>
    (c.pushName || c.remoteJid).toLowerCase().includes(search.toLowerCase())
  );

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-112px)] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Left: Chat List ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Chat WhatsApp</h2>
            <p className="text-xs text-gray-400">{chats.length} conversas</p>
          </div>
          <button
            onClick={() => fetchChats(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={cn('w-4 h-4', loadingChats && 'animate-spin')} />
          </button>
        </div>

        {/* WA disconnected warning */}
        {connState !== 'open' && (
          <div className="mx-3 mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            WhatsApp desconectado — vá em Configurações para conectar.
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 border border-gray-100"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-amazii-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
              <MessageCircle className="w-8 h-8 text-gray-200" />
              {connState !== 'open' ? 'Desconectado' : 'Nenhuma conversa'}
            </div>
          ) : (
            filtered.map(chat => {
              const status = getStatus(chat.remoteJid);
              const cfg = status ? STATUS_CFG[status] : null;
              const isActive = selected?.remoteJid === chat.remoteJid;
              const displayName = chat.pushName || chat.remoteJid.split('@')[0];

              return (
                <div
                  key={chat.id || chat.remoteJid}
                  onClick={() => setSelected(chat)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors flex gap-3 items-start',
                    isActive ? 'bg-purple-50 border-l-2 border-l-amazii-primary' : 'hover:bg-gray-50'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-amazii-primary font-bold text-sm flex-shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-gray-900 text-sm truncate">{displayName}</span>
                      {!!chat.messageTimestamp && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {fmtTime(chat.messageTimestamp)}
                        </span>
                      )}
                    </div>
                    {/* Status label etiqueta */}
                    {cfg && (
                      <span className={cn('inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    )}
                    <p className="text-xs text-gray-400 truncate mt-0.5 leading-tight">
                      {chat.message || ''}
                    </p>
                  </div>
                  {/* Unread badge */}
                  {(chat.unreadCount ?? 0) > 0 && (
                    <div className="w-5 h-5 rounded-full bg-amazii-primary flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 mt-0.5">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Chat Window ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Selecione uma conversa</p>
            <p className="text-xs text-gray-400">As mensagens aparecerão aqui</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-amazii-primary font-bold text-sm">
                {(selected.pushName || selected.remoteJid).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-none">
                  {selected.pushName || selected.remoteJid.split('@')[0]}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{selected.remoteJid.split('@')[0]}</p>
              </div>
              {/* Status label in header */}
              {(() => {
                const status = getStatus(selected.remoteJid);
                const cfg = status ? STATUS_CFG[status] : null;
                if (!cfg) return null;
                return (
                  <span className={cn('px-3 py-1 rounded-full text-xs font-bold flex-shrink-0', cfg.bg, cfg.text)}>
                    {cfg.label}
                  </span>
                );
              })()}
            </div>

            {/* Quick replies */}
            <div className="px-4 py-2 border-b border-gray-100 bg-white flex gap-2 overflow-x-auto">
              {QUICK_REPLIES.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qr)}
                  disabled={sending}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                  {qr}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs && messages.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amazii-primary opacity-30" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center py-12 text-gray-400 text-sm">
                  Nenhuma mensagem
                </div>
              ) : (
                messages.map((msg) => {
                  const content = getMsgText(msg);
                  if (!content) return null;
                  const isMe = msg.key.fromMe;
                  return (
                    <div
                      key={msg.key.id}
                      className={cn('flex flex-col max-w-[75%]', isMe ? 'ml-auto items-end' : 'items-start')}
                    >
                      <div className={cn(
                        'px-4 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed',
                        isMe
                          ? 'bg-amazii-primary text-white rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                      )}>
                        {content}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 px-1">
                        <span className="text-[10px] text-gray-400">{fmtTime(msg.messageTimestamp)}</span>
                        {isMe && (
                          msg.status === 'READ'
                            ? <CheckCheck className="w-3 h-3 text-blue-400" />
                            : <Check className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
              />
              <button
                onClick={() => handleSend()}
                disabled={sending || !text.trim()}
                className="w-10 h-10 rounded-full bg-amazii-primary hover:bg-amazii-dark text-white flex items-center justify-center disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
