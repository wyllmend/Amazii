// ─── Mock data for Super Admin infrastructure dashboard ────────────────────
// All simulated/static data lives here; real API calls are made separately.

export type InfraStatus = 'online' | 'degraded' | 'offline';

// ── Supabase DB ─────────────────────────────────────────────────────────────
export const mockSupabase = {
  dbSizeGB: 1.2,
  dbLimitGB: 2,
  connectionPool: { active: 12, max: 60, status: 'healthy' as InfraStatus },
  tables: [
    { name: 'orders', rows: 48210, sizeKB: 9820 },
    { name: 'system_logs', rows: 128944, sizeKB: 24300 },
    { name: 'products', rows: 312, sizeKB: 480 },
    { name: 'orders_archive', rows: 22100, sizeKB: 4500 },
  ],
};

// ── Render API ──────────────────────────────────────────────────────────────
export const mockRender = {
  status: 'online' as InfraStatus,
  latencyMs: 142,
  cpuPct: 23,
  memoryMB: 342,
  memoryLimitMB: 512,
  region: 'Oregon (US-West)',
  lastDeploy: '2026-03-11T18:34:00Z',
};

// ── Evolution API instances ──────────────────────────────────────────────────
export const mockEvolution = {
  total: 48,
  active: 45,
  error: 3,
  instances: [
    { name: 'AcaiBot',     status: 'active', phone: '+55 11 99999-0001' },
    { name: 'LancheBot',   status: 'active', phone: '+55 11 99999-0002' },
    { name: 'PizzaBot',    status: 'error',  phone: '+55 21 99999-0003' },
    { name: 'SushiBot',    status: 'active', phone: '+55 31 99999-0004' },
    { name: 'BurguerBot',  status: 'error',  phone: '+55 41 99999-0005' },
  ],
};

// ── Webhooks ────────────────────────────────────────────────────────────────
export type WebhookEntry = {
  id: string;
  event: string;
  status: 200 | 500 | 422;
  timestamp: Date;
  payload: object;
};

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60 * 1000);
}

export const mockWebhooks: WebhookEntry[] = [
  { id: 'w1', event: 'messages.upsert',    status: 200, timestamp: minutesAgo(1),  payload: { type: 'messages.upsert', data: { key: { remoteJid: '5511999990001@s.whatsapp.net' }, message: { conversation: 'Oi, quero pedir um açaí!' } } } },
  { id: 'w2', event: 'messages.update',    status: 200, timestamp: minutesAgo(2),  payload: { type: 'messages.update', data: { status: 'READ' } } },
  { id: 'w3', event: 'connection.update',  status: 200, timestamp: minutesAgo(4),  payload: { type: 'connection.update', data: { state: 'open' } } },
  { id: 'w4', event: 'messages.upsert',    status: 500, timestamp: minutesAgo(7),  payload: { type: 'messages.upsert', error: 'Instance not found', code: 500 } },
  { id: 'w5', event: 'send.message',       status: 200, timestamp: minutesAgo(11), payload: { type: 'send.message', data: { to: '5511999990002@s.whatsapp.net', text: 'Pedido confirmado!' } } },
  { id: 'w6', event: 'messages.upsert',    status: 200, timestamp: minutesAgo(15), payload: { type: 'messages.upsert', data: { key: { remoteJid: '5521999990003@s.whatsapp.net' }, message: { conversation: 'Qual o horário?' } } } },
  { id: 'w7', event: 'qr.updated',         status: 422, timestamp: minutesAgo(18), payload: { type: 'qr.updated', error: 'Instance already connected', code: 422 } },
  { id: 'w8', event: 'messages.upsert',    status: 200, timestamp: minutesAgo(22), payload: { type: 'messages.upsert', data: { key: { remoteJid: '5531999990004@s.whatsapp.net' }, message: { conversation: 'Quero cancelar!' } } } },
  { id: 'w9', event: 'connection.update',  status: 200, timestamp: minutesAgo(25), payload: { type: 'connection.update', data: { state: 'close' } } },
  { id: 'w10',event: 'messages.upsert',   status: 200, timestamp: minutesAgo(30), payload: { type: 'messages.upsert', data: { key: { remoteJid: '5541999990005@s.whatsapp.net' }, message: { conversation: 'Boa tarde!' } } } },
];

// ── Domains / SSL ────────────────────────────────────────────────────────────
export type DomainEntry = {
  domain: string;
  restaurant: string;
  sslDaysLeft: number;
  dnsOk: boolean;
};

export const mockDomains: DomainEntry[] = [
  { domain: 'acai-delivery.com.br',    restaurant: 'Açaí do Bom',    sslDaysLeft: 84,  dnsOk: true  },
  { domain: 'burguer-house.com.br',    restaurant: 'Burguer House',  sslDaysLeft: 12,  dnsOk: true  },
  { domain: 'sushiflow.app',           restaurant: 'Sushi Flow',     sslDaysLeft: 7,   dnsOk: false },
  { domain: 'pizzadosul.delivery',     restaurant: 'Pizza do Sul',   sslDaysLeft: 210, dnsOk: true  },
  { domain: 'tapiocaria-mel.com.br',   restaurant: 'Tapiocaria Mel', sslDaysLeft: 3,   dnsOk: true  },
];

// ── Recent Errors ────────────────────────────────────────────────────────────
export type ErrorEntry = {
  id: string;
  level: 'error' | 'warn';
  message: string;
  service: string;
  timestamp: Date;
};

export const mockErrors: ErrorEntry[] = [
  { id: 'e1', level: 'error', message: 'Instance "PizzaBot" disconnected unexpectedly', service: 'Evolution API', timestamp: minutesAgo(5)  },
  { id: 'e2', level: 'warn',  message: 'DB connection pool reached 80% capacity',       service: 'Supabase',      timestamp: minutesAgo(18) },
  { id: 'e3', level: 'error', message: 'Webhook delivery failed 3x — circuit open',     service: 'Evolution API', timestamp: minutesAgo(25) },
  { id: 'e4', level: 'warn',  message: 'SSL cert for sushiflow.app expires in 7 days',  service: 'SSL Monitor',   timestamp: minutesAgo(60) },
  { id: 'e5', level: 'error', message: 'Order insert failed: null restaurant_id',       service: 'Supabase',      timestamp: minutesAgo(120) },
];

// ── Shadow Test Steps ────────────────────────────────────────────────────────
export type ShadowStep = {
  id: string;
  label: string;
  description: string;
  durationMs: number;
};

export const shadowTestSteps: ShadowStep[] = [
  { id: 's1', label: 'API Gateway',      description: 'POST /orders endpoint responds 201', durationMs: 800  },
  { id: 's2', label: 'Supabase Insert',  description: 'Order row created successfully',     durationMs: 1200 },
  { id: 's3', label: 'Evolution WA',     description: 'WhatsApp notification dispatched',   durationMs: 1600 },
];

export function fmtRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}
