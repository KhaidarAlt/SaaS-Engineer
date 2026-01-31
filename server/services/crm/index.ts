import { bitrixService } from "./bitrix.service";
import { amoCrmService } from "./amocrm.service";
import { storage } from "../../storage";
import type { CrmIntegration, Order, OrderItem, CrmSyncLog } from "@shared/schema";

export interface CrmDealData {
  title: string;
  clientName: string;
  phone: string;
  email?: string;
  products: string;
  amount: number;
  comment?: string;
}

export async function createCrmDeal(order: Order, orderItems: OrderItem[], products: any[]): Promise<void> {
  const integrations = await storage.getActiveCrmIntegrations(order.tenantId);
  
  if (integrations.length === 0) return;

  const productLines = orderItems.map(item => {
    const product = products.find(p => p.id === item.productId);
    return `${product?.name || item.productName} x${item.quantity} = ${item.total}₸`;
  }).join("\n");

  const dealData: CrmDealData = {
    title: `Заказ #${order.orderNumber} от SmartCatalog`,
    clientName: order.customerName,
    phone: order.customerPhone,
    email: order.customerEmail || undefined,
    products: productLines,
    amount: Number(order.total),
    comment: order.comment || undefined,
  };

  for (const integration of integrations) {
    try {
      let crmEntityId: string;

      if (integration.crmType === "bitrix24") {
        crmEntityId = await bitrixService.createDeal(integration, dealData);
      } else if (integration.crmType === "amocrm") {
        crmEntityId = await amoCrmService.createLead(integration, dealData);
      } else {
        continue;
      }

      await storage.createCrmSyncLog({
        integrationId: integration.id,
        tenantId: order.tenantId,
        orderId: order.id,
        action: "create_deal",
        status: "success",
        crmEntityId,
        requestData: dealData as any,
      });

      await storage.updateCrmIntegration(integration.id, order.tenantId, {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      });
    } catch (error: any) {
      console.error(`CRM sync error (${integration.crmType}):`, error);

      await storage.createCrmSyncLog({
        integrationId: integration.id,
        tenantId: order.tenantId,
        orderId: order.id,
        action: "create_deal",
        status: "error",
        errorMessage: error.message,
        requestData: dealData as any,
      });

      await storage.updateCrmIntegration(integration.id, order.tenantId, {
        lastError: error.message,
        lastErrorAt: new Date(),
        status: error.message.includes("переподключите") ? "error" : "connected",
      });
    }
  }
}

export async function refreshCrmTokenIfNeeded(integration: CrmIntegration): Promise<CrmIntegration | null> {
  if (!integration.tokenExpiresAt || !integration.refreshToken) return null;

  const expiresAt = new Date(integration.tokenExpiresAt);
  const now = new Date();
  const bufferMinutes = 5;
  now.setMinutes(now.getMinutes() + bufferMinutes);

  if (expiresAt > now) return null;

  try {
    if (integration.crmType === "bitrix24") {
      const tokens = await bitrixService.refreshToken(integration.refreshToken);
      const updated = await storage.updateCrmIntegration(integration.id, integration.tenantId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });
      return updated || null;
    } else if (integration.crmType === "amocrm" && integration.crmDomain) {
      const tokens = await amoCrmService.refreshToken(integration.refreshToken, integration.crmDomain);
      const updated = await storage.updateCrmIntegration(integration.id, integration.tenantId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });
      return updated || null;
    }
  } catch (error: any) {
    console.error("Token refresh error:", error);
    await storage.updateCrmIntegration(integration.id, integration.tenantId, {
      status: "error",
      lastError: "Истёк срок доступа, переподключите CRM",
      lastErrorAt: new Date(),
    });
  }

  return null;
}

export async function syncOrderStatusToCrm(order: Order, newStatus: string): Promise<void> {
  const integrations = await storage.getActiveCrmIntegrations(order.tenantId);
  
  if (integrations.length === 0) return;

  for (const integration of integrations) {
    try {
      // Find existing CRM entity for this order
      const syncLogs = await storage.getCrmSyncLogsForOrder(order.id);
      const successLog = syncLogs.find(log => 
        log.integrationId === integration.id && 
        log.status === "success" && 
        log.crmEntityId
      );

      if (!successLog?.crmEntityId) {
        console.log(`No CRM entity found for order ${order.id} in ${integration.crmType}`);
        continue;
      }

      // Get the target stage ID for "paid" status from field mapping or use configured stage
      const fieldMapping = integration.fieldMapping as Record<string, string> || {};
      const paidStageId = fieldMapping.paidStageId || integration.stageId;

      if (!paidStageId) {
        console.log(`No paid stage configured for ${integration.crmType}`);
        continue;
      }

      if (integration.crmType === "bitrix24") {
        await bitrixService.updateDealStage(integration, successLog.crmEntityId, paidStageId);
      } else if (integration.crmType === "amocrm") {
        await amoCrmService.updateLeadStatus(integration, successLog.crmEntityId, paidStageId);
      }

      await storage.createCrmSyncLog({
        integrationId: integration.id,
        tenantId: order.tenantId,
        orderId: order.id,
        action: "update_status",
        status: "success",
        crmEntityId: successLog.crmEntityId,
        requestData: { newStatus, paidStageId },
      });

    } catch (error: any) {
      console.error(`CRM status sync error (${integration.crmType}):`, error);
      await storage.createCrmSyncLog({
        integrationId: integration.id,
        tenantId: order.tenantId,
        orderId: order.id,
        action: "update_status",
        status: "error",
        errorMessage: error.message,
        requestData: { newStatus },
      });
    }
  }
}

export { bitrixService, amoCrmService };
