import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { scrapeTelegramChannel } from "./services/telegramScraper";
import { extractProductsFromPosts, type ExtractedProduct } from "./services/productExtractor";
import { ObjectStorageService } from "./replit_integrations/object_storage";

const sseClients = new Map<string, Response>();

const IMAGE_FETCH_TIMEOUT = 15_000;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;

function sendSSE(sessionId: string, data: object) {
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
  app.get("/api/magic-import/:sessionId/stream", (req, res) => {
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
      const bodySchema = z.object({ telegramChannel: z.string().min(1) });
      const { telegramChannel } = bodySchema.parse(req.body);

      const cleanChannel = telegramChannel.replace(/^@/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/\/$/, '');

      if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(cleanChannel)) {
        return res.status(400).json({ message: "Некорректное имя канала" });
      }

      const session = await storage.createMagicImportSession({
        telegramChannel: cleanChannel,
        channelUrl: `https://t.me/s/${cleanChannel}`,
        channelUsername: cleanChannel,
        status: "scraping",
        progressPct: 0,
        progressMessage: "Начинаем сканирование канала...",
      });

      res.json({ sessionId: session.id });

      runImportPipeline(session.id, cleanChannel).catch((err) => {
        console.error("Magic import pipeline error:", err);
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка запуска импорта";
      res.status(400).json({ message: msg });
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/magic-import/:sessionId/complete", async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        storeName: z.string().min(1),
        phone: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        workingHours: z.string().optional(),
      });
      const { email, password, storeName, phone, city, address, workingHours } = bodySchema.parse(req.body);
      const sessionId = req.params.sessionId;

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
        contactPhone: phone,
        address: address ? `${city ? city + ', ' : ''}${address}` : city,
        workingHours,
        status: "demo",
      });

      const user = await storage.createUser({
        email,
        password,
        name: storeName,
        role: "owner",
        tenantId: tenant.id,
      });

      const freePlan = await storage.getDefaultPlan();
      const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      if (freePlan) {
        await storage.createSubscription({
          tenantId: tenant.id,
          planId: freePlan.id,
          status: "trial",
          startsAt: new Date(),
          endsAt: trialExpiresAt,
        });
      }

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
          req.login(user, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const platformDomain = process.env.PLATFORM_DOMAIN || "botfactory.kz";
      const catalogUrl = `https://${uniqueSlug}.${platformDomain}`;

      res.json({
        success: true,
        tenantId: tenant.id,
        slug: uniqueSlug,
        catalogUrl,
        trialExpiresAt,
      });
    } catch (error: unknown) {
      console.error("Magic import complete error:", error);
      const msg = error instanceof Error ? error.message : "Ошибка создания магазина";
      res.status(500).json({ message: msg });
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
        status: "paid_clicked",
      });

      if (session.tenantId) {
        const tenant = await storage.getTenant(session.tenantId);
        if (tenant) {
          sendTelegramNotification(
            `💰 Magic Import: оплата нажата!\nМагазин: ${tenant.name}\nEmail: ${session.email}\nКанал: @${session.telegramChannel}`
          );
        }
      }

      res.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
    }
  });

  // === Admin routes ===

  app.get("/api/admin/magic-import/stats", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getMagicImportStats();
      res.json(stats);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/magic-import/sessions", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const sessions = await storage.getMagicImportSessions();
      res.json(sessions);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/admin/magic-import/:sessionId/confirm-payment", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
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
      });

      await storage.updateMagicImportSession(session.id, {
        status: "active",
        activatedAt: new Date(),
        fullScrapeTriggeredAt: new Date(),
      });

      const tenant = await storage.getTenant(session.tenantId);
      if (tenant) {
        const platformDomain = process.env.PLATFORM_DOMAIN || "botfactory.kz";
        const catalogUrl = `https://${tenant.slug}.${platformDomain}`;
        sendTelegramNotification(
          `✅ Магазин активирован!\n\nМагазин: ${tenant.name}\nEmail: ${session.email}\nКаталог: ${catalogUrl}\nПлан: ${startPlan.name}\nПериод: 30 дней`
        );

        if (tenant.contactPhone) {
          sendWhatsAppActivation(
            session.tenantId,
            tenant.contactPhone,
            `🎉 Ваш магазин "${tenant.name}" активирован!\n\nВаш каталог: ${catalogUrl}\nПлан: ${startPlan.name}\nПериод: 30 дней\n\nСпасибо за оплату!`
          );
        }
      }

      runFullScrape(session.id, session.telegramChannel, session.tenantId).catch((err) => {
        console.error("Full scrape error:", err);
      });

      res.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/admin/tenants/:tenantId/toggles", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant) return res.status(404).json({ message: "Тенант не найден" });

      const bodySchema = z.object({
        aiRopEnabled: z.boolean().optional(),
        smartCatalogEnabled: z.boolean().optional(),
      });
      const updates = bodySchema.parse(req.body);

      const updated = await storage.updateTenant(tenant.id, updates);
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Ошибка";
      res.status(500).json({ message: msg });
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

    const postsWithImages = scrapeResult.posts.filter(p => p.imageUrls.length > 0);
    scrapeResult.posts = postsWithImages.length > 0 ? postsWithImages.slice(0, 20) : scrapeResult.posts.slice(0, 20);

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

    await storage.updateMagicImportSession(sessionId, {
      extractedProductsData: products,
    });

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("Import pipeline error:", error);
    await storage.updateMagicImportSession(sessionId, {
      status: "error",
      errorMessage: msg,
      progressMessage: `Ошибка: ${msg}`,
    });
    sendSSE(sessionId, { type: "error", message: msg });
  }
}

