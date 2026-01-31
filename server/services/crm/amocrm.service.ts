import type { CrmIntegration } from "@shared/schema";

interface AmoCrmTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface AmoCrmPipeline {
  id: number;
  name: string;
  sort: number;
  is_main: boolean;
  _embedded: {
    statuses: AmoCrmStatus[];
  };
}

interface AmoCrmStatus {
  id: number;
  name: string;
  sort: number;
  is_editable: boolean;
  pipeline_id: number;
}

interface AmoCrmUser {
  id: number;
  name: string;
  email: string;
}

export class AmoCrmService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.AMOCRM_CLIENT_ID || "";
    this.clientSecret = process.env.AMOCRM_CLIENT_SECRET || "";
    this.redirectUri = process.env.AMOCRM_REDIRECT_URI || "";
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      mode: "post_message",
      state,
    });
    return `https://www.amocrm.ru/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, domain: string): Promise<AmoCrmTokenResponse> {
    const response = await fetch(`https://${domain}/oauth2/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Не удалось получить токен: ${error}`);
    }

    return response.json();
  }

  async refreshToken(refreshToken: string, domain: string): Promise<AmoCrmTokenResponse> {
    const response = await fetch(`https://${domain}/oauth2/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error("Истёк срок доступа, переподключите CRM");
    }

    return response.json();
  }

  private async callApi(integration: CrmIntegration, endpoint: string, method: string = "GET", body?: any): Promise<any> {
    if (!integration.crmDomain || !integration.accessToken) {
      throw new Error("CRM не подключена");
    }

    const url = `https://${integration.crmDomain}/api/v4/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${integration.accessToken}`,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Истёк срок доступа, переподключите CRM");
      }
      throw new Error("Ошибка подключения к CRM");
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async getPipelines(integration: CrmIntegration): Promise<AmoCrmPipeline[]> {
    const result = await this.callApi(integration, "leads/pipelines");
    return result?._embedded?.pipelines || [];
  }

  async getUsers(integration: CrmIntegration): Promise<AmoCrmUser[]> {
    const result = await this.callApi(integration, "users");
    return result?._embedded?.users || [];
  }

  async createLead(
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
    const contactId = await this.findOrCreateContact(integration, {
      name: data.clientName,
      phone: data.phone,
      email: data.email,
    });

    const leadData: any = {
      name: data.title,
      price: data.amount,
      pipeline_id: integration.pipelineId ? parseInt(integration.pipelineId) : undefined,
      status_id: integration.stageId ? parseInt(integration.stageId) : undefined,
      _embedded: {
        tags: [{ name: "SmartCatalog" }],
      },
      custom_fields_values: [
        {
          field_code: "DESCRIPTION",
          values: [{ value: `${data.products}\n\n${data.comment || ""}` }],
        },
      ],
    };

    if (integration.responsibleUserId) {
      leadData.responsible_user_id = parseInt(integration.responsibleUserId);
    }

    if (contactId) {
      leadData._embedded.contacts = [{ id: parseInt(contactId) }];
    }

    const result = await this.callApi(integration, "leads", "POST", [leadData]);
    return String(result?._embedded?.leads?.[0]?.id || "");
  }

  private async findOrCreateContact(
    integration: CrmIntegration,
    data: { name: string; phone: string; email?: string }
  ): Promise<string | null> {
    try {
      const existing = await this.callApi(integration, `contacts?query=${encodeURIComponent(data.phone)}`);
      if (existing?._embedded?.contacts?.length > 0) {
        return String(existing._embedded.contacts[0].id);
      }

      const contactData: any = {
        name: data.name,
        custom_fields_values: [
          {
            field_code: "PHONE",
            values: [{ value: data.phone, enum_code: "MOB" }],
          },
        ],
      };

      if (data.email) {
        contactData.custom_fields_values.push({
          field_code: "EMAIL",
          values: [{ value: data.email, enum_code: "WORK" }],
        });
      }

      const result = await this.callApi(integration, "contacts", "POST", [contactData]);
      return String(result?._embedded?.contacts?.[0]?.id || "");
    } catch (e) {
      console.error("Error creating amoCRM contact:", e);
      return null;
    }
  }

  async updateLeadStatus(integration: CrmIntegration, leadId: string, statusId: string): Promise<void> {
    await this.callApi(integration, `leads/${leadId}`, "PATCH", {
      status_id: parseInt(statusId),
    });
  }

  async testConnection(integration: CrmIntegration): Promise<boolean> {
    try {
      await this.callApi(integration, "account");
      return true;
    } catch {
      return false;
    }
  }
}

export const amoCrmService = new AmoCrmService();
