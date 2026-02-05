import { storage } from "../../storage";
import crypto from "crypto";
import type { InstagramIntegration, InsertInstagramMessage } from "@shared/schema";

const META_GRAPH_API_URL = "https://graph.facebook.com/v18.0";

interface MetaOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface InstagramAccountInfo {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

interface InstagramWebhookEvent {
  entry?: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload: { url: string };
        }>;
      };
    }>;
  }>;
}

class InstagramService {
  private getAuthHeaders(accessToken: string): HeadersInit {
    return {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async initiateOAuth(tenantId: string, appId: string, redirectUri: string, appSecret: string): Promise<string> {
    const webhookVerifyToken = this.generateVerifyToken();
    const nonce = crypto.randomBytes(16).toString("hex");
    
    const existing = await storage.getInstagramIntegration(tenantId);
    if (existing) {
      await storage.updateInstagramIntegration(existing.id, {
        status: "connecting",
        webhookVerifyToken,
        oauthNonce: nonce,
      });
    } else {
      await storage.createInstagramIntegration({
        tenantId,
        status: "connecting",
        webhookVerifyToken,
        oauthNonce: nonce,
      });
    }
    
    const scopes = [
      "instagram_basic",
      "instagram_manage_messages",
      "pages_show_list",
      "pages_manage_metadata",
      "pages_read_engagement",
    ].join(",");
    
    const statePayload = { tenantId, nonce, ts: Date.now() };
    const stateData = Buffer.from(JSON.stringify(statePayload)).toString("base64");
    const stateSignature = crypto.createHmac("sha256", appSecret).update(stateData).digest("hex");
    const state = `${stateData}.${stateSignature}`;
    
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;
  }

  async handleOAuthCallback(
    code: string,
    state: string,
    appId: string,
    appSecret: string,
    redirectUri: string
  ): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      const [stateData, stateSignature] = state.split(".");
      
      const expectedSignature = crypto.createHmac("sha256", appSecret).update(stateData).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSignature))) {
        return { success: false, error: "Invalid state signature" };
      }
      
      const payload = JSON.parse(Buffer.from(stateData, "base64").toString());
      const { tenantId, nonce, ts } = payload;
      
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - ts > fiveMinutes) {
        return { success: false, error: "OAuth state expired" };
      }
      
      const integration = await storage.getInstagramIntegration(tenantId);
      if (!integration || integration.oauthNonce !== nonce) {
        return { success: false, error: "Nonce mismatch" };
      }
      
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
      );
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Instagram OAuth token exchange failed:", errorData);
        return { success: false, error: errorData?.error?.message || "Token exchange failed" };
      }
      
      const tokenData: MetaOAuthResponse = await tokenResponse.json();
      
      const longLivedTokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
      );
      
      let accessToken = tokenData.access_token;
      let expiresAt: Date | undefined;
      
      if (longLivedTokenResponse.ok) {
        const longLivedData: MetaOAuthResponse = await longLivedTokenResponse.json();
        accessToken = longLivedData.access_token;
        if (longLivedData.expires_in) {
          expiresAt = new Date(Date.now() + longLivedData.expires_in * 1000);
        }
      }
      
      const instagramAccount = await this.fetchInstagramAccount(accessToken);
      
      if (!instagramAccount) {
        return { success: false, error: "Could not find Instagram Business Account connected to your Facebook Page" };
      }
      
      await storage.updateInstagramIntegration(integration.id, {
        accessToken,
        tokenExpiresAt: expiresAt,
        instagramAccountId: instagramAccount.id,
        instagramUsername: instagramAccount.username,
        status: "connected",
        oauthNonce: null,
      });
      
      return { success: true, tenantId };
    } catch (error: any) {
      console.error("Instagram OAuth callback error:", error);
      return { success: false, error: error.message || "OAuth callback failed" };
    }
  }

  async fetchInstagramAccount(accessToken: string): Promise<InstagramAccountInfo | null> {
    try {
      const pagesResponse = await fetch(
        `${META_GRAPH_API_URL}/me/accounts?access_token=${accessToken}`
      );
      
      if (!pagesResponse.ok) return null;
      
      const pagesData = await pagesResponse.json();
      
      if (!pagesData.data || pagesData.data.length === 0) return null;
      
      for (const page of pagesData.data) {
        const igResponse = await fetch(
          `${META_GRAPH_API_URL}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        );
        
        if (igResponse.ok) {
          const igData = await igResponse.json();
          
          if (igData.instagram_business_account?.id) {
            const accountResponse = await fetch(
              `${META_GRAPH_API_URL}/${igData.instagram_business_account.id}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
            );
            
            if (accountResponse.ok) {
              return await accountResponse.json();
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching Instagram account:", error);
      return null;
    }
  }

  async sendMessage(
    integration: InstagramIntegration,
    recipientId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!integration.accessToken || !integration.instagramAccountId) {
        return { success: false, error: "Integration not properly configured" };
      }
      
      const response = await fetch(
        `${META_GRAPH_API_URL}/${integration.instagramAccountId}/messages`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Instagram send message error:", errorData);
        return { success: false, error: errorData?.error?.message || "Failed to send message" };
      }
      
      const data = await response.json();
      return { success: true, messageId: data.message_id };
    } catch (error: any) {
      console.error("Instagram sendMessage error:", error);
      return { success: false, error: error.message };
    }
  }

  async processWebhookEvent(
    event: InstagramWebhookEvent,
    appSecret: string,
    signature: string | undefined,
    rawBody: string
  ): Promise<void> {
    if (signature) {
      const expectedSig = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const receivedSig = signature.replace("sha256=", "");
      
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(receivedSig))) {
        console.error("Invalid Instagram webhook signature");
        return;
      }
    }
    
    if (!event.entry) return;
    
    for (const entry of event.entry) {
      const instagramAccountId = entry.id;
      
      const integrationQuery = await this.findIntegrationByAccountId(instagramAccountId);
      if (!integrationQuery) continue;
      
      if (entry.messaging) {
        for (const messaging of entry.messaging) {
          if (messaging.message) {
            const messageData: InsertInstagramMessage = {
              tenantId: integrationQuery.tenantId,
              integrationId: integrationQuery.id,
              messageId: messaging.message.mid,
              senderId: messaging.sender.id,
              direction: "inbound",
              messageType: messaging.message.attachments ? "media" : "text",
              messageText: messaging.message.text,
              mediaUrl: messaging.message.attachments?.[0]?.payload?.url,
            };
            
            await storage.createInstagramMessage(messageData);
          }
        }
      }
    }
  }

  async findIntegrationByAccountId(accountId: string): Promise<InstagramIntegration | null> {
    return null;
  }

  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined, verifyToken: string): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      return challenge || null;
    }
    return null;
  }

  generateVerifyToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async disconnect(tenantId: string): Promise<void> {
    await storage.deleteInstagramIntegration(tenantId);
  }

  async getIntegrationStatus(tenantId: string): Promise<InstagramIntegration | undefined> {
    return storage.getInstagramIntegration(tenantId);
  }

  async refreshTokenIfNeeded(integration: InstagramIntegration, appId: string, appSecret: string): Promise<void> {
    if (!integration.tokenExpiresAt) return;
    
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (integration.tokenExpiresAt.getTime() - Date.now() > sevenDays) return;
    
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${integration.accessToken}`
      );
      
      if (response.ok) {
        const data: MetaOAuthResponse = await response.json();
        await storage.updateInstagramIntegration(integration.id, {
          accessToken: data.access_token,
          tokenExpiresAt: data.expires_in 
            ? new Date(Date.now() + data.expires_in * 1000) 
            : undefined,
        });
      }
    } catch (error) {
      console.error("Error refreshing Instagram token:", error);
    }
  }
}

export const instagramService = new InstagramService();
