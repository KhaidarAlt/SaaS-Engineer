import type { Express, Request, Response } from "express";

export function registerAiRopConnectRoutes(
  app: Express,
  storage: any,
  requireAuth: any,
  requireAiAccess: any
) {

  app.get("/api/ai-rop/connect/channels", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;

      const [channels, waCloudIntegration, wahaInstances, instagramIntegration, telegramIntegration] = await Promise.all([
        storage.getAiRopChannels(tenantId),
        storage.getWaCloudIntegration(tenantId).catch(() => null),
        storage.getWahaInstances(tenantId).catch(() => []),
        storage.getInstagramIntegration(tenantId).catch(() => null),
        storage.getTelegramIntegration(tenantId).catch(() => null),
      ]);

      const channelMap = new Map(channels.map((c: any) => [c.channelType, c]));

      let wahaLiveStatus: string | null = null;
      if (wahaInstances.length > 0) {
        try {
          const { wahaService } = await import("./services/waha");
          const active = wahaInstances.find((i: any) => i.isActive);
          if (active) {
            const sess = await wahaService.getSession(active.instanceName);
            wahaLiveStatus = sess.status;
            const dbStatus = sess.status === "WORKING" ? "running"
              : sess.status === "SCAN_QR_CODE" ? "scan_qr"
              : sess.status === "STOPPED" ? "stopped"
              : sess.status === "FAILED" ? "failed" : active.status;
            if (dbStatus !== active.status) {
              await storage.updateWahaInstance(active.id, tenantId, { status: dbStatus });
              active.status = dbStatus;
            }
          }
        } catch {}
      }

      const deriveStatus = (type: string) => {
        const existing = channelMap.get(type);

        let status = "NOT_CONNECTED";
        let isAiEnabled = existing?.isAiEnabled ?? false;
        let displayName: string | null = existing?.displayName ?? null;
        let lastError: string | null = existing?.lastError ?? null;

        if (type === "WHATSAPP_META" && waCloudIntegration) {
          status = waCloudIntegration.status === "connected" ? "CONNECTED"
            : waCloudIntegration.status === "error" ? "ERROR"
            : waCloudIntegration.status === "connecting" ? "CONNECTING"
            : "NOT_CONNECTED";
          isAiEnabled = status === "CONNECTED";
          displayName = "WhatsApp Cloud API";
          lastError = waCloudIntegration.connectionError;
        } else if (type === "WHATSAPP_WAHA") {
          const active = wahaInstances.find((i: any) => i.status === "running" || i.status === "scan_qr");
          if (active) {
            status = active.status === "running" ? "CONNECTED" : "NEEDS_ACTION";
            displayName = active.instanceName;
            isAiEnabled = existing?.isAiEnabled ?? active.isActive;
          }
        } else if (type === "INSTAGRAM" && instagramIntegration) {
          status = instagramIntegration.status === "connected" ? "CONNECTED"
            : instagramIntegration.status === "error" ? "ERROR"
            : "NOT_CONNECTED";
          isAiEnabled = instagramIntegration.aiEnabled ?? false;
          displayName = instagramIntegration.instagramUsername;
          lastError = instagramIntegration.connectionError;
        } else if (type === "TELEGRAM" && telegramIntegration) {
          status = telegramIntegration.status === "active" ? "CONNECTED"
            : telegramIntegration.status === "error" ? "ERROR"
            : "NOT_CONNECTED";
          isAiEnabled = status === "CONNECTED";
          displayName = telegramIntegration.botUsername ? `@${telegramIntegration.botUsername}` : null;
        } else if (existing) {
          return existing;
        }

        return { ...(existing || {}), channelType: type, status, isAiEnabled, displayName, lastError };
      };

      const types = ["WHATSAPP_META", "WHATSAPP_WAHA", "INSTAGRAM", "TELEGRAM"] as const;
      const result = types.map(deriveStatus);

      const upsertPromises = result
        .filter((ch: any) => ch.status !== "NOT_CONNECTED")
        .map((ch: any) =>
          storage.upsertAiRopChannel({
            tenantId,
            channelType: ch.channelType,
            status: ch.status,
            isAiEnabled: ch.isAiEnabled,
            displayName: ch.displayName,
            lastError: ch.lastError,
          }).catch(() => {})
        );
      if (upsertPromises.length > 0) {
        await Promise.all(upsertPromises);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Ошибка получения каналов" });
    }
  });

  app.get("/api/ai-rop/connect/events", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = parseInt(req.query.limit as string) || 10;
      const events = await storage.getAiRopChannelEvents(tenantId, limit);
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching channel events:", error);
      res.status(500).json({ message: "Ошибка получения событий" });
    }
  });

  app.post("/api/ai-rop/connect/health-check-all", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const results: Record<string, string> = {};

      const [waCloudIntegration, wahaInstances, telegramIntegration] = await Promise.all([
        storage.getWaCloudIntegration(tenantId).catch(() => null),
        storage.getWahaInstances(tenantId).catch(() => []),
        storage.getTelegramIntegration(tenantId).catch(() => null),
      ]);

      if (waCloudIntegration && waCloudIntegration.status === "connected") {
        results.WHATSAPP_META = "ok";
      }

      if (wahaInstances.length > 0) {
        try {
          const { wahaService } = await import("./services/waha");
          const active = wahaInstances.find((i: any) => i.isActive);
          if (active) {
            const session = await wahaService.getSession(active.instanceName);
            results.WHATSAPP_WAHA = session.status === "WORKING" ? "ok" : session.status;
          }
        } catch {
          results.WHATSAPP_WAHA = "error";
        }
      }

      if (telegramIntegration && telegramIntegration.status === "active") {
        try {
          const { verifyTelegramBot } = await import("./services/telegram");
          const check = await verifyTelegramBot(telegramIntegration.botToken);
          results.TELEGRAM = check.success ? "ok" : "error";
        } catch {
          results.TELEGRAM = "error";
        }
      }

      await storage.createAiRopChannelEvent({
        tenantId,
        channelType: "ALL",
        eventType: "HEALTH_CHECK",
        message: `Проверка: ${Object.entries(results).map(([k, v]) => `${k}=${v}`).join(", ") || "нет активных каналов"}`,
      });

      res.json({ results, checkedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("Error health-checking channels:", error);
      res.status(500).json({ message: "Ошибка проверки каналов" });
    }
  });

  app.get("/api/ai-rop/connect/waha/disclaimer-status", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const acceptance = await storage.getWahaDisclaimerAcceptance(tenantId);
      res.json({
        accepted: acceptance?.accepted ?? false,
        acceptedAt: acceptance?.acceptedAt ?? null,
        version: acceptance?.version ?? null,
      });
    } catch (error: any) {
      console.error("Error fetching disclaimer status:", error);
      res.status(500).json({ message: "Ошибка проверки статуса" });
    }
  });

  app.post("/api/ai-rop/connect/waha/accept-disclaimer", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { version } = req.body;
      const acceptance = await storage.acceptWahaDisclaimer(tenantId, version || "v1");

      await storage.createAiRopChannelEvent({
        tenantId,
        channelType: "WHATSAPP_WAHA",
        eventType: "DISCLAIMER_ACCEPTED",
        message: "Пользователь принял условия использования WAHA",
      });

      res.json(acceptance);
    } catch (error: any) {
      console.error("Error accepting disclaimer:", error);
      res.status(500).json({ message: "Ошибка сохранения согласия" });
    }
  });

  app.post("/api/ai-rop/connect/telegram/validate", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      if (!botToken) {
        return res.status(400).json({ message: "Токен обязателен" });
      }

      const { verifyTelegramBot } = await import("./services/telegram");
      const result = await verifyTelegramBot(botToken);
      res.json(result);
    } catch (error: any) {
      console.error("Error validating telegram bot:", error);
      res.status(500).json({ message: "Ошибка валидации токена" });
    }
  });

  app.post("/api/ai-rop/connect/telegram/connect", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { botToken } = req.body;

      if (!botToken) {
        return res.status(400).json({ message: "Токен обязателен" });
      }

      const { TelegramService } = await import("./services/telegram/telegram.service");
      const telegramService = new TelegramService();

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : "";

      const result = await telegramService.connectBot(tenantId, botToken, baseUrl);

      if (result.success) {
        await storage.upsertAiRopChannel({
          tenantId,
          channelType: "TELEGRAM",
          status: "CONNECTED",
          isAiEnabled: true,
          displayName: result.botUsername ? `@${result.botUsername}` : "Telegram Bot",
        });

        await storage.createAiRopChannelEvent({
          tenantId,
          channelType: "TELEGRAM",
          eventType: "CONNECTED",
          message: `Подключён бот ${result.botUsername || ""}`,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error connecting telegram:", error);
      res.status(500).json({ message: "Ошибка подключения Telegram" });
    }
  });

  app.post("/api/ai-rop/connect/telegram/disconnect", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;

      const { TelegramService } = await import("./services/telegram/telegram.service");
      const telegramService = new TelegramService();
      await telegramService.disconnectBot(tenantId);

      await storage.updateAiRopChannel(tenantId, "TELEGRAM", {
        status: "NOT_CONNECTED",
        isAiEnabled: false,
      });

      await storage.createAiRopChannelEvent({
        tenantId,
        channelType: "TELEGRAM",
        eventType: "DISCONNECTED",
        message: "Telegram бот отключён",
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error disconnecting telegram:", error);
      res.status(500).json({ message: "Ошибка отключения Telegram" });
    }
  });

  app.post("/api/ai-rop/connect/telegram/test", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const integration = await storage.getTelegramIntegration(tenantId);
      if (!integration) {
        return res.status(404).json({ message: "Telegram не подключён" });
      }

      const { verifyTelegramBot } = await import("./services/telegram");
      const check = await verifyTelegramBot(integration.botToken);

      await storage.createAiRopChannelEvent({
        tenantId,
        channelType: "TELEGRAM",
        eventType: "TEST_SENT",
        message: check.success ? "Тест пройден" : `Ошибка: ${check.error}`,
      });

      res.json({ success: check.success, botName: check.botName, error: check.error });
    } catch (error: any) {
      console.error("Error testing telegram:", error);
      res.status(500).json({ message: "Ошибка тестирования Telegram" });
    }
  });

  app.post("/api/ai-rop/connect/channel/ai-toggle", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { channelType, enabled } = req.body;

      if (!channelType) {
        return res.status(400).json({ message: "channelType обязателен" });
      }

      await storage.upsertAiRopChannel({
        tenantId,
        channelType,
        isAiEnabled: !!enabled,
        status: "CONNECTED",
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error toggling AI:", error);
      res.status(500).json({ message: "Ошибка переключения AI" });
    }
  });
}
