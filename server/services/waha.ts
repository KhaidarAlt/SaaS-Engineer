const WAHA_BASE_URL = process.env.WAHA_BASE_URL || "https://waha.botfactory.kz";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

interface WahaSession {
  name: string;
  status: string;
  me?: {
    id: string;
    pushName: string;
  };
}

interface WahaQRResponse {
  mimetype?: string;
  data?: string;
  value?: string; // WAHA returns raw QR code value
}

interface WahaSessionConfig {
  name: string;
  config?: {
    webhooks?: {
      url: string;
      events: string[];
    }[];
  };
  start?: boolean;
}

async function wahaRequest(method: string, endpoint: string, body?: any): Promise<any> {
  const url = `${WAHA_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (WAHA_API_KEY) {
    headers["X-Api-Key"] = WAHA_API_KEY;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export const wahaService = {
  async listSessions(): Promise<WahaSession[]> {
    return wahaRequest("GET", "/api/sessions");
  },

  async getSession(sessionName: string): Promise<WahaSession> {
    return wahaRequest("GET", `/api/sessions/${sessionName}`);
  },

  async createSession(sessionName: string, webhookUrl?: string): Promise<WahaSession> {
    const body: WahaSessionConfig = {
      name: sessionName,
      start: true,
    };

    if (webhookUrl) {
      body.config = {
        webhooks: [
          {
            url: webhookUrl,
            events: ["message", "message.any", "message.ack", "session.status", "message.waiting"],
          },
        ],
      };
    }

    return wahaRequest("POST", "/api/sessions", body);
  },

  async startSession(sessionName: string): Promise<WahaSession> {
    return wahaRequest("POST", `/api/sessions/${sessionName}/start`);
  },

  async stopSession(sessionName: string): Promise<void> {
    return wahaRequest("POST", `/api/sessions/${sessionName}/stop`);
  },

  async deleteSession(sessionName: string): Promise<void> {
    return wahaRequest("DELETE", `/api/sessions/${sessionName}`);
  },

  async getQRCode(sessionName: string): Promise<string> {
    try {
      // WAHA API format: /api/{session}/auth/qr
      const response: WahaQRResponse = await wahaRequest("GET", `/api/${sessionName}/auth/qr?format=raw`);
      console.log(`[WAHA] QR response for ${sessionName}:`, JSON.stringify(response).substring(0, 200));
      // Response has 'value' field with raw QR code string
      if (response && response.value) {
        return response.value;
      }
      // Fallback for base64 encoded format
      if (response && response.data) {
        return `data:${response.mimetype};base64,${response.data}`;
      }
      return "";
    } catch (error: any) {
      console.error(`[WAHA] QR error for ${sessionName}:`, error?.message || error);
      return "";
    }
  },

  async getScreenshot(sessionName: string): Promise<string> {
    try {
      const response = await wahaRequest("GET", `/api/screenshot?session=${sessionName}`);
      return response;
    } catch (error) {
      return "";
    }
  },

  async sendTextMessage(sessionName: string, chatId: string, text: string): Promise<any> {
    return wahaRequest("POST", `/api/sendText`, {
      session: sessionName,
      chatId,
      text,
    });
  },

  async sendImageMessage(sessionName: string, chatId: string, imageUrl: string, caption?: string): Promise<any> {
    return wahaRequest("POST", `/api/sendImage`, {
      session: sessionName,
      chatId,
      file: {
        url: imageUrl,
      },
      caption,
    });
  },

  async getChats(sessionName: string): Promise<any[]> {
    try {
      return await wahaRequest("GET", `/api/${sessionName}/chats`);
    } catch (error: any) {
      console.error(`[WAHA] getChats error for ${sessionName}:`, error?.message || error);
      return [];
    }
  },

  async getContacts(sessionName: string): Promise<any[]> {
    try {
      return await wahaRequest("GET", `/api/contacts?session=${sessionName}`);
    } catch (error: any) {
      console.error(`[WAHA] getContacts error for ${sessionName}:`, error?.message || error);
      return [];
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      await wahaRequest("GET", "/api/sessions");
      return true;
    } catch {
      return false;
    }
  },

  async updateSessionWebhook(sessionName: string, webhookUrl: string): Promise<any> {
    return wahaRequest("PUT", `/api/sessions/${sessionName}`, {
      name: sessionName,
      config: {
        webhooks: [
          {
            url: webhookUrl,
            events: ["message", "message.any", "message.ack", "session.status", "message.waiting"],
          },
        ],
      },
    });
  },

  async getMessages(sessionName: string, chatId: string, limit: number = 10): Promise<any[]> {
    try {
      return await wahaRequest("GET", `/api/messages?session=${sessionName}&chatId=${chatId}&limit=${limit}&downloadMedia=false`);
    } catch (error: any) {
      return [];
    }
  },

  async getChatMessages(sessionName: string, chatId: string, limit: number = 5): Promise<any[]> {
    try {
      const msgs = await this.getMessages(sessionName, chatId, limit);
      return Array.isArray(msgs) ? msgs : [];
    } catch {
      return [];
    }
  },

  async getAllContacts(sessionName: string): Promise<Array<{ id: string; number: string | null; isUser: boolean; isMe: boolean; isGroup: boolean; name?: string; pushname?: string }>> {
    try {
      const contacts = await wahaRequest("GET", `/api/contacts/all?session=${sessionName}&limit=1000`);
      return Array.isArray(contacts) ? contacts : [];
    } catch {
      return [];
    }
  },

  async getChatsOverview(sessionName: string, limit: number = 50): Promise<Array<{ id: string; timestamp?: number; name?: string }>> {
    try {
      const chats = await wahaRequest("GET", `/api/${sessionName}/chats?limit=${limit}&sortBy=messageTimestamp&sortOrder=desc`);
      return Array.isArray(chats) ? chats : [];
    } catch {
      try {
        const chats = await wahaRequest("GET", `/api/chats?session=${sessionName}&limit=${limit}`);
        return Array.isArray(chats) ? chats : [];
      } catch {
        return [];
      }
    }
  },

  generateInstanceName(tenantId: string): string {
    const shortId = tenantId.substring(0, 8);
    const timestamp = Date.now().toString(36);
    return `sc_${shortId}_${timestamp}`;
  },
};
