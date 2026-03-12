import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { superAdminService } from '@/services/superAdminService';
import { shadowTestSteps } from '@/services/mockAdmin';
import {
  Database, Server, MessageCircle, Activity, AlertTriangle, CheckCircle2,
  RefreshCw, Loader2, LogOut, Zap, Shield, Terminal,
  Play, RotateCcw, Trash2, Power, ChevronRight, Wifi, WifiOff,
  Archive, AlertOctagon, Package, Users, Plus, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ───────────────────────────────────────────────────────────────
const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

const EVO_URL  = import.meta.env.VITE_WHATSAPP_API_URL  as string;
const EVO_KEY  = import.meta.env.VITE_WHATSAPP_API_KEY  as string;
const EVO_INST = import.meta.env.VITE_WHATSAPP_INSTANCE as string;
const SB_URL   = import.meta.env.VITE_SUPABASE_URL      as string;
const SB_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Free-tier limits
const SUPABASE_DB_LIMIT_MB  = 500;
const SUPABASE_ROW_WARN     = 400_000; // warn at 80% of ~500k rows

type Status = 'ok' | 'warn' | 'error' | 'loading';
type StepStatus = 'idle' | 'running' | 'ok' | 'error';
type EvoInstance = { instanceName: string; state?: string; connectionStatus?: string };
type LogRow = { id: string; level: string; message: string; created_at: string };

function Led({ on }: { on: boolean | null }) {
  if (on === null) return <span className="inline-block w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />;
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', on ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-red-500 animate-pulse')} />;
}

