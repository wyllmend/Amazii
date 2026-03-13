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
async function processQueue(instanceName: string) {
  if (queueRunning) return;
  queueRunning = true;

  while (messageQueue.length > 0) {
    const item = messageQueue.shift()!;
    try {
      const result = await dispatchMessage(instanceName, item.phone, item.text);
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
async function dispatchMessage(instanceName: string, phone: string, text: string) {
  const cleanPhone = normalisePhone(phone);

  // 1. Start composing indicator
  try {
    await fetch(`${API_URL}/chat/presence/${instanceName}`, {
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
  const response = await fetch(`${API_URL}/message/sendText/${instanceName}`, {
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
async function applyAntiBanSettings(instanceName: string) {
  try {
    await fetch(`${API_URL}/instance/settings/${instanceName}`, {
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
    console.log(`[WhatsApp] Anti-ban settings applied successfully for ${instanceName}.`);
  } catch (err) {
    console.warn(`[WhatsApp] Could not apply anti-ban settings for ${instanceName}:`, err);
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
  async connect(instanceName: string) {
    try {
      let response = await fetch(`${API_URL}/instance/connect/${instanceName}`, {
        headers: { 'apikey': API_KEY }
      });

      // Se a instância não existe (404), vamos criá-la
      if (response.status === 404) {
        console.log(`[WhatsApp] Instance ${instanceName} not found. Attempting to create...`);
        const createRes = await fetch(`${API_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });

        if (!createRes.ok) {
          const createErr = await createRes.json().catch(() => ({}));
          throw new Error(createErr.message || `Erro ao criar instância vazia: ${createRes.status}`);
        }

        const createData = await createRes.json();
        
        // Aplica configurações anti-ban logo após criar
        applyAntiBanSettings(instanceName);

        // A Evo API v1 e v2 retornam diferentes shapes. Verificamos se veio o qrcode (base64) na resposta
        if (createData.qrcode && createData.qrcode.base64) {
          return { base64: createData.qrcode.base64 };
        } else if (createData?.instance?.state === 'open') {
          return { base64: null, state: 'open' };
        } else {
          // Se não veio na criação, puxamos a conexão novamente
          response = await fetch(`${API_URL}/instance/connect/${instanceName}`, {
            headers: { 'apikey': API_KEY }
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      
      const data = await response.json();

      // Apply anti-ban settings in the background
      applyAntiBanSettings(instanceName);

      return data;
    } catch (error: any) {
      console.error(`[WhatsApp] Connect Error (${instanceName}):`, error);
      throw error;
    }
  },

  async getConnectionState(instanceName: string) {
    try {
      const response = await fetch(`${API_URL}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': API_KEY }
      });
      if (!response.ok) throw new Error('Failed to get connection state');
      const data = await response.json();
      
      const state = data?.instance?.state || data?.state || 'disconnected';
      console.log(`[WhatsApp] Connection state for ${instanceName}:`, state);
      return state;
    } catch (error) {
      console.error(`[WhatsApp] Connection State Error (${instanceName}):`, error);
      return 'disconnected';
    }
  },

  async logout(instanceName: string) {
    try {
      const response = await fetch(`${API_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': API_KEY }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      console.error(`[WhatsApp] Logout Error (${instanceName}):`, error);
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
  sendMessage(instanceName: string, phone: string, text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      messageQueue.push({ phone, text, resolve, reject });
      processQueue(instanceName); // No-op if already running
    });
  },

  async findChats(instanceName: string) {
    try {
      const response = await fetch(`${API_URL}/chat/findChats/${instanceName}`, {
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
      console.error(`[WhatsApp] Find Chats Error (${instanceName}):`, error);
      throw error;
    }
  },

  async findMessages(instanceName: string, remoteJid: string) {
    try {
      const response = await fetch(`${API_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'accept': '*/*'
        },
        // Evolution API v2: filter by remoteJid so we get messages for THIS contact only
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: 50
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      console.error(`[WhatsApp] Find Messages Error (${instanceName}):`, error);
      throw error;
    }
  }
};