async function runFullScrape(sessionId: string, telegramChannel: string, tenantId: string) {
  try {
    const scrapeResult = await scrapeTelegramChannel(telegramChannel, { maxPages: 50 });

    const existingProducts = await storage.getProducts(tenantId);
    const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));

    const products = await extractProductsFromPosts(scrapeResult);
    const newProducts = products.filter(p => !existingNames.has(p.name.toLowerCase()));

    if (newProducts.length > 0) {
      const objectStorageService = new ObjectStorageService();
      const categories = await storage.getCategories(tenantId);
      const categoryMap = new Map(categories.map(c => [c.name, c.id]));

      for (const product of newProducts) {
        try {
          let categoryId: string | null = null;
          if (product.category) {
            if (categoryMap.has(product.category)) {
              categoryId = categoryMap.get(product.category)!;
            } else {
              const cat = await storage.createCategory({ tenantId, name: product.category });
              categoryMap.set(product.category, cat.id);
              categoryId = cat.id;
            }
          }

          const created = await storage.createProduct({
            tenantId,
            name: product.name,
            sku: product.sku || `MI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            description: product.description || "",
            price: String(product.price || 0),
            categoryId,
            isActive: true,
          });

          if (product.imageUrl && isAllowedImageUrl(product.imageUrl)) {
            await downloadAndUploadImage(product.imageUrl, created.id, tenantId, objectStorageService);
          }
        } catch (err) {
          console.error(`Full scrape: failed to create product ${product.name}:`, err);
        }
      }
    }

    console.log(`Full scrape completed for session=${sessionId}: ${newProducts.length} new products added`);
  } catch (err) {
    console.error(`Full scrape failed for session=${sessionId}:`, err);
  }
}

async function createProductsForTenant(sessionId: string, tenantId: string) {
  const session = await storage.getMagicImportSession(sessionId);
  const products = session?.extractedProductsData;
  if (!products || products.length === 0) return;

  const objectStorageService = new ObjectStorageService();
  const categoryMap = new Map<string, string>();

  for (const product of products) {
    try {
      let categoryId: string | null = null;
      if (product.category) {
        if (categoryMap.has(product.category)) {
          categoryId = categoryMap.get(product.category)!;
        } else {
          const cat = await storage.createCategory({ tenantId, name: product.category });
          categoryMap.set(product.category, cat.id);
          categoryId = cat.id;
        }
      }

      const created = await storage.createProduct({
        tenantId,
        name: product.name,
        sku: product.sku || `MI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
        description: product.description || "",
        price: String(product.price || 0),
        categoryId,
        isActive: true,
      });

      if (product.imageUrl && isAllowedImageUrl(product.imageUrl)) {
        await downloadAndUploadImage(product.imageUrl, created.id, tenantId, objectStorageService);
      }
    } catch (err) {
      console.error(`Failed to create product ${product.name}:`, err);
    }
  }
}

async function downloadAndUploadImage(
  imageUrl: string,
  productId: string,
  tenantId: string,
  objectStorageService: ObjectStorageService,
) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
    const imgResp = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!imgResp.ok) return;

    const contentLength = parseInt(imgResp.headers.get("content-length") || "0");
    if (contentLength > IMAGE_MAX_SIZE) return;

    const buffer = Buffer.from(await imgResp.arrayBuffer());
    if (buffer.length > IMAGE_MAX_SIZE) return;

    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return;

    const uploadedUrl = await objectStorageService.uploadBuffer(buffer, contentType);

    await storage.createProductImage({
      productId,
      tenantId,
      url: uploadedUrl,
      isMain: true,
      sortOrder: 0,
    });
  } catch (imgErr) {
    console.error(`Failed to download image for product ${productId}:`, imgErr);
  }
}

async function deleteObjectStorageFile(url: string): Promise<void> {
  try {
    const objectStorageService = new ObjectStorageService();
    if (url.startsWith("/objects/")) {
      await objectStorageService.deleteObject(url.replace("/objects/", ""));
    }
  } catch (err) {
    console.error(`Failed to delete object storage file ${url}:`, err);
  }
}

async function sendWhatsAppActivation(tenantId: string, phone: string, text: string) {
  try {
    const { wahaService } = await import("./services/waha");
    const wahaInstances = await storage.getWahaInstances(tenantId);
    const activeInstance = wahaInstances.find(i => i.status === "active");

    if (activeInstance) {
      const chatId = phone.replace(/\D/g, "") + "@c.us";
      await wahaService.sendTextMessage(activeInstance.instanceName, chatId, text);
      console.log(`[MagicImport] WhatsApp activation sent to ${phone}`);
    } else {
      console.log(`[MagicImport] No active WAHA instance for tenant ${tenantId}, skipping WhatsApp`);
    }
  } catch (err) {
    console.error("[MagicImport] Failed to send WhatsApp activation:", err);
  }
}

function sendTelegramNotification(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !chatId) return;

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch((err) => {
    console.error("Failed to send Telegram notification:", err);
  });
}

export function startMagicImportTrialWorker() {
  const HOUR = 60 * 60 * 1000;

  async function checkTrials() {
    try {
      const expired = await storage.getExpiredTrialSessions();
      for (const session of expired) {
        if (session.tenantId) {
          await storage.updateTenant(session.tenantId, { status: "suspended" });
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
              await deleteObjectStorageFile(image.url);
            }
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