function Pill({ label, s }: { label: string; s: Status }) {
  const cls: Record<Status, string> = {
    ok:      'bg-green-900/60 text-green-300 border-green-800/50',
    warn:    'bg-yellow-900/60 text-yellow-300 border-yellow-800/50',
    error:   'bg-red-900/60 text-red-300 border-red-800/50',
    loading: 'bg-gray-800 text-gray-500 border-gray-700',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls[s]}`}>{label}</span>;
}

function Bar({ pct, s }: { pct: number; s: Status }) {
  const color = { ok: 'bg-emerald-500', warn: 'bg-yellow-500', error: 'bg-red-500', loading: 'bg-gray-700' }[s];
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-gray-900 rounded-2xl border border-gray-800/80 p-4', className)}>{children}</div>;
}

function STitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  );
}

function Btn({
  onClick, label, icon: Icon, variant = 'default', loading = false, disabled = false, full = false
}: {
  onClick: () => void; label: string; icon: React.ElementType;
  variant?: 'default' | 'danger' | 'warn' | 'primary'; loading?: boolean; disabled?: boolean; full?: boolean;
}) {
  const cls = {
    default: 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700',
    danger:  'bg-red-950/60 border-red-800/50 text-red-300 hover:bg-red-900/50',
    warn:    'bg-yellow-950/60 border-yellow-800/50 text-yellow-300 hover:bg-yellow-900/50',
    primary: 'bg-purple-950/60 border-purple-700/50 text-purple-200 hover:bg-purple-900/50',
  }[variant];
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={cn(`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 ${cls}`, full && 'w-full justify-center')}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  // ── Supabase / DB ────────────────────────────────────────────────────────
  const [dbRows, setDbRows]       = useState({ orders: 0, logs: 0, products: 0, archive: 0 });
  const [dbSizeMB, setDbSizeMB]   = useState<number | null>(null);
  const [sbLatency, setSbLatency] = useState<number | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  // ── Evolution API / Render ───────────────────────────────────────────────
  const [evoLatency, setEvoLatency]       = useState<number | null>(null);
  const [evoInstances, setEvoInstances]   = useState<EvoInstance[]>([]);
  const [waConnected, setWaConnected]     = useState<boolean | null>(null);
  const [evoLoading, setEvoLoading]       = useState(true);

  // ── Recent errors ────────────────────────────────────────────────────────
  const [recentErrors, setRecentErrors] = useState<LogRow[]>([]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const [archivingOrders, setArchivingOrders]   = useState(false);
  const [clearingLogs, setClearingLogs]         = useState(false);
  const [clearingArchive, setClearingArchive]   = useState(false);
  const [resettingWA, setResettingWA]           = useState(false);
  const [maintenanceMode, setMaintenanceMode]   = useState(false);

  // ── Shadow test ──────────────────────────────────────────────────────────
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(['idle','idle','idle']);
  const [testRunning, setTestRunning]   = useState(false);

  // ── Onboarding ───────────────────────────────────────────────────────────
  const [newRest, setNewRest]       = useState({ name: '', slug: '' });
  const [creatingRest, setCreatingRest] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadDB(), loadEvo()]);
  }, []);

  // ── Load Supabase / DB ───────────────────────────────────────────────────
  const loadDB = async () => {
    setDbLoading(true);
    try {
      // Row counts
      const [o, l, p, a] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('system_logs').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders_archive').select('id', { count: 'exact', head: true }),
      ]);
      setDbRows({ orders: o.count ?? 0, logs: l.count ?? 0, products: p.count ?? 0, archive: a.count ?? 0 });

      // Estimated size: avg bytes per row per table
      const estimatedMB = (
        (o.count ?? 0) * 2200 +
        (l.count ?? 0) * 400  +
        (p.count ?? 0) * 800  +
        (a.count ?? 0) * 2000
      ) / 1_048_576;
      setDbSizeMB(estimatedMB);

      // Ping Supabase latency
      const t0 = Date.now();
      await fetch(`${SB_URL}/rest/v1/`, { headers: { apikey: SB_KEY }, signal: AbortSignal.timeout(5000) });
      setSbLatency(Date.now() - t0);

      // Recent errors from system_logs
      const { data: errData } = await supabase
        .from('system_logs')
        .select('id, level, message, created_at')
        .in('level', ['error', 'warn'])
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentErrors(errData || []);
    } catch { /* silent */ }
    finally { setDbLoading(false); }
  };

  // ── Load Evolution API (= Render) ────────────────────────────────────────
  const loadEvo = async () => {
    setEvoLoading(true);
    try {
      // 1. Ping to get Render latency and list of instances
      const t0 = Date.now();
      const pingRes = await fetch(`${EVO_URL}/instance/fetchInstances`, {
        headers: { apikey: EVO_KEY },
        signal: AbortSignal.timeout(8000),
      });
      setEvoLatency(Date.now() - t0);

      if (pingRes.ok) {
        const raw = await pingRes.json();
        // Normalise response — Evolution returns array or object
        const list: EvoInstance[] = Array.isArray(raw) ? raw :
          Array.isArray(raw?.data) ? raw.data :
          Array.isArray(raw?.instances) ? raw.instances : [];
        setEvoInstances(list);
      }

      // 2. Query true connection state of the specific instance
      try {
        const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${EVO_INST}`, {
          headers: { apikey: EVO_KEY },
          signal: AbortSignal.timeout(5000),
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          const state = stateData?.instance?.state || '';
          setWaConnected(state === 'open' || state === 'connected');
        } else {
          setWaConnected(false);
        }
      } catch {
        setWaConnected(false);
      }
    } catch {
      setEvoLatency(null);
      setWaConnected(false);
    }
    finally { setEvoLoading(false); }
  };

  // ── Action: Archive old orders ───────────────────────────────────────────
  const archiveOrders = async () => {
    setArchivingOrders(true);
    try {
      const n = await superAdminService.archiveOldOrders();
      toast.success(n > 0 ? `✅ ${n} pedidos arquivados — espaço liberado!` : 'Nenhum pedido elegível (>90 dias)');
      loadDB();
    } catch { toast.error('Erro ao arquivar pedidos'); }
    finally { setArchivingOrders(false); }
  };

  // ── Action: Clear logs >30d ──────────────────────────────────────────────
  const clearLogs = async () => {
    setClearingLogs(true);
    try {
      const n = await superAdminService.clearOldLogs();
      toast.success(n > 0 ? `✅ ${n} logs removidos — espaço liberado!` : 'Nenhum log elegível (>30 dias)');
      loadDB();
    } catch { toast.error('Erro ao limpar logs'); }
    finally { setClearingLogs(false); }
  };

  // ── Action: Clear orders_archive >180d ──────────────────────────────────
  const clearArchive = async () => {
    setClearingArchive(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 180);
      const { error } = await supabase
        .from('orders_archive')
        .delete()
        .lt('created_at', cutoff.toISOString());
      if (error) throw error;
      toast.success(`✅ Arquivo antigo limpo — espaço liberado!`);
      loadDB();
    } catch { toast.error('Erro ao limpar arquivo'); }
    finally { setClearingArchive(false); }
  };

  // ── Action: Reset WA ─────────────────────────────────────────────────────
  const resetWA = async () => {
    setResettingWA(true);
    try {
      const res = await fetch(`${EVO_URL}/instance/restart/${EVO_INST}`, {
        method: 'POST',
        headers: { apikey: EVO_KEY },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) toast.success('✅ Instância WA reiniciada com sucesso!');
      else toast.error(`Falha: ${res.status} ${res.statusText}`);
      setTimeout(() => loadEvo(), 3000);
    } catch { toast.error('Não foi possível acessar a Evolution API'); }
    finally { setResettingWA(false); }
  };

  // ── Action: Create restaurant ────────────────────────────────────────────
  const createRestaurant = async () => {
    if (!newRest.name || !newRest.slug) { toast.error('Nome e slug são obrigatórios'); return; }
    setCreatingRest(true);
    try {
      const { error } = await supabase.from('restaurants').insert({
        id: crypto.randomUUID(),
        name: newRest.name,
        slug: newRest.slug.toLowerCase().replace(/\s+/g, '-'),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(`Restaurante "${newRest.name}" criado!`);
      setNewRest({ name: '', slug: '' });
    } catch (e: any) { toast.error(e.message || 'Erro ao criar'); }
    finally { setCreatingRest(false); }
  };

  // ── Shadow test ──────────────────────────────────────────────────────────
  const runShadowTest = async () => {
    setTestRunning(true);
    setStepStatuses(['idle','idle','idle']);
    for (let i = 0; i < shadowTestSteps.length; i++) {
      setStepStatuses(p => p.map((_, j) => j === i ? 'running' : p[j]));
      await new Promise(r => setTimeout(r, shadowTestSteps[i].durationMs));
      const ok = i === 0 ? sbLatency !== null :
                 i === 1 ? dbRows.orders >= 0 :
                           waConnected === true;
      setStepStatuses(p => p.map((_, j) => j === i ? (ok ? 'ok' : 'error') : p[j]));
      if (!ok) { toast.error(`Falha em: ${shadowTestSteps[i].label}`); setTestRunning(false); return; }
    }
    toast.success('✅ Sistema funcionando corretamente!');
    setTestRunning(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const dbPct    = dbSizeMB ? Math.min((dbSizeMB / SUPABASE_DB_LIMIT_MB) * 100, 100) : 0;
  const dbStatus: Status = dbLoading ? 'loading' : dbPct > 80 ? 'error' : dbPct > 60 ? 'warn' : 'ok';
  const sbStatus: Status = !sbLatency ? 'error' : sbLatency < 500 ? 'ok' : sbLatency < 1500 ? 'warn' : 'error';
  const evoStatus: Status = evoLoading ? 'loading' : evoLatency === null ? 'error' : evoLatency < 800 ? 'ok' : evoLatency < 2000 ? 'warn' : 'error';

  const totalRows      = dbRows.orders + dbRows.logs + dbRows.products + dbRows.archive;
  const evoActive      = evoInstances.filter(i => (i.connectionStatus ?? i.state) === 'open' || (i.connectionStatus ?? i.state) === 'connected').length;
  const evoError       = evoInstances.length - evoActive;
  const overloaded     = dbStatus === 'error' || !waConnected || evoStatus === 'error';

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-6 font-mono space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h1 className="text-base font-bold tracking-tight">AMAZII SUPER ADMIN</h1>
            {overloaded
              ? <span className="px-2 py-0.5 bg-red-900/50 border border-red-700/40 rounded text-[10px] text-red-300 font-bold animate-pulse">⚠ ATENÇÃO REQUERIDA</span>
              : <span className="px-2 py-0.5 bg-green-900/50 border border-green-700/40 rounded text-[10px] text-green-300 font-bold">✓ SISTEMA ESTÁVEL</span>
            }
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{new Date().toLocaleString('pt-BR')} · Todos os dados são em tempo real</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors" title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={() => { superAdminService.logout(); navigate('/superadmin/login'); }}
            className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-red-950/50 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ════════════ 1. INFRA STATUS ════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Supabase DB */}
        <Card>
          <STitle icon={Database} label="Supabase — PostgreSQL" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Led on={dbStatus !== 'error'} /><span className="text-[11px] text-gray-300 font-bold">Database</span></div>
              <Pill label={dbStatus === 'loading' ? '...' : dbStatus === 'ok' ? 'NORMAL' : dbStatus === 'warn' ? 'ATENÇÃO' : 'CRÍTICO'} s={dbStatus} />
            </div>
            {/* DB Size bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-400">Tamanho do BD</span>
                <span className={cn('font-bold', dbStatus === 'error' ? 'text-red-400' : dbStatus === 'warn' ? 'text-yellow-400' : 'text-green-400')}>
                  {dbSizeMB !== null ? `~${dbSizeMB.toFixed(0)} MB / ${SUPABASE_DB_LIMIT_MB} MB` : '…'}
                </span>
              </div>
              <Bar pct={dbPct} s={dbStatus} />
              <p className="text-[10px] text-gray-600 mt-0.5">Limite gratuito Supabase: 500 MB</p>
            </div>
            {/* Row counts */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Pedidos ativos',  val: dbRows.orders  },
                { label: 'Logs do sistema', val: dbRows.logs, warn: dbRows.logs > 50000    },
                { label: 'Pedidos arquivo', val: dbRows.archive                             },
                { label: 'Produtos',        val: dbRows.products                            },
              ].map(r => (
                <div key={r.label} className={cn('rounded-lg px-2.5 py-1.5', r.warn ? 'bg-yellow-900/20 border border-yellow-800/30' : 'bg-gray-800/60')}>
                  <p className="text-[10px] text-gray-500">{r.label}</p>
                  <p className={cn('text-xs font-bold', r.warn ? 'text-yellow-400' : 'text-white')}>
                    {dbLoading ? '…' : r.val.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] border-t border-gray-800 pt-2">
              <span className="text-gray-500">Latência Supabase</span>
              <span className={cn('font-bold', !sbLatency ? 'text-gray-500' : sbLatency < 500 ? 'text-green-400' : 'text-yellow-400')}>
                {sbLatency ? `${sbLatency}ms` : '—'}
              </span>
            </div>
          </div>
        </Card>

        {/* Evolution API / Render */}
        <Card>
          <STitle icon={Server} label="Evolution API — Render" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Led on={evoLatency !== null} /><span className="text-[11px] text-gray-300 font-bold truncate max-w-[160px]">{EVO_URL?.replace('https://','').split('/')[0]}</span></div>
              <Pill label={evoLoading ? '...' : evoStatus === 'ok' ? 'ONLINE' : evoStatus === 'warn' ? 'LENTO' : 'OFFLINE'} s={evoStatus} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-gray-800/60 rounded-lg px-2 py-2 text-center">
                <p className="text-base font-bold text-white">{evoLoading ? '…' : evoInstances.length}</p>
                <p className="text-[10px] text-gray-500">Instâncias</p>
              </div>
              <div className="bg-green-900/20 rounded-lg px-2 py-2 text-center border border-green-800/30">
                <p className="text-base font-bold text-green-400">{evoLoading ? '…' : evoActive}</p>
                <p className="text-[10px] text-green-500">Ativas</p>
              </div>
              <div className={cn('rounded-lg px-2 py-2 text-center border', evoError > 0 ? 'bg-red-900/20 border-red-800/30' : 'bg-gray-800/40 border-gray-700/30')}>
                <p className={cn('text-base font-bold', evoError > 0 ? 'text-red-400' : 'text-gray-500')}>{evoLoading ? '…' : evoError}</p>
                <p className={cn('text-[10px]', evoError > 0 ? 'text-red-500' : 'text-gray-600')}>Com erro</p>
              </div>
            </div>
            {/* Instance list */}
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {evoLoading ? (
                <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-600" /></div>
              ) : evoInstances.length === 0 ? (
                <p className="text-[11px] text-gray-600 text-center py-2">Nenhuma instância encontrada</p>
              ) : evoInstances.map((inst, i) => {
                const state = inst.connectionStatus ?? inst.state ?? '';
                const on = state === 'open' || state === 'connected';
                return (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-gray-800/40 last:border-0">
                    <div className="flex items-center gap-1.5"><Led on={on} /><span className="text-[11px] text-gray-300">{inst.instanceName}</span></div>
                    <span className={cn('text-[10px] font-bold', on ? 'text-green-400' : 'text-red-400')}>{state || 'unknown'}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] border-t border-gray-800 pt-2">
              <span className="text-gray-500">Latência do Render</span>
              <span className={cn('font-bold', !evoLatency ? 'text-red-400' : evoLatency < 800 ? 'text-green-400' : evoLatency < 2000 ? 'text-yellow-400' : 'text-red-400')}>
                {evoLatency ? `${evoLatency}ms` : 'Sem resposta'}
              </span>
            </div>
          </div>
        </Card>

        {/* WhatsApp principal */}
        <Card>
          <STitle icon={MessageCircle} label="WhatsApp — Instância Principal" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Led on={waConnected} /><span className="text-[11px] font-bold text-gray-300">{EVO_INST}</span></div>
              <Pill label={waConnected === null ? '...' : waConnected ? 'CONECTADO' : 'DESCONECTADO'} s={waConnected === null ? 'loading' : waConnected ? 'ok' : 'error'} />
            </div>
            {waConnected === false && (
              <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-[11px] text-red-300 font-bold">Instância desconectada!</p>
                </div>
                <p className="text-[10px] text-red-400/80">Mensagens não estão sendo enviadas. Use o botão "Reiniciar WA" abaixo ou reconecte em Configurações → WhatsApp.</p>
              </div>
            )}
            {waConnected === true && (
              <div className="p-3 bg-green-950/20 border border-green-900/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-[11px] text-green-300">Conectado — mensagens funcionando</p>
                </div>
              </div>
            )}
            <div className="text-[10px] text-gray-600 space-y-1 border-t border-gray-800 pt-2">
              <div className="flex justify-between"><span>API URL</span><span className="text-gray-500 truncate max-w-[160px]">{EVO_URL?.replace('https://','')}</span></div>
              <div className="flex justify-between"><span>Total instâncias</span><span className="text-gray-400 font-bold">{evoInstances.length}</span></div>
            </div>
          </div>
        </Card>
      </div>

      {/* ════════════ 2. FIX OVERLOAD ════════════ */}
      <Card>
        <STitle icon={Zap} label="Anti-Sobrecarga — Ações de Recuperação" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Arquivar pedidos */}
          <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40 space-y-2">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-gray-200">Arquivar Pedidos</span>
            </div>
            <p className="text-[11px] text-gray-500">Move pedidos finalizados/cancelados com <strong className="text-gray-300">&gt;90 dias</strong> para arquivo. Libera espaço no BD principal.</p>
            <p className="text-[11px] text-yellow-400">~{dbRows.orders} pedidos ativos no BD</p>
            <Btn onClick={archiveOrders} label="Arquivar agora" icon={Archive} variant="primary" loading={archivingOrders} full />
          </div>

          {/* Limpar logs */}
          <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40 space-y-2">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-gray-200">Limpar Logs</span>
            </div>
            <p className="text-[11px] text-gray-500">Deleta logs do sistema com <strong className="text-gray-300">&gt;30 dias</strong>. Logs são a maior fonte de crescimento do BD.</p>
            <p className={cn('text-[11px]', dbRows.logs > 50000 ? 'text-red-400 font-bold' : 'text-yellow-400')}>
              {dbRows.logs.toLocaleString()} logs no BD{dbRows.logs > 50000 ? ' ⚠ CRÍTICO' : ''}
            </p>
            <Btn onClick={clearLogs} label="Limpar logs" icon={Trash2} variant="warn" loading={clearingLogs} full />
          </div>

          {/* Limpar arquivo antigo */}
          <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40 space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-gray-200">Limpar Arquivo</span>
            </div>
            <p className="text-[11px] text-gray-500">Remove permanentemente pedidos do arquivo com <strong className="text-gray-300">&gt;180 dias</strong>. Ação irreversível.</p>
            <p className="text-[11px] text-gray-500">{dbRows.archive.toLocaleString()} pedidos no arquivo</p>
            <Btn onClick={clearArchive} label="Limpar arquivo" icon={AlertOctagon} variant="danger" loading={clearingArchive} full />
          </div>

          {/* Reiniciar WA */}
          <div className={cn('rounded-xl p-3 border space-y-2', !waConnected ? 'bg-red-950/30 border-red-800/40' : 'bg-gray-800/40 border-gray-700/40')}>
            <div className="flex items-center gap-2">
              <RotateCcw className={cn('w-4 h-4', !waConnected ? 'text-red-400' : 'text-gray-400')} />
              <span className="text-xs font-bold text-gray-200">Reiniciar WhatsApp</span>
            </div>
            <p className="text-[11px] text-gray-500">Chama <code className="text-purple-400">POST /instance/restart</code> na Evolution API. Use se a instância travar ou desconectar.</p>
            <p className={cn('text-[11px]', waConnected ? 'text-green-400' : 'text-red-400 font-bold')}>
              {waConnected === null ? '...' : waConnected ? 'Online — preventivo' : '⚠ Offline — URGENTE'}
            </p>
            <Btn onClick={resetWA} label="Reiniciar WA" icon={RotateCcw} variant={!waConnected ? 'danger' : 'default'} loading={resettingWA} full />
          </div>
        </div>

        {/* Maintenance toggle */}
        <div className="flex items-center justify-between mt-4 p-3 bg-gray-800/30 rounded-xl border border-gray-700/40">
          <div className="flex items-center gap-3">
            <Power className={cn('w-4 h-4', maintenanceMode ? 'text-red-400' : 'text-gray-500')} />
            <div>
              <p className="text-xs font-bold text-gray-200">Modo Manutenção Global</p>
              <p className="text-[10px] text-gray-500">Bloqueia novos pedidos em todos os restaurantes — use durante manutenção emergencial</p>
            </div>
          </div>
          <button
            onClick={() => { setMaintenanceMode(p => !p); toast(maintenanceMode ? 'Manutenção desativada' : '⚠ Modo manutenção ativado — clientes não conseguem pedir!'); }}
            className={cn('relative w-12 h-6 rounded-full transition-colors flex-shrink-0', maintenanceMode ? 'bg-red-600' : 'bg-gray-700')}
          >
            <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform', maintenanceMode ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
      </Card>

      {/* ════════════ 3. SHADOW TEST + RECENT ERRORS ════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Shadow Test */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <STitle icon={Terminal} label="Teste do Sistema — End-to-End" />
            <button onClick={runShadowTest} disabled={testRunning}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 rounded-xl text-[11px] font-bold text-white shadow-lg disabled:opacity-50 -mt-3">
              {testRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Executar Teste
            </button>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Supabase API',    desc: 'Latência do banco de dados',    ok: sbLatency !== null },
              { label: 'Contagem de Dados', desc: 'Tabelas acessíveis e íntegras', ok: dbRows.orders >= 0 },
              { label: 'Evolution API',   desc: 'WhatsApp conectado e operativo', ok: waConnected === true },
            ].map((step, i) => {
              const st = stepStatuses[i];
              return (
                <div key={i} className={cn('flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                  st === 'idle'    ? 'bg-gray-800/30 border-gray-700/30' :
                  st === 'running' ? 'bg-blue-900/20 border-blue-700/40' :
                  st === 'ok'      ? 'bg-green-900/20 border-green-700/40' :
                                     'bg-red-900/20 border-red-700/40'
                )}>
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    st === 'idle' ? 'bg-gray-800 text-gray-500' :
                    st === 'running' ? 'bg-blue-900/50 text-blue-300' :
                    st === 'ok'      ? 'bg-green-900/50 text-green-300' :
                                       'bg-red-900/50 text-red-300'
                  )}>
                    {st === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                     st === 'ok'      ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                     st === 'error'   ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                        <span className="text-xs font-bold">{i+1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-gray-200">{step.label}</p>
                    <p className="text-[10px] text-gray-500">{step.desc}</p>
                  </div>
                  {st === 'idle' && (
                    <span className={cn('text-[10px] font-bold', step.ok ? 'text-green-400' : 'text-red-400')}>
                      {step.ok ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent errors */}
        <Card>
          <STitle icon={AlertTriangle} label="Erros Recentes — system_logs" />
          {recentErrors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <p className="text-[11px] text-green-400 font-bold">Nenhum erro recente</p>
              <p className="text-[10px] text-gray-600">Sistema operando normalmente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentErrors.map(err => (
                <div key={err.id} className={cn('p-2.5 rounded-xl border text-[10px]',
                  err.level === 'error' ? 'bg-red-950/30 border-red-900/30' : 'bg-yellow-950/30 border-yellow-900/30')}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn('font-bold uppercase', err.level === 'error' ? 'text-red-400' : 'text-yellow-400')}>[{err.level}]</span>
                    <span className="text-gray-500">{new Date(err.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-gray-400 leading-snug truncate">{err.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
