const API_URL = import.meta.env.VITE_WHATSAPP_API_URL;
const API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;
const INSTANCE = import.meta.env.VITE_WHATSAPP_INSTANCE;

export const whatsappService = {
  async connect() {
    try {
      const response = await fetch(`${API_URL}/instance/connect/${INSTANCE}`, {
        headers: {
          'apikey': API_KEY
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('WhatsApp Connect Error:', error);
      throw error;
    }
  },

  async getConnectionState() {
    try {
      const response = await fetch(`${API_URL}/instance/connectionState/${INSTANCE}`, {
        headers: {
          'apikey': API_KEY
        }
      });
      if (!response.ok) throw new Error('Failed to get connection state');
      const data = await response.json();
      return data.instance.state; // 'open', 'connecting', 'disconnected', etc.
    } catch (error) {
      console.error('WhatsApp Connection State Error:', error);
      return 'disconnected';
    }
  },

  async logout() {
    try {
      const response = await fetch(`${API_URL}/instance/logout/${INSTANCE}`, {
        method: 'DELETE',
        headers: {
          'apikey': API_KEY
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('WhatsApp Logout Error:', error);
      throw error;
    }
  },

  async sendMessage(phone: string, text: string) {
    try {
      // Clean phone number: only digits
      let cleanPhone = phone.replace(/\D/g, '');
      
      // Evolution API often requires country code (55 for Brazil)
      if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }
      
      const response = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: text,
          delay: 1200, // Good practice for Evolution API
          linkPreview: false
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('WhatsApp Send Message Error:', error);
      throw error;
    }
  },

  async findChats() {
    try {
      const response = await fetch(`${API_URL}/chat/findChats/${INSTANCE}`, {
        headers: {
          'apikey': API_KEY
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('WhatsApp Find Chats Error:', error);
      throw error;
    }
  },

  async findMessages(remoteJid: string) {
    try {
      const response = await fetch(`${API_URL}/chat/findMessages/${INSTANCE}?where=%7B%22key%22%3A%7B%22remoteJid%22%3A%22${encodeURIComponent(remoteJid)}%22%7D%7D`, {
        headers: {
          'apikey': API_KEY
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('WhatsApp Find Messages Error:', error);
      throw error;
    }
  }
};
