import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabaseService } from '@/services/supabaseService';
import { whatsappService } from '@/services/whatsappService';
import { formatCurrency } from '@/lib/utils';
import {
  MapPin, DollarSign, Loader2, CheckCircle2, XCircle,
  Navigation, Phone, MessageCircle, Truck, AlertTriangle,
  ChevronRight, Package, User, ClipboardList
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'available' | 'claiming' | 'success' | 'already_claimed' | 'delivered' | 'error';

interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
  selectedOptions?: { optionName: string; quantity: number }[];
}

interface ClaimedDetails {
  driverName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhood: string;
  deliveryFee: number;
  observation?: string;
  items: OrderItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DRIVER_NAME_KEY  = 'amazii_driver_name';
const DRIVER_PHONE_KEY = 'amazii_driver_phone';

function normalisePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function formatPhone(phone: string) {
  const d = normalisePhone(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-amazii-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ─── WhatsApp notification sent directly from the driver's device ─────────────

async function sendDriverWhatsApp(
  driverName: string,
  driverPhone: string,
  orderId: string,
  details: ClaimedDetails,
  tenantSlug: string
) {
  const claimUrl   = `https://elevare-menu.vercel.app/${tenantSlug}/aceitar/${orderId}?driver=${encodeURIComponent(driverName)}`;
  const addressQuery = encodeURIComponent(`${details.address}, ${details.neighborhood}`);
  const mapsUrl    = `https://maps.google.com/?q=${addressQuery}`;

  const itemsText = details.items
    .map(item => {
      let line = `${item.quantity}x ${item.productName} — ${formatCurrency(item.total)}`;
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        const opts = item.selectedOptions
          .map(o => `  + ${o.quantity > 1 ? `${o.quantity}x ` : ''}${o.optionName}`)
          .join('\n');
        line += `\n${opts}`;
      }
      return line;
    })
    .join('\n');

  const message =
    `📦 Entrega confirmada! Você garantiu esta corrida.\n\n` +
    `Cliente: ${details.customerName} - ${details.customerPhone}\n` +
    `Endereço: ${details.address} - ${details.neighborhood}\n` +
    `Valor Frete: ${formatCurrency(details.deliveryFee)}\n\n` +
    `Itens:\n${itemsText}\n\n` +
    `📍 Link da Rota: ${mapsUrl}\n\n` +
    `🔗 Seu link de entrega (salve!):\n${claimUrl}\n\n` +
    `_(O link expira quando a entrega for finalizada)_`;

  await whatsappService.sendMessage(tenantSlug, driverPhone, message);
  console.log(`[DriverClaim] WhatsApp enviado para ${driverName} - ${driverPhone}`);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DriverClaimPage() {
  const { tenantSlug = '', orderId = '' } = useParams<{ tenantSlug: string; orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [state, setState] = useState<PageState>('loading');
  const [claimedBy, setClaimedBy] = useState('');
  const [claimed, setClaimed] = useState<ClaimedDetails | null>(null);
  const [driverName, setDriverName]   = useState<string>(() => localStorage.getItem(DRIVER_NAME_KEY)  || '');
  const [driverPhone, setDriverPhone] = useState<string>(() => localStorage.getItem(DRIVER_PHONE_KEY) || '');
  const [neighborhood, setNeighborhood] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [nameError, setNameError]   = useState('');
  const [phoneError, setPhoneError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── On mount: fetch styling by tenantSlug ──────────────────────────────
  useEffect(() => {
    if (!tenantSlug) return;
    supabaseService.getRestaurantBySlug(tenantSlug).then(rest => {
      if (rest) {
        supabaseService.getSettings(rest.id).then(settings => {
          if (settings) {
            const root = document.documentElement;
            root.style.setProperty('--amazii-primary', settings.primaryColor || '#7c3aed');
            root.style.setProperty('--amazii-secondary', settings.secondaryColor || '#a78bfa');
            root.style.setProperty('--amazii-dark', `color-mix(in srgb, ${settings.primaryColor || '#7c3aed'}, black 20%)`);
            root.style.setProperty('--amazii-muted', `color-mix(in srgb, ${settings.primaryColor || '#7c3aed'}, transparent 15%)`);
            if (settings.storeName) document.title = settings.storeName + ' - Entregador';
          }
        });
      }
    });
  }, [tenantSlug]);

  // ── On mount: fetch order, handle persistence via URL ?driver= ───────────
  useEffect(() => {
    if (!orderId) { setState('error'); return; }

    supabaseService.getOrderPublic(orderId)
      .then(data => {
        if (!data.found) {
          setState('error');
          return;
        }

        setNeighborhood(data.neighborhood || '');
        setDeliveryFee(data.deliveryFee ?? 0);

        // Order already claimed
        if (!data.claimable) {
          const urlDriver = searchParams.get('driver');
          const cachedDriver = localStorage.getItem(DRIVER_NAME_KEY);
          const myName = urlDriver || cachedDriver;

          // Check if the current driver is the one who claimed it
          if (myName && data.driverName && myName.trim().toLowerCase() === data.driverName.trim().toLowerCase()) {
            // It's the same driver — check if order is still active or already done
            if (data.status === 'finalizado' || data.status === 'cancelado') {
              // Link expired — order is done
              setState('delivered');
              return;
            }
            // ✅ Restore full success state
            setClaimed({
              driverName: data.driverName,
              customerName: data.customerName || '',
              customerPhone: data.customerPhone || '',
              address: data.address || '',
              neighborhood: data.neighborhood || '',
              deliveryFee: data.deliveryFee ?? 0,
              observation: data.observation,
              items: data.items || [],
            });
            setState('success');
            // Make sure driver name is in URL for future refreshes
            if (!urlDriver && data.driverName) {
              setSearchParams({ driver: data.driverName }, { replace: true });
            }
          } else {
            // Someone else got it
            setClaimedBy(data.driverName || 'outro entregador');
            setState('already_claimed');
          }
          return;
        }

        // Available — pre-fill from URL if present
        const urlDriver = searchParams.get('driver');
        if (urlDriver) setDriverName(urlDriver);
        setState('available');
        setTimeout(() => inputRef.current?.focus(), 200);
      })
      .catch(() => setState('error'));
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle claim button ──────────────────────────────────────────────────
  const handleClaim = async () => {
    const trimmedName  = driverName.trim();
    const trimmedPhone = driverPhone.replace(/\D/g, '');
    let valid = true;

    if (!trimmedName) { setNameError('Digite seu nome para continuar.'); valid = false; }
    else setNameError('');

    if (trimmedPhone.length < 10) { setPhoneError('Digite um número de WhatsApp válido (com DDD).'); valid = false; }
    else setPhoneError('');

    if (!valid) return;

    localStorage.setItem(DRIVER_NAME_KEY,  trimmedName);
    localStorage.setItem(DRIVER_PHONE_KEY, trimmedPhone);
    setState('claiming');

    try {
      const result = await supabaseService.claimDelivery(orderId, trimmedName, trimmedPhone);

      if (result.success) {
        const details: ClaimedDetails = {
          driverName:    trimmedName,
          customerName:  result.customerName!,
          customerPhone: result.customerPhone!,
          address:       result.address!,
          neighborhood:  result.neighborhood!,
          deliveryFee:   result.deliveryFee!,
          observation:   result.observation,
          items:         result.items || [],
        };
        setClaimed(details);
        setState('success');
        // Persist driver name in URL — enables refresh persistence
        setSearchParams({ driver: trimmedName }, { replace: true });

        // 📨 Envia WhatsApp ao motoboy AGORA, direto desta página (100% confiável)
        sendDriverWhatsApp(trimmedName, trimmedPhone, orderId, details, tenantSlug).catch(
          e => console.error('[DriverClaim] Falha ao enviar WhatsApp:', e)
        );
      } else {
        setClaimedBy(result.claimedBy || 'outro entregador');
        setState('already_claimed');
      }
    } catch {
      setState('error');
    }
  };

  // ────────────────────────────── RENDERS ──────────────────────────────────

  // ── Loading ───────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amazii-dark to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="w-12 h-12 animate-spin text-amazii-secondary" />
          <p className="text-lg font-medium opacity-80">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pedido indisponível</h1>
          <p className="text-gray-500 text-sm">Este pedido não está mais disponível para aceite, ou o link é inválido.</p>
        </div>
      </div>
    );
  }

  // ── Already claimed ───────────────────────────────────────────
  if (state === 'already_claimed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-950/50 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pedido já aceito!</h1>
          <p className="text-gray-500 text-sm mb-4">Essa entrega foi garantida por</p>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4 mb-6">
            <div className="flex items-center justify-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-orange-800 text-lg">{claimedBy}</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">Fique de olho! Novas entregas podem aparecer a qualquer momento. 🛵</p>
        </div>
      </div>
    );
  }

  // ── Link expirado — entrega finalizada ───────────────────────
  if (state === 'delivered') {
    const myName = searchParams.get('driver') || localStorage.getItem(DRIVER_NAME_KEY) || 'Você';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amazii-dark to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Entrega Finalizada! 🏁</h1>
          <p className="text-gray-500 text-sm mb-4">
            Bom trabalho, <strong>{myName}</strong>! Esta entrega foi concluída com sucesso.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 mb-4">
            <p className="text-xs text-gray-400">🔒 Este link expirou — o pedido foi finalizado.</p>
          </div>
          <p className="text-sm text-gray-400">Fique de olho para as próximas entregas! 🛵</p>
        </div>
      </div>
    );
  }

  // ── SUCCESS — Full order info ──────────────────────────────────

  if (state === 'success' && claimed) {
    const addressQuery = encodeURIComponent(`${claimed.address}, ${claimed.neighborhood}`);
    const mapsUrl     = `https://maps.google.com/?q=${addressQuery}`;
    const waUrl       = `https://wa.me/55${normalisePhone(claimed.customerPhone)}`;
    const callUrl     = `tel:+55${normalisePhone(claimed.customerPhone)}`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amazii-dark to-slate-900 flex flex-col items-center justify-start p-4 pb-8">
        {/* ── Header ── */}
        <div className="text-center pt-8 pb-6 w-full max-w-sm">
          <div className="w-16 h-16 bg-green-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-500/30">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Entrega Aceita! 🎉</h1>
          <p className="text-white/80 text-sm mt-1">Você foi o primeiro — a corrida é sua!</p>
        </div>

        {/* ── Main card ── */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

          {/* Driver + fee banner */}
          <div className="bg-amazii-gradient px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 opacity-80" />
                <span className="font-bold text-sm">{claimed.driverName}</span>
              </div>
              <div className="flex items-center gap-1 bg-white/20 rounded-xl px-3 py-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="font-bold text-sm">{formatCurrency(claimed.deliveryFee)}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="px-5 pb-2">
            {/* Cliente */}
            <InfoRow icon={<User className="w-4 h-4" />} label="Cliente">
              <p className="font-bold text-gray-900 text-base">{claimed.customerName}</p>
              <p className="text-sm text-gray-500">{formatPhone(claimed.customerPhone)}</p>
            </InfoRow>

            {/* Endereço */}
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Endereço">
              <p className="font-semibold text-gray-900 text-sm leading-snug">{claimed.address}</p>
              <p className="text-sm text-gray-500">{claimed.neighborhood}</p>
            </InfoRow>

            {/* Itens */}
            {claimed.items.length > 0 && (
              <InfoRow icon={<Package className="w-4 h-4" />} label="Itens do Pedido">
                <div className="space-y-2 mt-0.5">
                  {claimed.items.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-gray-800">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="text-sm text-gray-600 shrink-0 ml-2">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="mt-0.5 space-y-0.5 pl-3">
                          {item.selectedOptions.map((opt, i) => (
                            <p key={i} className="text-xs text-gray-400">
                              + {opt.quantity > 1 ? `${opt.quantity}x ` : ''}{opt.optionName}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex justify-between pt-2 mt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Taxa de entrega</span>
                    <span className="text-xs font-semibold text-gray-600">{formatCurrency(claimed.deliveryFee)}</span>
                  </div>
                </div>
              </InfoRow>
            )}

            {/* Observação */}
            {claimed.observation && (
              <InfoRow icon={<ClipboardList className="w-4 h-4" />} label="Observação">
                <p className="text-sm text-gray-700">{claimed.observation}</p>
              </InfoRow>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-5 space-y-3">
            {/* GPS */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full bg-amazii-primary hover:bg-amazii-dark text-white font-bold px-5 py-4 rounded-2xl transition-colors shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3">
                <Navigation className="w-5 h-5" />
                <span>Abrir no GPS</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-70" />
            </a>

            {/* Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={callUrl}
                className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 font-semibold py-3.5 rounded-2xl hover:bg-blue-100 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Ligar
              </a>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 font-semibold py-3.5 rounded-2xl hover:bg-green-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        <p className="text-white/30 text-xs mt-5 text-center">Boa entrega! 🛵 · Você pode salvar esta página nos favoritos</p>
      </div>
    );
  }

  // ── AVAILABLE — enter name and accept ─────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amazii-dark to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Pulse badge */}
      <div className="flex items-center gap-2 bg-amazii-primary/30 border border-amazii-secondary/50 rounded-full px-5 py-2 mb-6 shadow-sm">
        <div className="w-2 h-2 bg-amazii-secondary rounded-full animate-pulse" />
        <span className="text-white font-semibold text-sm">Nova entrega disponível</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-amazii-gradient px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <Truck className="w-6 h-6" />
            <h1 className="text-xl font-bold">🚀 NOVA ENTREGA!</h1>
          </div>
          <p className="text-white/80 text-sm">Seja o primeiro a aceitar e garanta a corrida.</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Order chips */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
              <MapPin className="w-5 h-5 text-amazii-primary mx-auto mb-1" />
              <p className="text-xs text-gray-500 mb-0.5">Bairro</p>
              <p className="font-bold text-gray-900 text-sm leading-tight">{neighborhood || '—'}</p>
            </div>
            <div className="bg-amazii-muted rounded-2xl p-4 text-center border-amazii-primary/10 border">
              <DollarSign className="w-5 h-5 text-amazii-primary mx-auto mb-1" />
              <p className="text-xs text-gray-500 mb-0.5">Taxa de entrega</p>
              <p className="font-bold text-amazii-primary text-lg">{formatCurrency(deliveryFee)}</p>
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2.5 bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-xs text-yellow-800 leading-relaxed">
              O endereço completo e os dados do cliente só aparecem <strong>após você aceitar</strong> a entrega.
            </p>
          </div>

          {/* Name + Phone inputs */}
          <div className="space-y-3">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Seu nome</label>
              <input
                ref={inputRef}
                type="text"
                value={driverName}
                onChange={e => { setDriverName(e.target.value); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && state === 'available' && handleClaim()}
                placeholder="Ex: João da Silva"
                maxLength={60}
                className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none transition-colors ${nameError ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-amazii-primary'}`}
              />
              {nameError && <p className="text-red-500 text-xs mt-1.5">⚠ {nameError}</p>}
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Seu WhatsApp <span className="text-gray-400 font-normal">(com DDD)</span>
              </label>
              <input
                type="tel"
                value={driverPhone}
                onChange={e => { setDriverPhone(e.target.value); setPhoneError(''); }}
                onKeyDown={e => e.key === 'Enter' && state === 'available' && handleClaim()}
                placeholder="Ex: 88 9 8164-5083"
                maxLength={20}
                className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none transition-colors ${phoneError ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-amazii-primary'}`}
              />
              {phoneError && <p className="text-red-500 text-xs mt-1.5">⚠ {phoneError}</p>}
              <p className="text-xs text-gray-400 mt-1.5">Você receberá as informações da entrega neste número.</p>
            </div>
          </div>

          {/* Claim button */}
          <button
            onClick={handleClaim}
            disabled={state === 'claiming'}
            className="w-full flex items-center justify-center gap-3 bg-amazii-primary hover:bg-amazii-dark disabled:opacity-60 text-white font-bold text-lg py-4 rounded-2xl transition-colors shadow-lg shadow-black/20 active:scale-95"
          >
            {state === 'claiming'
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Aceitando...</>
              : <><CheckCircle2 className="w-5 h-5" /> Aceitar Esta Entrega</>}
          </button>
        </div>
      </div>

      <p className="text-white/30 text-xs mt-6 text-center max-w-xs">
        Ao aceitar, você se compromete a realizar a entrega. O lojista será notificado automaticamente.
      </p>
    </div>
  );
}
