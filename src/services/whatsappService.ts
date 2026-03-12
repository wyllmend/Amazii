const API_URL = import.meta.env.VITE_WHATSAPP_API_URL;
const API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;
const INSTANCE = import.meta.env.VITE_WHATSAPP_INSTANCE;

// ─────────────────────────────────────────────────────────────────────────────
// Anti-ban utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a random integer between min and max (inclusive). */
const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Waits for the given amount of milliseconds. */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Normalises a raw phone string to an E.164-style number with country code. */
const normalisePhone = (phone: string) => {
  let clean = phone.replace(/\D/g, '');
  if (clean.length >= 10 && !clean.startsWith('55')) {
    clean = '55' + clean;
  }
  return clean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Message queue
// ─────────────────────────────────────────────────────────────────────────────

type QueueItem = {
  phone: string;
  text: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

let messageQueue: QueueItem[] = [];
let queueRunning = false;

/**
 * Internal worker that drains the queue one message at a time, waiting
 * a random delay of 3–7 seconds between each message to simulate
 * a human operator and avoid WhatsApp ban detection.
 */
async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;

  while (messageQueue.length > 0) {
    const item = messageQueue.shift()!;
    try {
      const result = await dispatchMessage(item.phone, item.text);
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }

    if (messageQueue.length > 0) {
      // Human-like pause between messages: 3 000 – 7 000 ms
      await sleep(randomBetween(3000, 7000));
    }
  }

  queueRunning = false;
}

/**
 * Sends a single message directly, with composing (typing) status
 * shown for a random 1–3 seconds before the actual text is delivered.
 */
async function dispatchMessage(phone: string, text: string) {
  const cleanPhone = normalisePhone(phone);

  // 1. Start composing indicator
  try {
    await fetch(`${API_URL}/chat/presence/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ number: cleanPhone, options: { presence: 'composing' } })
    });
  } catch {
    // Non-fatal – continue even if presence call fails
  }

  // 2. Wait a human-like "typing" delay before sending
  await sleep(randomBetween(1000, 3000));

  // 3. Send the actual message
  const response = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({
      number: cleanPhone,
      text,
      delay: 1200,
      linkPreview: false
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-ban instance settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies recommended anti-ban settings to the Evolution API instance.
 * Should be called once after each successful connection/reconnection.
 */
async function applyAntiBanSettings() {
  try {
    await fetch(`${API_URL}/instance/settings/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({
        rejectCall: true,       // Automatically reject incoming calls
        msgCall: 'Não atendo chamadas por este número. Por favor, envie uma mensagem.',
        groupsIgnore: true,     // Ignore messages from groups
        alwaysOnline: true,     // Keep presence as "online"
        readMessages: false,    // Don't auto-read messages (avoids double-tick pressure)
        syncFullHistory: false
      })
    });
    console.log('[WhatsApp] Anti-ban settings applied successfully.');
  } catch (err) {
    console.warn('[WhatsApp] Could not apply anti-ban settings:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public service API
// ─────────────────────────────────────────────────────────────────────────────

export const whatsappService = {
  /**
   * Connects the instance and fetches a QR Code for scanning.
   * Also applies anti-ban settings automatically after connection.
   */
  async connect() {
    try {
      const response = await fetch(`${API_URL}/instance/connect/${INSTANCE}`, {
        headers: { 'apikey': API_KEY }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      const data = await response.json();

      // Apply anti-ban settings in the background
      applyAntiBanSettings();

      return data;
    } catch (error: any) {
      console.error('[WhatsApp] Connect Error:', error);
      throw error;
    }
  },

  async getConnectionState() {
    try {
      const response = await fetch(`${API_URL}/instance/connectionState/${INSTANCE}`, {
        headers: { 'apikey': API_KEY }
      });
      if (!response.ok) throw new Error('Failed to get connection state');
      const data = await response.json();
      return data.instance.state; // 'open', 'connecting', 'disconnected', etc.
    } catch (error) {
      console.error('[WhatsApp] Connection State Error:', error);
      return 'disconnected';
    }
  },

  async logout() {
    try {
      const response = await fetch(`${API_URL}/instance/logout/${INSTANCE}`, {
        method: 'DELETE',
        headers: { 'apikey': API_KEY }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      console.error('[WhatsApp] Logout Error:', error);
      throw error;
    }
  },

  /**
   * Queues a message for delivery with anti-ban protection:
   * - Messages are sent one at a time with 3–7 s intervals.
   * - Each message is preceded by a "composing…" typing indicator.
   *
   * Safe to call concurrently for bursts of orders.
   */
  sendMessage(phone: string, text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      messageQueue.push({ phone, text, resolve, reject });
      processQueue(); // No-op if already running
    });
  },

  // Note: findChats and findMessages are preserved in case they're needed elsewhere,
  // even though AdminChat is being removed.
  async findChats() {
    try {
      const response = await fetch(`${API_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({
          where: { key: { remoteJid: { contains: '@s.whatsapp.net' } } }
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      console.error('[WhatsApp] Find Chats Error:', error);
      throw error;
    }
  },

  async findMessages(remoteJid: string) {
    try {
      const number = remoteJid.split('@')[0];
      const response = await fetch(`${API_URL}/chat/findMessages/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'accept': '*/*'
        },
        body: JSON.stringify({ number, count: 50 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      console.error('[WhatsApp] Find Messages Error:', error);
      throw error;
    }
  }
};
