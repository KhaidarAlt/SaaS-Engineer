import type { CrmIntegration } from "@shared/schema";

const BITRIX_OAUTH_URL = "https://oauth.bitrix.info/oauth/authorize/";
const BITRIX_TOKEN_URL = "https://oauth.bitrix.info/oauth/token/";

interface BitrixTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  domain: string;
  member_id: string;
  user_id: string;
}

interface BitrixPipeline {
  ID: string;
  NAME: string;
  SORT: string;
  IS_DEFAULT: string;
}

interface BitrixStage {
  ID: string;
  NAME: string;
  STATUS_ID: string;
  SORT: string;
}

interface BitrixUser {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

export class BitrixService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.BITRIX24_CLIENT_ID || "";
    this.clientSecret = process.env.BITRIX24_CLIENT_SECRET || "";
    this.redirectUri = process.env.BITRIX24_REDIRECT_URI || "";
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      state,
    });
    return `${BITRIX_OAUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<BitrixTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch(BITRIX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Не удалось получить токен: ${error}`);
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<BitrixTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(BITRIX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error("Истёк срок доступа, переподключите CRM");
    }

    return response.json();
  }

  private async callApi(integration: CrmIntegration, method: string, params: Record<string, any> = {}): Promise<any> {
    if (!integration.crmDomain || !integration.accessToken) {
      throw new Error("CRM не подключена");
    }

    const url = `https://${integration.crmDomain}/rest/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${integration.accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Истёк срок доступа, переподключите CRM");
      }
      throw new Error("Ошибка подключения к CRM");
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || "Ошибка CRM");
    }

    return data.result;
  }

  async getPipelines(integration: CrmIntegration): Promise<BitrixPipeline[]> {
    const result = await this.callApi(integration, "crm.category.list", {
      entityTypeId: 2, // Deals
    });
    return result.categories || [];
  }

  async getStages(integration: CrmIntegration, pipelineId: string): Promise<BitrixStage[]> {
    const result = await this.callApi(integration, "crm.status.list", {
      filter: { ENTITY_ID: "DEAL_STAGE" },
    });
    return result || [];
  }

  async getUsers(integration: CrmIntegration): Promise<BitrixUser[]> {
    const result = await this.callApi(integration, "user.get", {
      FILTER: { ACTIVE: true },
    });
    return result || [];
  }

  async createDeal(
    integration: CrmIntegration,
    data: {
      title: string;
      clientName: string;
      phone: string;
      email?: string;
      products: string;
      amount: number;
      comment?: string;
    }
  ): Promise<string> {
    const fields: Record<string, any> = {
      TITLE: data.title,
      STAGE_ID: integration.stageId || "NEW",
      OPPORTUNITY: data.amount,
      CURRENCY_ID: "KZT",
      COMMENTS: `${data.products}\n\n${data.comment || ""}`,
      SOURCE_ID: "WEB",
      SOURCE_DESCRIPTION: "SmartCatalog",
    };

    if (integration.responsibleUserId) {
      fields.ASSIGNED_BY_ID = integration.responsibleUserId;
    }

    const contactId = await this.findOrCreateContact(integration, {
      name: data.clientName,
      phone: data.phone,
      email: data.email,
    });

    if (contactId) {
      fields.CONTACT_ID = contactId;
    }

    const result = await this.callApi(integration, "crm.deal.add", { fields });
    return String(result);
  }

  private async findOrCreateContact(
    integration: CrmIntegration,
    data: { name: string; phone: string; email?: string }
  ): Promise<string | null> {
    try {
      const existing = await this.callApi(integration, "crm.contact.list", {
        filter: { PHONE: data.phone },
        select: ["ID"],
      });

      if (existing && existing.length > 0) {
        return existing[0].ID;
      }

      const nameParts = data.name.split(" ");
      const result = await this.callApi(integration, "crm.contact.add", {
        fields: {
          NAME: nameParts[0] || data.name,
          LAST_NAME: nameParts.slice(1).join(" ") || "",
          PHONE: [{ VALUE: data.phone, VALUE_TYPE: "MOBILE" }],
          EMAIL: data.email ? [{ VALUE: data.email, VALUE_TYPE: "WORK" }] : undefined,
          SOURCE_ID: "WEB",
        },
      });

      return String(result);
    } catch (e) {
      console.error("Error creating Bitrix contact:", e);
      return null;
    }
  }

  async updateDealStage(integration: CrmIntegration, dealId: string, stageId: string): Promise<void> {
    await this.callApi(integration, "crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: stageId },
    });
  }

  async testConnection(integration: CrmIntegration): Promise<boolean> {
    try {
      await this.callApi(integration, "profile");
      return true;
    } catch {
      return false;
    }
  }
}

export const bitrixService = new BitrixService();
