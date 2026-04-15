import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { scrapeTelegramChannel } from "./services/telegramScraper";
import { extractProductsFromPosts, type ExtractedProduct } from "./services/productExtractor";
import { ObjectStorageService } from "./replit_integrations/object_storage";

const sseClients = new Map<string, Response>();
const extractedProductsCache = new Map<string, ExtractedProduct[]>();

const IMAGE_FETCH_TIMEOUT = 15_000;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;

function sendSSE(sessionId: string, data: any) {
  const client = sseClients.get(sessionId);
  if (client && !client.writableEnded) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.hostname.match(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/);
  } catch {
    return false;
  }
}

export function registerMagicImportRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
  requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.get("/api/magic-import/stream/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    sseClients.set(sessionId, res);
    req.on("close", () => { sseClients.delete(sessionId); });
  });

  app.post("/api/magic-import/start", async (req: Request, res: Response) => {
    try {
      const schema = z.object({ telegramChannel: z.string().min(1) });
      const { telegramChannel } = schema.parse(req.body);

      const session = await storage.createMagicImportSession({
        telegramChannel,
        status: "scraping",
        progressPct: 0,
        progressMessage: "Начинаем сканирование канала...",
      });

      res.json({ sessionId: session.id });

      runImportPipeline(session.id, telegramChannel).catch((err) => {
        console.error("Magic import pipeline error:", err);
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка запуска импорта" });
    }
  });

  app.get("/api/magic-import/:sessionId/status", async (req: Request, res: Response) => {
    try {
      const session = await storage.getMagicImportSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });
      res.json({
        id: session.id,
        status: session.status,
        progressPct: session.progressPct,
        progressMessage: session.progressMessage,
        extractedProducts: session.extractedProducts,
        scrapedPosts: session.scrapedPosts,
        errorMessage: session.errorMessage,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/magic-import/complete", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        sessionId: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        storeName: z.string().min(1),
      });
      const { sessionId, email, password, storeName } = schema.parse(req.body);

      const session = await storage.getMagicImportSession(sessionId);
      if (!session || session.status !== "done") {
        return res.status(400).json({ message: "Сессия не найдена или не завершена" });
      }

      if (session.tenantId) {
        return res.status(400).json({ message: "Магазин уже создан для этой сессии" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      const slug = slugifyRu(storeName);
      let uniqueSlug = slug;
      let counter = 1;
      while (await storage.getTenantBySlug(uniqueSlug)) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      const tenant = await storage.createTenant({
        name: storeName,
        slug: uniqueSlug,
        importSource: `telegram:${session.telegramChannel}`,
        magicImportSessionId: sessionId,
        aiRopEnabled: false,
        status: "active",
      } as any);

      const user = await storage.createUser({
        email,
        password,
        name: storeName,
        role: "owner",
        tenantId: tenant.id,
      });

      const freePlan = await storage.getDefaultPlan();
      if (freePlan) {
        const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await storage.createSubscription({
          tenantId: tenant.id,
          planId: freePlan.id,
          status: "trial",
          startsAt: new Date(),
          endsAt: trialEnd,
        });
      }

      const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await storage.updateMagicImportSession(sessionId, {
        tenantId: tenant.id,
        userId: user.id,
        email,
        storeName,
        trialExpiresAt,
      });

      await createProductsForTenant(sessionId, tenant.id);

      if (req.login) {
        await new Promise<void>((resolve, reject) => {
          req.login(user, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      res.json({
        success: true,
        tenantId: tenant.id,
        slug: uniqueSlug,
        trialExpiresAt,
      });
    } catch (error: any) {
      console.error("Magic import complete error:", error);
      res.status(500).json({ message: error.message || "Ошибка создания магазина" });
    }
  });

  app.post("/api/magic-import/:sessionId/paid-clicked", requireAuth, async (req: Request, res: Response) => {
    try {
      const session = await storage.getMagicImportSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });
      if (session.userId !== req.user?.id && req.user?.role !== "superadmin") {
        return res.status(403).json({ message: "Доступ запрещён" });
      }

      await storage.updateMagicImportSession(session.id, {
        paidClickedAt: new Date(),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Admin routes ===

  app.get("/api/admin/magic-import/stats", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const sessions = await storage.getMagicImportSessions();
      const total = sessions.length;
      const scraping = sessions.filter(s => s.status === "scraping").length;
      const done = sessions.filter(s => s.status === "done").length;
      const paidClicked = sessions.filter(s => s.paidClickedAt).length;
      const active = sessions.filter(s => s.status === "active").length;
      const expired = sessions.filter(s => s.status === "expired").length;
      const deleted = sessions.filter(s => s.status === "deleted").length;
      const errors = sessions.filter(s => s.status === "error").length;
      const totalProducts = sessions.reduce((sum, s) => sum + (s.extractedProducts || 0), 0);

      res.json({
        total,
        scraping,
        done,
        paidClicked,
        active,
        expired,
        deleted,
        errors,
        totalProducts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/magic-import/sessions", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const sessions = await storage.getMagicImportSessions();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/magic-import/:sessionId/activate", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const session = await storage.getMagicImportSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });
      if (!session.tenantId) return res.status(400).json({ message: "Тенант не создан" });

      const plans = await storage.getPlans();
      const startPlan = plans.find(p => p.name === "Start") || plans.find(p => p.price > 0);
      if (!startPlan) return res.status(400).json({ message: "План Start не найден" });

      const subscription = await storage.getSubscription(session.tenantId);
      if (subscription) {
        await storage.updateSubscription(subscription.id, {
          planId: startPlan.id,
          status: "active",
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      await storage.updateTenant(session.tenantId, {
        aiRopEnabled: true,
        status: "active",
      } as any);

      await storage.updateMagicImportSession(session.id, {
        status: "active",
        activatedAt: new Date(),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/tenants/:tenantId/toggle-ai-rop", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant) return res.status(404).json({ message: "Тенант не найден" });

      const updated = await storage.updateTenant(tenant.id, {
        aiRopEnabled: !tenant.aiRopEnabled,
      } as any);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

function slugifyRu(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (char: string) => {
      const map: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      };
      return map[char] || char;
    })
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

async function runImportPipeline(sessionId: string, telegramChannel: string) {
  try {
    sendSSE(sessionId, { type: "progress", pct: 5, message: "Загрузка постов из канала..." });
    await storage.updateMagicImportSession(sessionId, {
      progressPct: 5,
      progressMessage: "Загрузка постов из канала...",
    });

    const scrapeResult = await scrapeTelegramChannel(telegramChannel);

    if (scrapeResult.posts.length === 0) {
      throw new Error("Канал не содержит постов с товарами");
    }

    sendSSE(sessionId, {
      type: "progress",
      pct: 10,
      message: `Найдено ${scrapeResult.posts.length} постов. Извлекаем товары...`,
    });
    await storage.updateMagicImportSession(sessionId, {
      scrapedPosts: scrapeResult.posts.length,
      progressPct: 10,
      progressMessage: `Найдено ${scrapeResult.posts.length} постов`,
    });

    const products = await extractProductsFromPosts(scrapeResult, (progress) => {
      sendSSE(sessionId, {
        type: "progress",
        pct: progress.pct,
        message: progress.message,
        productsCount: progress.products.length,
      });
    });

    if (products.length === 0) {
      throw new Error("Не удалось извлечь товары из постов канала");
    }

    extractedProductsCache.set(sessionId, products);

    await storage.updateMagicImportSession(sessionId, {
      extractedProducts: products.length,
      progressPct: 100,
      progressMessage: `Готово! Извлечено ${products.length} товаров`,
      status: "done",
    });

    sendSSE(sessionId, {
      type: "complete",
      pct: 100,
      message: `Готово! Извлечено ${products.length} товаров`,
      productsCount: products.length,
      products: products.map((p) => ({
        name: p.name,
        price: p.price,
        category: p.category,
        imageUrl: p.imageUrl,
      })),
      channelTitle: scrapeResult.channelTitle,
    });
  } catch (error: any) {
    console.error("Import pipeline error:", error);
    await storage.updateMagicImportSession(sessionId, {
      status: "error",
      errorMessage: error.message,
      progressMessage: `Ошибка: ${error.message}`,
    });
    sendSSE(sessionId, { type: "error", message: error.message });
  }
}

async function createProductsForTenant(sessionId: string, tenantId: string) {
  const products = extractedProductsCache.get(sessionId);
  if (!products || products.length === 0) return;

  const objectStorage = new ObjectStorageService();
  const categoryMap = new Map<string, string>();

  for (const product of products) {
    try {
      let categoryId: string | null = null;
      if (product.category) {
        if (categoryMap.has(product.category)) {
          categoryId = categoryMap.get(product.category)!;
        } else {
          const cat = await storage.createCategory({
            tenantId,
            name: product.category,
          });
          categoryMap.set(product.category, cat.id);
          categoryId = cat.id;
        }
      }

      const sku = `MI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const created = await storage.createProduct({
        tenantId,
        name: product.name,
        sku,
        description: product.description || "",
        price: String(product.price || 0),
        categoryId,
        isActive: true,
      });

      if (product.imageUrl && isAllowedImageUrl(product.imageUrl)) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
          const imgResp = await fetch(product.imageUrl, { signal: controller.signal });
          clearTimeout(timeout);

          if (imgResp.ok) {
            const contentLength = parseInt(imgResp.headers.get("content-length") || "0");
            if (contentLength > IMAGE_MAX_SIZE) continue;

            const buffer = Buffer.from(await imgResp.arrayBuffer());
            if (buffer.length > IMAGE_MAX_SIZE) continue;

            const contentType = imgResp.headers.get("content-type") || "image/jpeg";
            if (!contentType.startsWith("image/")) continue;

            const uploadedUrl = await objectStorage.uploadBuffer(buffer, contentType);

            await storage.createProductImage({
              productId: created.id,
              tenantId,
              url: uploadedUrl,
              isMain: true,
              sortOrder: 0,
            });
          }
        } catch (imgErr) {
          console.error(`Failed to download image for product ${product.name}:`, imgErr);
        }
      }
    } catch (err) {
      console.error(`Failed to create product ${product.name}:`, err);
    }
  }

  extractedProductsCache.delete(sessionId);
}

export function startMagicImportTrialWorker() {
  const HOUR = 60 * 60 * 1000;

  async function checkTrials() {
    try {
      const expired = await storage.getExpiredTrialSessions();
      for (const session of expired) {
        if (session.tenantId) {
          await storage.updateTenant(session.tenantId, { status: "suspended" } as any);
        }
        await storage.updateMagicImportSession(session.id, { status: "expired" });
        console.log(`Magic import trial expired: session=${session.id}, tenant=${session.tenantId}`);
      }

      const toDelete = await storage.getMediaDeletionSessions();
      for (const session of toDelete) {
        if (session.tenantId) {
          const products = await storage.getProducts(session.tenantId);
          for (const product of products) {
            const images = await storage.getProductImages(product.id, session.tenantId);
            for (const image of images) {
              await storage.deleteProductImage(image.id, session.tenantId);
            }
            await storage.deleteProduct(product.id, session.tenantId);
          }
        }
        await storage.updateMagicImportSession(session.id, {
          status: "deleted",
          mediaDeletedAt: new Date(),
        });
        console.log(`Magic import media deleted: session=${session.id}`);
      }
    } catch (err) {
      console.error("Magic import trial worker error:", err);
    }
  }

  setInterval(checkTrials, HOUR);
  setTimeout(checkTrials, 30_000);
  console.log("Magic import trial worker started");
}
