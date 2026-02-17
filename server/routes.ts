import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import express from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { loginSchema, registerSchema, checkoutSchema } from "@shared/schema";
import type { User, Tenant, Subscription, Plan } from "@shared/schema";
import { ObjectStorageService, registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { sendPasswordResetEmail } from "./services/gmail";
import { randomBytes, timingSafeEqual } from "crypto";
import net from "node:net";
import { pool } from "./db";
import domainRoutes from "./domains/routes.js";
import { startDomainWorker } from "./domains/worker.js";
import { registerAiRopRoutes } from "./ai-rop-routes.js";
import { registerAiTestingRoutes } from "./ai-testing-routes.js";
import { registerAiTrainingRoutes } from "./ai-training-routes.js";
import { registerAiAnalyticsRoutes } from "./ai-analytics-routes.js";
import { registerAiRopConnectRoutes } from "./ai-rop-connect-routes.js";

const SessionStore = MemoryStore(session);

interface AuthUser extends User {
  tenant?: Tenant & { subscription?: Subscription & { plan?: Plan } };
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => {
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

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}${month}${day}-${random}`;
}

interface ComputedPriceResult {
  computedPrice: string;
  originalPrice: string;
  discountPercent: number | null;
  discountType: string | null;
  hasDiscount: boolean;
  promotionName?: string;
  discountName?: string;
}

function computeProductPrice(
  product: { id: string; price: string; categoryId: string | null },
  discounts: Array<{ id: string; name: string; type: string; value: string; scope: string; scopeId: string | null; isActive: boolean; priority: number; startsAt: Date | null; endsAt: Date | null }>,
  promotions: Array<{ id: string; name: string; discountType: string | null; discountValue: string | null; productIds: string[] | null; categoryIds: string[] | null; isActive: boolean; priority: number; startsAt: Date | null; endsAt: Date | null }>
): ComputedPriceResult {
  const now = new Date();
  let computedPrice = parseFloat(product.price);
  let discountPercent: number | null = null;
  let discountType: string | null = null;
  let promotionName: string | undefined;
  let discountName: string | undefined;

  const activePromotions = promotions.filter(p => {
    if (!p.isActive) return false;
    if (p.startsAt && new Date(p.startsAt) > now) return false;
    if (p.endsAt && new Date(p.endsAt) < now) return false;
    const productMatches = p.productIds && p.productIds.includes(product.id);
    const categoryMatches = p.categoryIds && product.categoryId && p.categoryIds.includes(product.categoryId);
    return productMatches || categoryMatches;
  }).sort((a, b) => b.priority - a.priority);

  if (activePromotions.length > 0) {
    const promo = activePromotions[0];
    promotionName = promo.name;
    if (promo.discountType === "percent" && promo.discountValue) {
      discountPercent = parseFloat(promo.discountValue);
      computedPrice = computedPrice * (1 - discountPercent / 100);
      discountType = "promotion";
    } else if (promo.discountType === "amount" && promo.discountValue) {
      computedPrice = Math.max(0, computedPrice - parseFloat(promo.discountValue));
      discountType = "promotion";
    }
  } else {
    const productDiscounts = discounts.filter(d => {
      if (!d.isActive) return false;
      if (d.startsAt && new Date(d.startsAt) > now) return false;
      if (d.endsAt && new Date(d.endsAt) < now) return false;
      return d.scope === "product" && d.scopeId === product.id;
    }).sort((a, b) => b.priority - a.priority);

    if (productDiscounts.length > 0) {
      const disc = productDiscounts[0];
      discountName = disc.name;
      if (disc.type === "percent") {
        discountPercent = parseFloat(disc.value);
        computedPrice = computedPrice * (1 - discountPercent / 100);
        discountType = "product";
      } else if (disc.type === "amount") {
        computedPrice = Math.max(0, computedPrice - parseFloat(disc.value));
        discountType = "product";
      }
    } else if (product.categoryId) {
      const categoryDiscounts = discounts.filter(d => {
        if (!d.isActive) return false;
        if (d.startsAt && new Date(d.startsAt) > now) return false;
        if (d.endsAt && new Date(d.endsAt) < now) return false;
        return d.scope === "category" && d.scopeId === product.categoryId;
      }).sort((a, b) => b.priority - a.priority);

      if (categoryDiscounts.length > 0) {
        const disc = categoryDiscounts[0];
        discountName = disc.name;
        if (disc.type === "percent") {
          discountPercent = parseFloat(disc.value);
          computedPrice = computedPrice * (1 - discountPercent / 100);
          discountType = "category";
        } else if (disc.type === "amount") {
          computedPrice = Math.max(0, computedPrice - parseFloat(disc.value));
          discountType = "category";
        }
      }
    }
  }

  return {
    computedPrice: computedPrice.toFixed(2),
    originalPrice: product.price,
    discountPercent,
    discountType,
    hasDiscount: discountType !== null,
    promotionName,
    discountName,
  };
}

async function migratePlansToNewStructure() {
  const existingPlans = await storage.getAllPlans();
  
  for (const plan of existingPlans) {
    // Migrate "Каталог + AI" to "Business"
    if (plan.name === "Каталог + AI") {
      await storage.updatePlan(plan.id, {
        name: "Business",
        price: 19990,
        maxProducts: 2000,
        maxCategories: 100,
        maxPromotions: 50,
        maxDiscountRules: 100,
        maxManagers: 3,
        maxWahaInstances: 1,
        aiMessagesLimit: 300,
        hasAiAccess: true,
        features: ["Всё из Каталог", "AI-ассистент 24/7", "300 диалогов/мес", "Скрипты продаж + база знаний", "Передача менеджеру по триггерам"],
      });
      console.log("Migrated plan: Каталог + AI → Business");
    }
    
    // Migrate "Про" to "PRO"
    if (plan.name === "Про") {
      await storage.updatePlan(plan.id, {
        name: "PRO",
        price: 34990,
        maxProducts: 5000,
        maxCategories: 200,
        maxPromotions: 100,
        maxDiscountRules: 200,
        maxManagers: 10,
        maxWahaInstances: 3,
        aiMessagesLimit: 900,
        hasAiAccess: true,
        features: ["Всё из Business", "900 диалогов/мес", "Приоритетная обработка диалогов", "Максимальная автоматизация продаж"],
      });
      console.log("Migrated plan: Про → PRO");
    }
    
    // Deactivate old "Бизнес" plan (99900₸)
    if (plan.name === "Бизнес" && plan.price === 99900) {
      await storage.updatePlan(plan.id, { isActive: false });
      console.log("Deactivated old plan: Бизнес (99900₸)");
    }
    
    // Update "Каталог" to correct structure
    if (plan.name === "Каталог" && !plan.hasAiAccess) {
      await storage.updatePlan(plan.id, {
        price: 9990,
        maxProducts: 1000,
        maxCategories: 50,
        maxPromotions: 20,
        maxDiscountRules: 50,
        maxManagers: 2,
        maxWahaInstances: 0,
        aiMessagesLimit: 0,
        hasAiAccess: false,
        features: ["Полноценный каталог", "Категории и вариации", "Скидки и акции", "Встроенная CRM", "Полная аналитика"],
      });
      console.log("Updated plan: Каталог");
    }
    
    // Update "Старт" to correct structure
    if (plan.name === "Старт" || plan.price === 0) {
      await storage.updatePlan(plan.id, {
        name: "Старт",
        price: 0,
        maxProducts: 20,
        maxCategories: 5,
        maxPromotions: 2,
        maxDiscountRules: 3,
        maxManagers: 0,
        maxWahaInstances: 0,
        aiMessagesLimit: 0,
        hasAiAccess: false,
        features: ["Каталог до 20 товаров", "Приём заявок в WhatsApp", "Публичная ссылка"],
      });
      console.log("Updated plan: Старт");
    }
  }
}

async function ensureDefaultPlans() {
  // First migrate any old plans to new structure
  await migratePlansToNewStructure();
  
  const existingPlans = await storage.getPlans();
  
  // Check each required plan and create if missing
  const hasStart = existingPlans.some(p => p.name === "Старт");
  const hasCatalog = existingPlans.some(p => p.name === "Каталог");
  const hasBusiness = existingPlans.some(p => p.name === "Business");
  const hasPro = existingPlans.some(p => p.name === "PRO");
  
  if (!hasStart) {
    await storage.createPlan({
      name: "Старт",
      price: 0,
      currency: "KZT",
      periodDays: 365,
      maxProducts: 20,
      maxCategories: 5,
      maxPromotions: 2,
      maxDiscountRules: 3,
      maxManagers: 0,
      maxWahaInstances: 0,
      aiMessagesLimit: 0,
      hasAiAccess: false,
      features: ["Каталог до 20 товаров", "Приём заявок в WhatsApp", "Публичная ссылка"],
      isActive: true,
    });
    console.log("Created plan: Старт");
  }
  
  if (!hasCatalog) {
    await storage.createPlan({
      name: "Каталог",
      price: 9990,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 1000,
      maxCategories: 50,
      maxPromotions: 20,
      maxDiscountRules: 50,
      maxManagers: 2,
      maxWahaInstances: 0,
      aiMessagesLimit: 0,
      hasAiAccess: false,
      features: ["Полноценный каталог", "Категории и вариации", "Скидки и акции", "Встроенная CRM", "Полная аналитика"],
      isActive: true,
    });
    console.log("Created plan: Каталог");
  }
  
  if (!hasBusiness) {
    await storage.createPlan({
      name: "Business",
      price: 19990,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 2000,
      maxCategories: 100,
      maxPromotions: 50,
      maxDiscountRules: 100,
      maxManagers: 3,
      maxWahaInstances: 1,
      aiMessagesLimit: 300,
      hasAiAccess: true,
      features: ["Всё из Каталог", "AI-ассистент 24/7", "300 диалогов/мес", "Скрипты продаж + база знаний", "Передача менеджеру по триггерам"],
      isActive: true,
    });
    console.log("Created plan: Business");
  }
  
  if (!hasPro) {
    await storage.createPlan({
      name: "PRO",
      price: 34990,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 5000,
      maxCategories: 200,
      maxPromotions: 100,
      maxDiscountRules: 200,
      maxManagers: 10,
      maxWahaInstances: 3,
      aiMessagesLimit: 900,
      hasAiAccess: true,
      features: ["Всё из Business", "900 диалогов/мес", "Приоритетная обработка диалогов", "Максимальная автоматизация продаж"],
      isActive: true,
    });
    console.log("Created plan: PRO");
  }
}

// Migrate legacy local uploads to object storage
async function migrateLegacyUploads() {
  const objectStorageService = new ObjectStorageService();
  
  // Get all product images with /uploads/ prefix
  const allImages = await storage.getAllProductImages();
  const legacyImages = allImages.filter(img => img.url.startsWith('/uploads/'));
  
  if (legacyImages.length === 0) {
    return;
  }
  
  console.log(`Found ${legacyImages.length} legacy images to migrate`);
  
  for (const image of legacyImages) {
    const filename = image.url.replace('/uploads/', '');
    const localPath = path.join(process.cwd(), 'uploads', filename);
    
    try {
      // Check if local file exists
      if (!fs.existsSync(localPath)) {
        console.log(`Local file not found, skipping: ${localPath}`);
        continue;
      }
      
      // Determine content type from extension
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 
                          ext === '.gif' ? 'image/gif' : 
                          ext === '.webp' ? 'image/webp' : 'image/jpeg';
      
      // Upload to object storage
      const newUrl = await objectStorageService.uploadLocalFile(localPath, contentType);
      
      // Update database record
      await storage.updateProductImageUrl(image.id, newUrl);
      
      console.log(`Migrated image: ${image.url} → ${newUrl}`);
    } catch (error) {
      console.error(`Failed to migrate image ${image.id}:`, error);
    }
  }
  
  console.log('Legacy image migration completed');
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  next();
};

const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  next();
};

const requireAiAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ message: "Доступ запрещён" });
  }
  
  const subscription = await storage.getSubscription(tenantId);
  if (!subscription?.plan?.hasAiAccess) {
    return res.status(403).json({ 
      message: "AI-ассистент недоступен на вашем тарифе",
      code: "AI_ACCESS_DENIED",
      upgradeRequired: true
    });
  }
  next();
};

type LimitType = 'products' | 'categories' | 'promotions' | 'discounts';

async function checkPlanLimit(tenantId: string, limitType: LimitType): Promise<{ allowed: boolean; message?: string }> {
  const subscription = await storage.getSubscription(tenantId);
  if (!subscription || !subscription.plan) {
    return { allowed: false, message: "Подписка не найдена" };
  }

  const plan = subscription.plan;
  const limits: Record<LimitType, { max: number; getCurrent: () => Promise<number>; name: string }> = {
    products: {
      max: plan.maxProducts,
      getCurrent: async () => (await storage.getProducts(tenantId)).length,
      name: "товаров",
    },
    categories: {
      max: plan.maxCategories,
      getCurrent: async () => (await storage.getCategories(tenantId)).length,
      name: "категорий",
    },
    promotions: {
      max: plan.maxPromotions,
      getCurrent: async () => (await storage.getPromotions(tenantId)).length,
      name: "акций",
    },
    discounts: {
      max: plan.maxDiscountRules,
      getCurrent: async () => (await storage.getDiscounts(tenantId)).length,
      name: "скидок",
    },
  };

  const limit = limits[limitType];
  const current = await limit.getCurrent();
  
  if (current >= limit.max) {
    return {
      allowed: false,
      message: `Достигнут лимит ${limit.name} (${current}/${limit.max}). Обновите тарифный план для увеличения лимитов.`,
    };
  }

  return { allowed: true };
}

// Demo product images
const DEMO_IMAGES: Record<string, string> = {
  "DEMO-001": "https://tgrad.kz/upload/iblock/cc4/cc4124979151f57411aec9f094eb2a9b.png", // Беспроводные наушники
  "DEMO-002": "https://ir.ozone.ru/s3/multimedia-h/c1000/6439990289.jpg", // Смарт-часы
  "DEMO-003": "https://hopestar.com.ua/image/cache/catalog/category/2848-800x800.png", // Портативная колонка
};

async function ensureDemoTenant() {
  const existingDemo = await storage.getTenantBySlug("demo");
  
  // OG image for demo catalog preview in messengers
  const DEMO_OG_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&h=630&fit=crop";
  const DEMO_LOGO = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop";
  
  if (existingDemo) {
    console.log("Demo tenant already exists, checking for missing images...");
    
    // Update tenant OG image if missing
    if (!existingDemo.ogImageUrl || !existingDemo.logoUrl) {
      await storage.updateTenant(existingDemo.id, {
        ogImageUrl: existingDemo.ogImageUrl || DEMO_OG_IMAGE,
        logoUrl: existingDemo.logoUrl || DEMO_LOGO,
      });
      console.log("Updated demo tenant with OG image and logo");
    }
    
    // Update existing demo products with images if they don't have any
    const products = await storage.getProducts(existingDemo.id);
    for (const product of products) {
      if (!product.mainImageUrl && product.sku && DEMO_IMAGES[product.sku]) {
        await storage.updateProduct(product.id, existingDemo.id, {
          mainImageUrl: DEMO_IMAGES[product.sku],
        });
        console.log(`Updated demo product ${product.sku} with image`);
      }
    }
    return;
  }
  
  // Get the free plan
  const plans = await storage.getPlans();
  const startPlan = plans.find(p => p.name === "Старт");
  if (!startPlan) {
    console.log("Cannot create demo tenant: no Старт plan found");
    return;
  }
  
  // Create demo tenant
  const demoTenant = await storage.createTenant({
    name: "Демо магазин",
    slug: "demo",
    status: "active",
    contactEmail: "demo@smartcatalog.kz",
    contactPhone: "+77765348417",
    address: "Алматы, демо-адрес",
    description: "Это демонстрационный каталог для ознакомления с возможностями SmartCatalog",
  });
  
  console.log("Created demo tenant:", demoTenant.id);
  
  // Create demo category
  const category = await storage.createCategory({
    tenantId: demoTenant.id,
    name: "Электроника",
    slug: "electronics",
    isActive: true,
  });
  
  // Create demo products with images
  const demoProducts = [
    {
      name: "Беспроводные наушники",
      description: "Качественные беспроводные наушники с шумоподавлением. Время работы до 24 часов.",
      price: "15990",
      sku: "DEMO-001",
      stockQty: 50,
      categoryId: category.id,
      mainImageUrl: DEMO_IMAGES["DEMO-001"],
    },
    {
      name: "Смарт-часы",
      description: "Умные часы с пульсометром, GPS и водозащитой IP68.",
      price: "29990",
      sku: "DEMO-002",
      stockQty: 30,
      mainImageUrl: DEMO_IMAGES["DEMO-002"],
    },
    {
      name: "Портативная колонка",
      description: "Мощная портативная колонка с отличным звуком и защитой от воды.",
      price: "12500",
      sku: "DEMO-003",
      stockQty: 100,
      categoryId: category.id,
      mainImageUrl: DEMO_IMAGES["DEMO-003"],
    },
  ];
  
  for (const product of demoProducts) {
    await storage.createProduct({
      ...product,
      tenantId: demoTenant.id,
      isActive: true,
    });
  }
  
  console.log("Created demo products");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await ensureDefaultPlans();
  await ensureDemoTenant();
  
  // Migrate legacy local uploads to object storage
  await migrateLegacyUploads();

  app.set("trust proxy", 1);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "smartcatalog-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  
  registerObjectStorageRoutes(app);
  app.use(domainRoutes);
  startDomainWorker();

  app.get("/__ping", (_req: Request, res: Response) => {
    res.type("text/plain").status(200).send("pong");
  });

  // ── Anti-fraud: Caddy on_demand TLS allow endpoint ──────────────────

  const BLOCKED_ZONES = [
    ".local", ".localhost", ".internal", ".test", ".example",
    ".invalid", ".onion", ".i2p", ".arpa",
  ];

  const PLATFORM_DOMAIN = "botfactory.kz";
  const SLUG_RE = /^([a-z0-9][a-z0-9-]{1,62}[a-z0-9])\.botfactory\.kz$/;
  const PLATFORM_WHITELIST = new Set(["botfactory.kz", "www.botfactory.kz", "waha.botfactory.kz"]);

  const ipRateMap = new Map<string, { count: number; resetAt: number }>();
  const domainRateMap = new Map<string, { count: number; resetAt: number }>();
  const negativeCache = new Map<string, number>();
  const tenantIssuanceMap = new Map<string, { domains: Set<string>; resetAt: number }>();
  const approvedDomainsCache = new Set<string>();

  const IP_RATE_LIMIT = 60;
  const IP_RATE_WINDOW = 10 * 60_000;
  const DOMAIN_RATE_LIMIT = 10;
  const DOMAIN_RATE_WINDOW = 10 * 60_000;
  const NEGATIVE_CACHE_TTL = 10 * 60_000;
  const TENANT_DAILY_CERT_LIMIT = 5;
  const TENANT_ISSUANCE_WINDOW = 24 * 60 * 60_000;

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of ipRateMap) if (v.resetAt <= now) ipRateMap.delete(k);
    for (const [k, v] of domainRateMap) if (v.resetAt <= now) domainRateMap.delete(k);
    for (const [k, ts] of negativeCache) if (ts <= now) negativeCache.delete(k);
    for (const [k, v] of tenantIssuanceMap) if (v.resetAt <= now) tenantIssuanceMap.delete(k);
  }, 60_000);

  function safeTokenCompare(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  function checkRate(map: Map<string, { count: number; resetAt: number }>, key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = map.get(key);
    if (!entry || entry.resetAt <= now) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  }

  function getClientIp(req: Request): string {
    const xff = req.get("X-Forwarded-For");
    if (xff) return xff.split(",")[0].trim();
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  app.get("/api/internal/caddy/allow", async (req: Request, res: Response) => {
    const t0 = Date.now();
    try {
      const headerToken = req.get("X-Ask-Token") || "";
      const queryToken = String(req.query.token || "");
      const token = headerToken || queryToken;
      const tokenSource = headerToken ? "header" : queryToken ? "query" : "none";
      const clientIp = getClientIp(req);

      const expectedToken = process.env.CADDY_ASK_TOKEN || "";
      if (!expectedToken || !safeTokenCompare(token, expectedToken)) {
        console.log(`[caddy-ask] deny ip=${clientIp} tokenSource=${tokenSource} reason=bad_token latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("forbidden");
      }

      const rawDomain = String(req.query.domain || req.query.host || req.query.server_name || "").toLowerCase().trim();
      if (!rawDomain) {
        console.log(`[caddy-ask] deny ip=${clientIp} reason=no_domain latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(400).send("bad request");
      }

      const domain = rawDomain.replace(/\.+$/, "").replace(/:\d+$/, "");

      if (!domain || domain.length > 253 || net.isIP(domain)) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=invalid latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      if (/[^\x20-\x7E]/.test(domain)) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=non_ascii latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      if (domain === "localhost" || BLOCKED_ZONES.some(z => domain === z.slice(1) || domain.endsWith(z))) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=blocked_zone latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      if (domain.includes("*")) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=wildcard latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      // Rate limit by IP
      if (!checkRate(ipRateMap, clientIp, IP_RATE_LIMIT, IP_RATE_WINDOW)) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=ip_rate_limit latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(429).send("too many requests");
      }

      // Rate limit by domain
      if (!checkRate(domainRateMap, domain, DOMAIN_RATE_LIMIT, DOMAIN_RATE_WINDOW)) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=domain_rate_limit latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(429).send("too many requests");
      }

      // Negative cache check
      const cachedDenyUntil = negativeCache.get(domain);
      if (cachedDenyUntil && cachedDenyUntil > Date.now()) {
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=negative_cache latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      // Platform whitelist (exact match only)
      if (PLATFORM_WHITELIST.has(domain)) {
        console.log(`[caddy-ask] allow domain=${domain} ip=${clientIp} reason=platform_whitelist latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(200).send("ok");
      }

      // Subdomain slug check: slug.botfactory.kz
      const slugMatch = domain.match(SLUG_RE);
      if (slugMatch) {
        const slug = slugMatch[1];
        if (slug.startsWith("-") || slug.endsWith("-")) {
          negativeCache.set(domain, Date.now() + NEGATIVE_CACHE_TTL);
          console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=bad_slug latency=${Date.now() - t0}ms`);
          return res.type("text/plain").status(403).send("not allowed");
        }
        const r = await pool.query(
          "SELECT id FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1",
          [slug]
        );
        if (r.rowCount && r.rowCount > 0) {
          const tenantId = r.rows[0].id;
          // Tenant cert issuance limit (only for first-seen domains)
          if (!approvedDomainsCache.has(domain)) {
            const now = Date.now();
            let entry = tenantIssuanceMap.get(tenantId);
            if (!entry || entry.resetAt <= now) {
              entry = { domains: new Set(), resetAt: now + TENANT_ISSUANCE_WINDOW };
              tenantIssuanceMap.set(tenantId, entry);
            }
            if (!entry.domains.has(domain) && entry.domains.size >= TENANT_DAILY_CERT_LIMIT) {
              console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} slug=${slug} tenant=${tenantId} reason=tenant_cert_limit latency=${Date.now() - t0}ms`);
              return res.type("text/plain").status(403).send("tenant limit reached");
            }
            entry.domains.add(domain);
            approvedDomainsCache.add(domain);
          }
          console.log(`[caddy-ask] allow domain=${domain} ip=${clientIp} slug=${slug} reason=tenant_slug latency=${Date.now() - t0}ms`);
          return res.type("text/plain").status(200).send("ok");
        }
        negativeCache.set(domain, Date.now() + NEGATIVE_CACHE_TTL);
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} slug=${slug} reason=slug_not_found latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      // Any other *.botfactory.kz subdomain not matching slug pattern → deny
      if (domain.endsWith("." + PLATFORM_DOMAIN)) {
        negativeCache.set(domain, Date.now() + NEGATIVE_CACHE_TTL);
        console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=invalid_subdomain latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(403).send("not allowed");
      }

      // Custom domains: env whitelist
      const allowedCustom = process.env.ALLOWED_CUSTOM_DOMAINS;
      if (allowedCustom) {
        const list = allowedCustom.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
        if (list.includes(domain)) {
          console.log(`[caddy-ask] allow domain=${domain} ip=${clientIp} reason=env_whitelist latency=${Date.now() - t0}ms`);
          return res.type("text/plain").status(200).send("ok");
        }
      }

      // Custom domains: tenants table
      const r = await pool.query("SELECT 1 FROM tenants WHERE custom_domain = $1 AND status = 'active' LIMIT 1", [domain]);
      if (r.rowCount && r.rowCount > 0) {
        console.log(`[caddy-ask] allow domain=${domain} ip=${clientIp} reason=custom_domain latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(200).send("ok");
      }

      // Custom domains: domains table
      const dr = await pool.query("SELECT 1 FROM domains WHERE domain = $1 AND status = 'active' LIMIT 1", [domain]);
      if (dr.rowCount && dr.rowCount > 0) {
        console.log(`[caddy-ask] allow domain=${domain} ip=${clientIp} reason=domains_table latency=${Date.now() - t0}ms`);
        return res.type("text/plain").status(200).send("ok");
      }

      // Not found → cache and deny
      negativeCache.set(domain, Date.now() + NEGATIVE_CACHE_TTL);
      console.log(`[caddy-ask] deny domain=${domain} ip=${clientIp} reason=not_found latency=${Date.now() - t0}ms`);
      return res.type("text/plain").status(403).send("not allowed");
    } catch (e) {
      console.error("[caddy-ask] error:", e);
      return res.type("text/plain").status(500).send("error");
    }
  });

  // Serve legacy local uploads (for backward compatibility)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/.well-known/catalog-verify/:tenantId", async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (tenant && tenant.customDomain) {
        const host = getEffectiveHost(req).replace(/^www\./, "");
        const tenantDomain = tenant.customDomain.toLowerCase().replace(/^www\./, "");
        if (host === tenantDomain) {
          return res.json({ verified: true, tenantId: tenant.id, slug: tenant.slug });
        }
      }
    } catch {}
    res.status(404).json({ verified: false });
  });

  app.get("/api/platform-domain", (_req: Request, res: Response) => {
    const platformDomain = process.env.PLATFORM_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
    const cnameTarget = process.env.REPLIT_DOMAINS?.split(",")[0] || "";
    res.json({ platformDomain, cnameTarget });
  });

  app.get("/api/debug-headers", (req: Request, res: Response) => {
    res.json({
      headers: req.headers,
      hostname: req.hostname,
      host: req.get("host"),
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      originalUrl: req.originalUrl,
    });
  });

  function getEffectiveHost(req: Request): string {
    const candidates = [
      req.get("x-smartcatalog-host"),
      req.get("x-forwarded-host"),
      req.get("x-original-host"),
      req.get("x-real-host"),
      req.get("x-tenant-host"),
      req.get("x-forwarded-server"),
    ];
    for (const val of candidates) {
      if (val) {
        const host = val.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
        if (host && host !== "localhost" && !host.includes("replit") && !host.includes("worf.replit.dev")) {
          return host;
        }
      }
    }

    const origin = req.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).hostname.toLowerCase();
        if (originHost && originHost !== "localhost" && !originHost.includes("replit") && !originHost.includes("worf.replit.dev")) {
          return originHost;
        }
      } catch {}
    }

    const referer = req.get("referer");
    if (referer) {
      try {
        const refHost = new URL(referer).hostname.toLowerCase();
        if (refHost && refHost !== "localhost" && !refHost.includes("replit") && !refHost.includes("worf.replit.dev")) {
          return refHost;
        }
      } catch {}
    }

    const fallbackHost = (req.hostname || req.get("host") || "").toLowerCase().replace(/:\d+$/, "");
    return fallbackHost;
  }

  function extractSubdomain(host: string): string | null {
    const platformDomain = (process.env.PLATFORM_DOMAIN || "").toLowerCase();
    if (!platformDomain) return null;
    const cleanHost = host.replace(/^www\./, "");
    if (cleanHost === platformDomain) return null;
    if (cleanHost.endsWith(`.${platformDomain}`)) {
      const sub = cleanHost.slice(0, -(platformDomain.length + 1));
      if (sub && !sub.includes(".")) return sub;
    }
    return null;
  }

  app.get("/api/domain-detect", async (req: Request, res: Response) => {
    const host = getEffectiveHost(req);
    const hostWithoutWww = host.replace(/^www\./, "");
    
    console.log(`[DomainDetect] effectiveHost=${host} reqHost=${req.get("host")} xfh=${req.get("x-forwarded-host")} origin=${req.get("origin")} xsch=${req.get("x-smartcatalog-host")}`);
    
    const subdomain = extractSubdomain(host);
    if (subdomain) {
      try {
        const tenant = await storage.getTenantBySlug(subdomain);
        if (tenant) {
          return res.json({ customDomain: true, slug: tenant.slug, tenantName: tenant.name, isSubdomain: true });
        }
      } catch (err) {
        console.error("[DomainDetect] Subdomain error:", err);
      }
    }

    if (
      !host ||
      host === "localhost" ||
      host.includes("replit") ||
      host.includes("botfactory.kz") ||
      host.includes("worf.replit.dev")
    ) {
      return res.json({ customDomain: false });
    }

    try {
      let tenant = await storage.getTenantByCustomDomain(hostWithoutWww)
        || await storage.getTenantByCustomDomain(host);
      if (tenant) {
        return res.json({ customDomain: true, slug: tenant.slug, tenantName: tenant.name });
      }

      const domainRow = await pool.query(
        "SELECT tenant_id FROM domains WHERE domain = $1 AND status = 'active' LIMIT 1",
        [hostWithoutWww]
      );
      if (domainRow.rows.length) {
        tenant = await storage.getTenant(domainRow.rows[0].tenant_id);
        if (tenant) {
          return res.json({ customDomain: true, slug: tenant.slug, tenantName: tenant.name });
        }
      }
    } catch (err) {
      console.error("[DomainDetect] Error:", err);
    }
    return res.json({ customDomain: false });
  });

  app.get("/api/public/context", async (req: Request, res: Response) => {
    try {
      const host = getEffectiveHost(req);
      const hostWithoutWww = host.replace(/^www\./, "");

      const subdomain = extractSubdomain(host);
      if (subdomain) {
        const tenant = await storage.getTenantBySlug(subdomain);
        if (tenant) {
          return res.json({
            host,
            tenantId: tenant.id,
            slug: tenant.slug,
            branding: {
              name: tenant.name,
              logoUrl: (tenant as any).logoUrl || null,
              currency: (tenant as any).currency || "KZT",
            },
            source: "subdomain",
          });
        }
      }

      if (
        !host ||
        host === "localhost" ||
        host.includes("replit") ||
        host === "botfactory.kz" ||
        host.includes("worf.replit.dev")
      ) {
        return res.json({ host, tenantId: null, slug: null, branding: null, source: "platform" });
      }

      let tenant = await storage.getTenantByCustomDomain(hostWithoutWww)
        || await storage.getTenantByCustomDomain(host);

      if (!tenant) {
        const domainRow = await pool.query(
          "SELECT tenant_id FROM domains WHERE domain = $1 AND status = 'active' LIMIT 1",
          [hostWithoutWww]
        );
        if (domainRow.rows.length) {
          tenant = await storage.getTenant(domainRow.rows[0].tenant_id);
        }
      }

      if (tenant) {
        return res.json({
          host,
          tenantId: tenant.id,
          slug: tenant.slug,
          branding: {
            name: tenant.name,
            logoUrl: (tenant as any).logoUrl || null,
            currency: (tenant as any).currency || "KZT",
          },
          source: "custom_domain",
        });
      }

      return res.json({ host, tenantId: null, slug: null, branding: null, source: "unknown" });
    } catch (err) {
      console.error("[PublicContext] Error:", err);
      res.status(500).json({ message: "Ошибка определения контекста" });
    }
  });

  // Subdomain + custom domain middleware: route to tenant catalog
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const host = getEffectiveHost(req);
    
    if (
      !host ||
      host === "localhost" ||
      req.path.startsWith("/api") ||
      req.path.startsWith("/c/") ||
      req.path.startsWith("/.well-known") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/assets") ||
      req.path.startsWith("/@") ||
      req.path.startsWith("/node_modules") ||
      req.path.startsWith("/src") ||
      req.path === "/favicon.ico"
    ) {
      return next();
    }

    try {
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        const tenant = await storage.getTenantBySlug(subdomain);
        if (tenant) {
          const originalQuery = req.originalUrl.includes("?") ? req.originalUrl.substring(req.originalUrl.indexOf("?")) : "";
          const subPath = req.path === "/" ? "" : req.path;
          const catalogUrl = `/c/${tenant.slug}${subPath}${originalQuery}`;
          req.url = catalogUrl;
          console.log(`[Subdomain] ${host} → ${catalogUrl}`);
          return next();
        }
      }

      if (
        host.includes("replit") ||
        host.includes("botfactory.kz") ||
        host.includes("worf.replit.dev")
      ) {
        return next();
      }

      const hostWithoutWww = host.replace(/^www\./, "");
      let tenant = await storage.getTenantByCustomDomain(hostWithoutWww) 
        || await storage.getTenantByCustomDomain(host);
      
      if (!tenant) {
        const domainRow = await pool.query(
          "SELECT tenant_id FROM domains WHERE domain = $1 AND status = 'active' LIMIT 1",
          [hostWithoutWww]
        );
        if (domainRow.rows.length) {
          tenant = await storage.getTenant(domainRow.rows[0].tenant_id);
        }
      }

      if (tenant) {
        const originalQuery = req.originalUrl.includes("?") ? req.originalUrl.substring(req.originalUrl.indexOf("?")) : "";
        const subPath = req.path === "/" ? "" : req.path;
        const catalogUrl = `/c/${tenant.slug}${subPath}${originalQuery}`;
        req.url = catalogUrl;
        console.log(`[CustomDomain] ${host} → ${catalogUrl}`);
      }
    } catch (err) {
      console.error("[DomainMiddleware] Error:", err);
    }
    next();
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Неверный email или пароль" });
          }
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Неверный email или пароль" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      
      let enrichedUser: AuthUser = { ...user };
      if (user.tenantId) {
        const tenant = await storage.getTenant(user.tenantId);
        if (tenant) {
          const subscription = await storage.getSubscription(tenant.id);
          enrichedUser.tenant = { ...tenant, subscription };
        }
      }
      
      done(null, enrichedUser);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ошибка валидации", errors: parsed.error.errors });
      }

      const { email, password, name, storeName } = parsed.data;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      const slug = slugify(storeName) + "-" + Math.floor(Math.random() * 1000);
      const tenant = await storage.createTenant({
        name: storeName,
        slug,
        currency: "KZT",
        timezone: "Asia/Almaty",
        language: "ru",
        status: "active",
        aiEnabled: false,
      });

      const user = await storage.createUser({
        email,
        password,
        name,
        role: "owner",
        tenantId: tenant.id,
        isActive: true,
      });

      const defaultPlan = await storage.getDefaultPlan();
      if (defaultPlan) {
        const endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + 14);
        
        await storage.createSubscription({
          tenantId: tenant.id,
          planId: defaultPlan.id,
          status: "active",
          startsAt: new Date(),
          endsAt,
          gracePeriodDays: 3,
        });
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Ошибка входа" });
        }
        res.json({ user: { ...user, password: undefined } });
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Ошибка валидации" });
    }

    passport.authenticate("local", (err: Error | null, user: User | false, info: { message: string } | undefined) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка сервера" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Неверный email или пароль" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Ошибка входа" });
        }
        res.json({ user: { ...user, password: undefined } });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Не авторизован" });
    }
    res.json({ user: { ...req.user, password: undefined } });
  });

  // Password reset - request email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email обязателен" });
      }

      const user = await storage.getUserByEmail(email);
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля" });
      }

      // Generate token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to database
      await storage.createPasswordResetToken({
        email,
        token,
        expiresAt,
      });

      // Build reset link - prioritize APP_URL for production
      const baseUrl = process.env.APP_URL 
        || (process.env.REPLIT_DOMAINS 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : "http://localhost:5000");
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      await sendPasswordResetEmail(email, resetLink);

      res.json({ message: "Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля" });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      res.status(500).json({ message: "Ошибка отправки письма. Попробуйте позже." });
    }
  });

  // Password reset - set new password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Токен и пароль обязательны" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Пароль должен быть не менее 6 символов" });
      }

      // Find valid token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Недействительная или просроченная ссылка" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ message: "Ссылка уже использована" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Ссылка просрочена. Запросите новую." });
      }

      // Find user and update password
      const user = await storage.getUserByEmail(resetToken.email);
      if (!user) {
        return res.status(400).json({ message: "Пользователь не найден" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);

      res.json({ message: "Пароль успешно изменён. Теперь вы можете войти." });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Ошибка сброса пароля" });
    }
  });

  // Validate reset token
  app.get("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ valid: false, message: "Токен обязателен" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.json({ valid: false, message: "Недействительная ссылка" });
      }

      if (resetToken.usedAt) {
        return res.json({ valid: false, message: "Ссылка уже использована" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.json({ valid: false, message: "Ссылка просрочена" });
      }

      res.json({ valid: true, email: resetToken.email });
    } catch (error) {
      console.error("Error validating reset token:", error);
      res.status(500).json({ valid: false, message: "Ошибка проверки токена" });
    }
  });

  app.get("/api/tenant", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId!);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения данных" });
    }
  });

  // Helper to normalize domain input consistently
  function normalizeDomain(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  app.put("/api/tenant", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      
      // Normalize custom domain
      if (data.customDomain) {
        data.customDomain = normalizeDomain(data.customDomain);
        
        if (!data.customDomain) {
          data.customDomain = null;
        } else {
          // Check if this domain is already used by another tenant
          const existing = await storage.getTenantByCustomDomain(data.customDomain);
          if (existing && existing.id !== req.user!.tenantId!) {
            return res.status(400).json({ message: "Этот домен уже используется другим магазином" });
          }
        }
      }
      
      const tenant = await storage.updateTenant(req.user!.tenantId!, data);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления" });
    }
  });

  app.get("/api/tenant/domain-check", requireAuth, async (req, res) => {
    try {
      const rawDomain = req.query.domain as string || "";
      const domain = normalizeDomain(rawDomain);
      if (!domain) {
        return res.status(400).json({ message: "Домен не указан" });
      }
      
      const existing = await storage.getTenantByCustomDomain(domain);
      const isAvailable = !existing || existing.id === req.user!.tenantId!;
      
      res.json({ 
        domain,
        available: isAvailable,
        message: isAvailable ? "Домен доступен" : "Домен уже используется другим магазином"
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка проверки домена" });
    }
  });

  app.post("/api/tenant/domain-verify", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId!);
      if (!tenant) {
        return res.status(404).json({ message: "Тенант не найден" });
      }
      
      const rawDomain = tenant.customDomain;
      if (!rawDomain) {
        return res.json({
          status: "no_domain",
          message: "Домен не указан в настройках. Сначала укажите и сохраните домен.",
        });
      }
      const domain = normalizeDomain(rawDomain);
      const platformDomain = process.env.PLATFORM_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";

      let httpVerified = false;
      let dnsResolved = false;
      const details: { method: string; result: string }[] = [];

      // Method 1: HTTP probe - most reliable, works with any proxy (Cloudflare, etc.)
      try {
        const probeUrl = `https://${domain}/.well-known/catalog-verify/${tenant.id}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(probeUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'SmartCatalog-DomainVerifier/1.0' }
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.verified && data.tenantId === tenant.id) {
            httpVerified = true;
            details.push({ method: "HTTP", result: "OK" });
          } else {
            details.push({ method: "HTTP", result: "Response mismatch" });
          }
        } else {
          details.push({ method: "HTTP", result: `HTTP ${response.status}` });
        }
      } catch (err: any) {
        details.push({ method: "HTTP", result: err.message || "Connection failed" });
      }

      // Method 2: DNS check (CNAME or A-record resolution)
      try {
        const dns = await import("dns");
        const { promisify } = await import("util");
        const resolveCname = promisify(dns.resolveCname);
        try {
          const cnameRecords = await resolveCname(domain);
          const cnameMatch = cnameRecords.some((r: string) => 
            r.toLowerCase().includes(platformDomain.toLowerCase())
          );
          if (cnameMatch) {
            dnsResolved = true;
            details.push({ method: "CNAME", result: `OK - ${cnameRecords[0]}` });
          } else {
            details.push({ method: "CNAME", result: `${cnameRecords.join(", ")} (ожидается ${platformDomain})` });
          }
        } catch {
          // CNAME not found — check if domain resolves at all (Cloudflare proxy hides CNAME)
          const resolve4 = promisify(dns.resolve4);
          try {
            const ips = await resolve4(domain);
            if (ips && ips.length > 0) {
              dnsResolved = true;
              details.push({ method: "DNS", result: `OK - домен резолвится (${ips[0]}), вероятно через Cloudflare proxy` });
            }
          } catch {
            details.push({ method: "DNS", result: "Домен не резолвится. Проверьте NS-записи и настройки Cloudflare." });
          }
        }
      } catch {
        details.push({ method: "DNS", result: "Ошибка DNS-проверки" });
      }

      let status: string;
      let message: string;

      if (httpVerified) {
        status = "verified";
        message = `Домен ${domain} подключён и работает. Трафик правильно направляется на вашу платформу.`;
        await storage.updateTenant(tenant.id, { domainVerified: true });
      } else if (dnsResolved) {
        status = "partial";
        message = `DNS настроен (домен резолвится), но HTTP-проверка не прошла. Убедитесь, что CNAME указывает на ${platformDomain}, Cloudflare Proxy включен (оранжевое облако), и SSL режим — Full. Ожидайте до 10 минут.`;
        await storage.updateTenant(tenant.id, { domainVerified: false });
      } else {
        status = "not_configured";
        message = `Домен ${domain} ещё не настроен. Создайте CNAME-запись, указывающую на ${platformDomain}. Если используете Cloudflare — включите проксирование (оранжевое облако). Изменения DNS могут занять до 24 часов.`;
        await storage.updateTenant(tenant.id, { domainVerified: false });
      }

      res.json({ status, message, details, platformDomain });
    } catch (error) {
      console.error("[DomainVerify] Error:", error);
      res.status(500).json({ message: "Ошибка проверки DNS" });
    }
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      
      // Include main image from product_images if mainImageUrl is null
      const productsWithImages = await Promise.all(products.map(async (product) => {
        if (!product.mainImageUrl) {
          const productImages = await storage.getProductImages(product.id, req.user!.tenantId!);
          const mainImage = productImages.find(img => img.isMain) || productImages[0];
          if (mainImage) {
            return { ...product, mainImageUrl: mainImage.url };
          }
        }
        return product;
      }));
      
      res.json(productsWithImages);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения товаров" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id, req.user!.tenantId!);
      if (!product) {
        return res.status(404).json({ message: "Товар не найден" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения товара" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const limitCheck = await checkPlanLimit(req.user!.tenantId!, 'products');
      if (!limitCheck.allowed) {
        return res.status(403).json({ message: limitCheck.message });
      }
      
      const { categoryId, mainImageUrl, description, ...rest } = req.body;
      const product = await storage.createProduct({
        ...rest,
        categoryId: categoryId && categoryId.trim() !== "" ? categoryId : null,
        mainImageUrl: mainImageUrl && mainImageUrl.trim() !== "" ? mainImageUrl : null,
        description: description && description.trim() !== "" ? description : null,
        tenantId: req.user!.tenantId!,
      });
      res.json(product);
    } catch (error) {
      console.error("Product creation error:", error);
      res.status(500).json({ message: "Ошибка создания товара" });
    }
  });

  app.put("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const { categoryId, mainImageUrl, description, ...rest } = req.body;
      const product = await storage.updateProduct(req.params.id, req.user!.tenantId!, {
        ...rest,
        categoryId: categoryId && categoryId.trim() !== "" ? categoryId : null,
        mainImageUrl: mainImageUrl && mainImageUrl.trim() !== "" ? mainImageUrl : null,
        description: description && description.trim() !== "" ? description : null,
      });
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления товара" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.user!.tenantId!, req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления товара" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления товара" });
    }
  });

  app.get("/api/products/:productId/variants", requireAuth, async (req, res) => {
    try {
      const variants = await storage.getProductVariants(req.params.productId, req.user!.tenantId!);
      res.json(variants);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения вариантов" });
    }
  });

  app.post("/api/products/:productId/variants", requireAuth, async (req, res) => {
    try {
      const variantData = {
        productId: req.params.productId,
        tenantId: req.user!.tenantId!,
        sku: req.body.sku || null,
        option1Name: req.body.option1Name || null,
        option1Value: req.body.option1Value || null,
        option2Name: req.body.option2Name || null,
        option2Value: req.body.option2Value || null,
        price: req.body.price || null,
        stockQty: parseInt(req.body.stockQty) || 0,
      };
      const variant = await storage.createProductVariant(variantData);
      res.status(201).json(variant);
    } catch (error) {
      console.error("Error creating variant:", error);
      res.status(500).json({ message: "Ошибка создания варианта" });
    }
  });

  app.put("/api/products/:productId/variants/:variantId", requireAuth, async (req, res) => {
    try {
      const updateData = {
        sku: req.body.sku || null,
        option1Name: req.body.option1Name || null,
        option1Value: req.body.option1Value || null,
        option2Name: req.body.option2Name || null,
        option2Value: req.body.option2Value || null,
        price: req.body.price || null,
        stockQty: parseInt(req.body.stockQty) || 0,
      };
      const variant = await storage.updateProductVariant(
        req.params.variantId,
        req.user!.tenantId!,
        updateData
      );
      if (!variant) {
        return res.status(404).json({ message: "Вариант не найден" });
      }
      res.json(variant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления варианта" });
    }
  });

  app.delete("/api/products/:productId/variants/:variantId", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductVariant(req.params.variantId, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления варианта" });
    }
  });

  app.get("/api/products/:productId/images", requireAuth, async (req, res) => {
    try {
      const images = await storage.getProductImages(req.params.productId, req.user!.tenantId!);
      res.json(images);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения изображений" });
    }
  });

  app.post("/api/products/:productId/images", requireAuth, async (req, res) => {
    try {
      const { objectPaths } = req.body;
      if (!objectPaths || !Array.isArray(objectPaths) || objectPaths.length === 0) {
        return res.status(400).json({ message: "Не указаны пути к изображениям" });
      }

      const existingImages = await storage.getProductImages(req.params.productId, req.user!.tenantId!);
      const hasMainImage = existingImages.some(img => img.isMain);

      const objectStorageService = new ObjectStorageService();
      const createdImages = [];
      
      for (let i = 0; i < objectPaths.length; i++) {
        const objectPath = objectPaths[i];
        
        try {
          await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
            owner: req.user!.id,
            visibility: "public",
          });
        } catch (e) {
          console.error("Error setting ACL policy:", e);
        }

        const image = await storage.createProductImage({
          productId: req.params.productId,
          tenantId: req.user!.tenantId!,
          url: objectPath,
          isMain: !hasMainImage && i === 0,
          sortOrder: existingImages.length + i,
        });
        createdImages.push(image);
      }

      res.status(201).json(createdImages);
    } catch (error) {
      console.error("Error saving images:", error);
      res.status(500).json({ message: "Ошибка сохранения изображений" });
    }
  });

  app.post("/api/products/:productId/images/:imageId/main", requireAuth, async (req, res) => {
    try {
      await storage.setMainImage(req.params.productId, req.params.imageId, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка установки главного изображения" });
    }
  });

  app.delete("/api/products/:productId/images/:imageId", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductImage(req.params.imageId, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления изображения" });
    }
  });

  app.post("/api/products/generate-description", requireAuth, async (req, res) => {
    try {
      const { name, category, price, attributes, currentText, style, options, action } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Заполните название товара для генерации описания" });
      }

      const { generateProductDescription, isOpenAiConfigured } = await import("./services/openai");
      
      if (!isOpenAiConfigured()) {
        return res.status(503).json({ message: "AI сервис не настроен" });
      }

      const result = await generateProductDescription({
        name,
        category,
        price,
        attributes,
        currentText,
        style: style || "selling",
        options,
        action,
      });

      res.json(result);
    } catch (error: any) {
      console.error("AI description generation error:", error);
      res.status(500).json({ message: "Ошибка генерации описания" });
    }
  });

  app.post("/api/import/product", requireAuth, async (req, res) => {
    try {
      const { mode, fieldsToUpdate, ...productData } = req.body;
      const tenantId = req.user!.tenantId!;

      const existingProducts = await storage.getProducts(tenantId);
      const existingProduct = existingProducts.find(p => p.sku === productData.sku);

      if (mode === "upsert" && existingProduct) {
        const updateData: any = {};
        if (fieldsToUpdate?.price && productData.price) {
          updateData.price = productData.price;
        }
        if (fieldsToUpdate?.stockQty !== undefined && productData.stockQty !== undefined) {
          updateData.stockQty = productData.stockQty;
        }
        if (fieldsToUpdate?.description && productData.description) {
          updateData.description = productData.description;
        }
        if (fieldsToUpdate?.category && productData.categoryId) {
          updateData.categoryId = productData.categoryId;
        }

        if (Object.keys(updateData).length > 0) {
          await storage.updateProduct(existingProduct.id, tenantId, updateData);
        }
        return res.json({ created: false, updated: true, id: existingProduct.id });
      }

      const product = await storage.createProduct({
        ...productData,
        tenantId,
      });

      res.json({ created: true, updated: false, id: product.id });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Ошибка импорта товара" });
    }
  });

  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getCategories(req.user!.tenantId!);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения категорий" });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const limitCheck = await checkPlanLimit(req.user!.tenantId!, 'categories');
      if (!limitCheck.allowed) {
        return res.status(403).json({ message: limitCheck.message });
      }
      
      const category = await storage.createCategory({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания категории" });
    }
  });

  app.put("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const category = await storage.updateCategory(req.params.id, req.user!.tenantId!, req.body);
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления категории" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления категории" });
    }
  });

  app.get("/api/discounts", requireAuth, async (req, res) => {
    try {
      const discounts = await storage.getDiscounts(req.user!.tenantId!);
      res.json(discounts);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения скидок" });
    }
  });

  app.post("/api/discounts", requireAuth, async (req, res) => {
    try {
      const limitCheck = await checkPlanLimit(req.user!.tenantId!, 'discounts');
      if (!limitCheck.allowed) {
        return res.status(403).json({ message: limitCheck.message });
      }
      
      const data = { ...req.body };
      // Convert date strings to Date objects or null
      if (data.startsAt !== undefined) {
        data.startsAt = data.startsAt ? new Date(data.startsAt) : null;
      }
      if (data.endsAt !== undefined) {
        data.endsAt = data.endsAt ? new Date(data.endsAt) : null;
      }
      
      const discount = await storage.createDiscount({
        ...data,
        tenantId: req.user!.tenantId!,
      });
      res.json(discount);
    } catch (error) {
      console.error("Error creating discount:", error);
      res.status(500).json({ message: "Ошибка создания скидки" });
    }
  });

  app.put("/api/discounts/:id", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      // Convert date strings to Date objects or null
      if (data.startsAt !== undefined) {
        data.startsAt = data.startsAt ? new Date(data.startsAt) : null;
      }
      if (data.endsAt !== undefined) {
        data.endsAt = data.endsAt ? new Date(data.endsAt) : null;
      }
      const discount = await storage.updateDiscount(req.params.id, req.user!.tenantId!, data);
      res.json(discount);
    } catch (error) {
      console.error("Error updating discount:", error);
      res.status(500).json({ message: "Ошибка обновления скидки" });
    }
  });

  app.delete("/api/discounts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDiscount(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления скидки" });
    }
  });

  // ============ PROMO BLOCKS ============
  app.get("/api/promo-blocks", requireAuth, async (req, res) => {
    try {
      const blocks = await storage.getPromoBlocks(req.user!.tenantId!);
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения промо-блоков" });
    }
  });

  app.post("/api/promo-blocks", requireAuth, async (req, res) => {
    try {
      // Set image as public if it's an object storage path
      if (req.body.imageUrl) {
        const objectPath = req.body.imageUrl.replace(/^\/objects\//, '');
        try {
          const promoObjectStorage = new ObjectStorageService();
          await promoObjectStorage.trySetObjectEntityAclPolicy(objectPath, {
            owner: req.user!.id,
            visibility: "public",
          });
        } catch (e) {
          console.error("Failed to set promo image public:", e);
        }
      }
      const block = await storage.createPromoBlock({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(block);
    } catch (error) {
      console.error("Create promo block error:", error);
      res.status(500).json({ message: "Ошибка создания промо-блока" });
    }
  });

  app.put("/api/promo-blocks/:id", requireAuth, async (req, res) => {
    try {
      const block = await storage.getPromoBlock(req.params.id);
      if (!block || block.tenantId !== req.user!.tenantId!) {
        return res.status(404).json({ message: "Промо-блок не найден" });
      }
      // Set new image as public if changed
      if (req.body.imageUrl && req.body.imageUrl !== block.imageUrl) {
        const objectPath = req.body.imageUrl.replace(/^\/objects\//, '');
        try {
          const promoObjectStorage = new ObjectStorageService();
          await promoObjectStorage.trySetObjectEntityAclPolicy(objectPath, {
            owner: req.user!.id,
            visibility: "public",
          });
        } catch (e) {
          console.error("Failed to set promo image public:", e);
        }
      }
      const updated = await storage.updatePromoBlock(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления промо-блока" });
    }
  });

  app.delete("/api/promo-blocks/:id", requireAuth, async (req, res) => {
    try {
      const block = await storage.getPromoBlock(req.params.id);
      if (!block || block.tenantId !== req.user!.tenantId!) {
        return res.status(404).json({ message: "Промо-блок не найден" });
      }
      await storage.deletePromoBlock(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления промо-блока" });
    }
  });

  app.post("/api/uploads/video", requireAuth, express.raw({ type: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"], limit: "50mb" }), async (req, res) => {
    try {
      const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
      const contentType = req.headers["content-type"]?.split(";")[0]?.trim();
      if (!contentType || !allowedVideoTypes.includes(contentType)) {
        return res.status(400).json({ error: "Неверный формат. Только MP4, MOV, WebM, AVI." });
      }

      const { optimizeVideo } = await import("./services/video-optimizer.js");
      const originalName = (req.headers["x-original-filename"] as string) || "video.mp4";
      const inputBuffer = req.body as Buffer;

      if (!inputBuffer || inputBuffer.length === 0) {
        return res.status(400).json({ error: "Видео файл не получен" });
      }

      if (inputBuffer.length > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "Файл слишком большой. Максимум 50MB." });
      }

      const { buffer: optimizedBuffer, mimeType } = await optimizeVideo(inputBuffer, originalName, { maxDuration: 15 });

      const videoObjectStorage = new ObjectStorageService();
      const objectPath = await videoObjectStorage.uploadBuffer(optimizedBuffer, mimeType);

      res.json({
        objectPath,
        originalSize: inputBuffer.length,
        optimizedSize: optimizedBuffer.length,
        savedPercent: Math.round((1 - optimizedBuffer.length / inputBuffer.length) * 100),
      });
    } catch (error: any) {
      console.error("Video upload/optimize error:", error);
      res.status(500).json({ error: error.message || "Ошибка обработки видео" });
    }
  });

  app.post("/api/uploads/product-video", requireAuth, express.raw({ type: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"], limit: "50mb" }), async (req, res) => {
    try {
      const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
      const contentType = req.headers["content-type"]?.split(";")[0]?.trim();
      if (!contentType || !allowedVideoTypes.includes(contentType)) {
        return res.status(400).json({ error: "Неверный формат. Только MP4, MOV, WebM, AVI." });
      }

      const { optimizeVideo } = await import("./services/video-optimizer.js");
      const originalName = decodeURIComponent((req.headers["x-original-filename"] as string) || "video.mp4");
      const aspectRatio = (req.headers["x-aspect-ratio"] as string) || "16:9";
      const generatePoster = req.headers["x-generate-poster"] === "true";
      const maxDuration = parseInt(req.headers["x-max-duration"] as string) || 30;
      const inputBuffer = req.body as Buffer;

      if (!inputBuffer || inputBuffer.length === 0) {
        return res.status(400).json({ error: "Видео файл не получен" });
      }

      if (inputBuffer.length > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "Файл слишком большой. Максимум 50MB." });
      }

      const validAspects = ["16:9", "9:16", "1:1"];
      if (!validAspects.includes(aspectRatio)) {
        return res.status(400).json({ error: "Неверный формат видео. Допустимые: 16:9, 9:16, 1:1" });
      }

      const result = await optimizeVideo(inputBuffer, originalName, {
        aspectRatio: aspectRatio as any,
        maxDuration,
        generatePoster,
      });

      const videoStorage = new ObjectStorageService();
      const videoPath = await videoStorage.uploadBuffer(result.buffer, result.mimeType);

      let posterPath: string | undefined;
      if (result.posterBuffer && result.posterMimeType) {
        posterPath = await videoStorage.uploadBuffer(result.posterBuffer, result.posterMimeType);
      }

      res.json({
        videoPath,
        posterPath,
        aspectRatio,
        originalSize: inputBuffer.length,
        optimizedSize: result.buffer.length,
        savedPercent: Math.round((1 - result.buffer.length / inputBuffer.length) * 100),
      });
    } catch (error: any) {
      console.error("Product video upload error:", error);
      res.status(500).json({ error: error.message || "Ошибка обработки видео" });
    }
  });

  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrders(req.user!.tenantId!);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения заказов" });
    }
  });

  app.get("/api/crm/stats", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrders(req.user!.tenantId!);
      const stats = {
        total: orders.length,
        new: orders.filter(o => o.status === "new").length,
        inProgress: orders.filter(o => o.status === "in_progress").length,
        awaitingPayment: orders.filter(o => o.status === "awaiting_payment").length,
        paid: orders.filter(o => o.status === "paid").length,
        completed: orders.filter(o => o.status === "completed").length,
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статистики CRM" });
    }
  });

  app.post("/api/crm/deals/:id/ai-analyze", requireAuth, async (req, res) => {
    try {
      const { generateAiResponse, isOpenAiConfigured } = await import("./services/openai");
      
      if (!isOpenAiConfigured()) {
        return res.status(400).json({ message: "AI не настроен" });
      }

      const tenantId = req.user!.tenantId!;
      const order = await storage.getOrder(req.params.id, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }

      const tenant = await storage.getTenant(tenantId);
      const items = (order as any).items || [];

      const dealContext = `
Информация о сделке:
- Номер сделки: #${order.orderNumber}
- Клиент: ${order.customerName}
- Телефон: ${order.customerPhone}
- Статус сделки: ${order.status}
- Статус оплаты: ${order.paymentStatus || 'ожидает'}
- Сумма: ${order.total} тенге
- Дата создания: ${new Date(order.createdAt).toLocaleString('ru-RU')}
- Товары: ${items.map((i: any) => `${i.productName} x${i.quantity}`).join(', ') || 'нет данных'}
- Комментарий клиента: ${order.comment || 'нет'}
- WhatsApp отправлен: ${order.whatsappSent ? 'да' : 'нет'}
- Компания: ${tenant?.companyName || 'не указана'}
      `.trim();

      const systemPrompt = `Ты - бизнес-консультант для CRM системы SmartCatalog. Анализируй сделки и давай рекомендации.

Формат ответа:
📊 АНАЛИЗ
[Краткий анализ текущего состояния сделки]

⚠️ РИСКИ
[Потенциальные риски и проблемы]

📝 ЧТО НАПИСАТЬ КЛИЕНТУ
[Готовый текст сообщения для отправки клиенту в WhatsApp]

✅ СЛЕДУЮЩИЙ ШАГ
[Конкретное действие для менеджера]

Будь кратким, но информативным. Используй эмодзи для структуры.`;

      const result = await generateAiResponse(
        `Проанализируй эту сделку и дай рекомендации:\n\n${dealContext}`,
        [],
        { systemPrompt, tenantId }
      );

      res.json({ 
        analysis: result.content,
        dealContext 
      });
    } catch (error) {
      console.error("[CRM AI Analysis Error]", error);
      res.status(500).json({ message: "Ошибка AI анализа" });
    }
  });

  app.post("/api/crm/deals/:id/generate-message", requireAuth, async (req, res) => {
    try {
      const { generateAiResponse, isOpenAiConfigured } = await import("./services/openai");
      
      if (!isOpenAiConfigured()) {
        return res.status(400).json({ message: "AI не настроен" });
      }

      const templateSchema = z.object({
        template: z.enum(["payment_reminder", "delivery_confirmation", "cart_followup", "thank_you"])
      });
      
      const validation = templateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Неверный шаблон сообщения" });
      }

      const { template } = validation.data;
      const tenantId = req.user!.tenantId!;
      const order = await storage.getOrder(req.params.id, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }

      const tenant = await storage.getTenant(tenantId);
      const items = (order as any).items || [];

      const templates: Record<string, string> = {
        payment_reminder: "Напоминание об оплате",
        delivery_confirmation: "Уточнение доставки",
        cart_followup: "Дожим после добавления в корзину",
        thank_you: "Благодарность после оплаты",
      };

      const templateName = templates[template] || template;

      const dealContext = `
Клиент: ${order.customerName}
Телефон: ${order.customerPhone}
Номер заказа: #${order.orderNumber}
Сумма: ${order.total} тенге
Товары: ${items.map((i: any) => `${i.productName} x${i.quantity}`).join(', ') || 'товары'}
Статус оплаты: ${order.paymentStatus || 'ожидает'}
Компания: ${tenant?.companyName || 'SmartCatalog'}
      `.trim();

      const systemPrompt = `Ты - помощник для генерации сообщений клиентам. 
Генерируй дружелюбные, но профессиональные сообщения на русском языке для WhatsApp.
Используй имя клиента, сумму заказа и название товаров.
Не используй слишком много эмодзи (максимум 1-2).
Сообщение должно быть коротким (2-4 предложения).`;

      const result = await generateAiResponse(
        `Сгенерируй сообщение типа "${templateName}" для клиента:\n\n${dealContext}`,
        [],
        { systemPrompt, tenantId }
      );

      res.json({ 
        message: result.content,
        template: templateName 
      });
    } catch (error) {
      console.error("[CRM Message Generation Error]", error);
      res.status(500).json({ message: "Ошибка генерации сообщения" });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id, req.user!.tenantId!);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения заказа" });
    }
  });

  app.patch("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const { status: newStatus, paymentStatus: newPaymentStatus, paymentSource } = req.body;
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;
      
      const currentOrder = await storage.getOrder(req.params.id, tenantId);
      if (!currentOrder) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      const oldStatus = currentOrder.status;
      const oldPaymentStatus = currentOrder.paymentStatus;
      
      // If changing to completed, deduct stock for each item
      if (newStatus === "completed" && currentOrder.status !== "completed") {
        const items = currentOrder.items || [];
        for (const item of items) {
          const product = await storage.getProduct(item.productId, tenantId);
          if (product) {
            const newStock = Math.max(0, (product.stockQty || 0) - item.quantity);
            await storage.updateProduct(item.productId, tenantId, { stockQty: newStock });
            console.log(`[Order ${req.params.id}] Deducted ${item.quantity} from product ${item.productId}, new stock: ${newStock}`);
          }
        }
      }
      
      // Prepare update data
      const updateData: Record<string, unknown> = {};
      if (newStatus) updateData.status = newStatus;
      if (newPaymentStatus) updateData.paymentStatus = newPaymentStatus;
      
      // If marking as paid manually
      if (newStatus === "paid" || newPaymentStatus === "paid") {
        updateData.paymentSource = paymentSource || "manual";
        if (!currentOrder.paidAt) {
          updateData.paidAt = new Date();
        }
        if (!currentOrder.paymentProvider) {
          updateData.paymentProvider = "manual";
        }
      }
      
      const order = await storage.updateOrderWithPayment(req.params.id, tenantId, updateData);
      
      // Log the status change
      if ((newStatus && newStatus !== oldStatus) || (newPaymentStatus && newPaymentStatus !== oldPaymentStatus)) {
        await storage.logOrderStatusChange({
          orderId: req.params.id,
          oldStatus,
          newStatus: newStatus || oldStatus,
          oldPaymentStatus,
          newPaymentStatus: newPaymentStatus || oldPaymentStatus,
          changedBy: "user",
          userId,
          source: paymentSource || "manual",
        });
      }
      
      // If payment status changed to paid, trigger CRM sync and notifications
      if (newPaymentStatus === "paid" && oldPaymentStatus !== "paid") {
        const tenant = await storage.getTenant(tenantId);
        
        // Send Telegram notification
        if (tenant?.telegramBotToken && tenant?.telegramChatId) {
          const { sendTelegramMessage } = await import("./services/telegram");
          const sourceLabel = paymentSource === "auto" ? "автоматически" : "вручную";
          const message = `💰 Заказ №${order?.orderNumber} отмечен как оплаченный (${order?.total} ₸)\n\nИсточник: ${sourceLabel}`;
          sendTelegramMessage({
            botToken: tenant.telegramBotToken,
            chatId: tenant.telegramChatId,
            message,
          }).catch(err => console.error("Failed to send payment Telegram notification:", err));
        }
        
        // Sync with CRM if connected
        try {
          const { syncOrderStatusToCrm } = await import("./services/crm");
          syncOrderStatusToCrm(order!, "paid").catch(err => 
            console.error("Failed to sync paid status to CRM:", err)
          );
        } catch (crmErr) {
          console.error("CRM sync error:", crmErr);
        }
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Ошибка обновления заказа" });
    }
  });

  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const analytics = await storage.getAnalytics(req.user!.tenantId!);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения аналитики" });
    }
  });

  app.get("/api/analytics/traffic-sources", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const trafficData = await storage.getTrafficSources(req.user!.tenantId!, fromDate, toDate);
      res.json(trafficData);
    } catch (error) {
      console.error("Error getting traffic sources:", error);
      res.status(500).json({ message: "Ошибка получения источников трафика" });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      const orders = await storage.getOrders(req.user!.tenantId!);
      const analytics = await storage.getAnalytics(req.user!.tenantId!);

      res.json({
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === "new").length,
        totalVisitors: analytics.uniqueVisitors,
        revenue: analytics.revenue,
        conversionRate: analytics.conversionRate,
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статистики" });
    }
  });

  app.get("/api/catalog-health", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      const categories = await storage.getCategories(req.user!.tenantId!);
      
      // Get all product images to check which products have images in product_images table
      const allProductImages = await storage.getAllProductImages();
      const productsWithImagesInTable = new Set(
        allProductImages
          .filter(img => products.some(p => p.id === img.productId))
          .map(img => img.productId)
      );

      // Product has images if it has mainImageUrl OR has entries in product_images table
      const productsWithoutImages = products.filter(p => 
        !p.mainImageUrl && !productsWithImagesInTable.has(p.id)
      );
      const productsWithoutDescription = products.filter(p => !p.description || p.description.trim() === "");
      const productsWithZeroPrice = products.filter(p => parseFloat(p.price) === 0);
      const inactiveProducts = products.filter(p => !p.isActive);

      const categoryProductCounts = new Map<string, number>();
      products.forEach(p => {
        if (p.categoryId) {
          categoryProductCounts.set(p.categoryId, (categoryProductCounts.get(p.categoryId) || 0) + 1);
        }
      });
      const emptyCategories = categories.filter(c => !categoryProductCounts.has(c.id));

      let score = 100;
      const recommendations: string[] = [];

      if (products.length === 0) {
        score = 0;
        recommendations.push("Добавьте товары в каталог — это основа вашего магазина");
      } else {
        const noImagePercent = (productsWithoutImages.length / products.length) * 100;
        const noDescPercent = (productsWithoutDescription.length / products.length) * 100;
        const zeroPricePercent = (productsWithZeroPrice.length / products.length) * 100;
        const inactivePercent = (inactiveProducts.length / products.length) * 100;

        score -= Math.min(30, noImagePercent * 0.5);
        score -= Math.min(20, noDescPercent * 0.3);
        score -= Math.min(25, zeroPricePercent * 2.5);
        score -= Math.min(15, inactivePercent * 0.3);
        score -= Math.min(10, emptyCategories.length * 2);

        if (productsWithoutImages.length > 0) {
          recommendations.push(`Добавьте фото к ${productsWithoutImages.length} товарам — это повышает конверсию на 30%`);
        }
        if (productsWithoutDescription.length > 0) {
          recommendations.push(`Добавьте описание к ${productsWithoutDescription.length} товарам — клиенты хотят знать детали`);
        }
        if (productsWithZeroPrice.length > 0) {
          recommendations.push(`Установите цену для ${productsWithZeroPrice.length} товаров — товары с ценой 0 не продаются`);
        }
        if (emptyCategories.length > 0) {
          recommendations.push(`Заполните ${emptyCategories.length} пустых категорий или удалите их`);
        }
        if (inactiveProducts.length > 5) {
          recommendations.push(`У вас ${inactiveProducts.length} неактивных товаров — активируйте их или удалите`);
        }
        if (categories.length === 0 && products.length > 5) {
          recommendations.push("Создайте категории для удобной навигации клиентов");
        }
      }

      score = Math.max(0, Math.min(100, Math.round(score)));

      res.json({
        score,
        totalProducts: products.length,
        totalCategories: categories.length,
        issues: {
          productsWithoutImages: {
            count: productsWithoutImages.length,
            items: productsWithoutImages.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
          },
          productsWithoutDescription: {
            count: productsWithoutDescription.length,
            items: productsWithoutDescription.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
          },
          productsWithZeroPrice: {
            count: productsWithZeroPrice.length,
            items: productsWithZeroPrice.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
          },
          emptyCategories: {
            count: emptyCategories.length,
            items: emptyCategories.slice(0, 10).map(c => ({ id: c.id, name: c.name })),
          },
          inactiveProducts: {
            count: inactiveProducts.length,
            items: inactiveProducts.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
          },
        },
        recommendations,
      });
    } catch (error) {
      console.error("Catalog health error:", error);
      res.status(500).json({ message: "Ошибка анализа каталога" });
    }
  });

  app.get("/api/billing", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getSubscription(req.user!.tenantId!);
      if (!subscription) {
        return res.status(404).json({ message: "Подписка не найдена" });
      }

      const products = await storage.getProducts(req.user!.tenantId!);
      const categories = await storage.getCategories(req.user!.tenantId!);
      const discounts = await storage.getDiscounts(req.user!.tenantId!);
      const promotions = await storage.getPromotions(req.user!.tenantId!);

      const plan = subscription.plan;
      const daysLeft = Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      res.json({
        subscription,
        usage: {
          products: { current: products.length, limit: plan?.maxProducts || 100 },
          categories: { current: categories.length, limit: plan?.maxCategories || 10 },
          promotions: { current: promotions.length, limit: plan?.maxPromotions || 5 },
          discounts: { current: discounts.length, limit: plan?.maxDiscountRules || 10 },
          managers: { current: 1, limit: plan?.maxManagers || 1 },
          aiMessages: { current: 0, limit: plan?.aiMessagesLimit || 100 },
        },
        daysLeft,
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения биллинга" });
    }
  });

  // Public endpoint to get plans for popup
  app.get("/api/plans", async (req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans.filter(p => p.isActive));
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения тарифов" });
    }
  });

  // Request plan upgrade (user submits from popup)
  const requestPlanSchema = z.object({
    planId: z.string().uuid(),
  });

  app.post("/api/request-plan", requireAuth, async (req, res) => {
    try {
      const parsed = requestPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверные данные" });
      }

      const { planId } = parsed.data;

      // Verify plan exists
      const plans = await storage.getPlans();
      const targetPlan = plans.find(p => p.id === planId);
      if (!targetPlan) {
        return res.status(404).json({ message: "Тариф не найден" });
      }

      // Save request to subscription
      const subscription = await storage.getSubscription(req.user!.tenantId!);
      if (!subscription) {
        return res.status(404).json({ message: "Подписка не найдена" });
      }

      // If requesting free plan (Старт), activate it immediately
      if (targetPlan.price === 0) {
        await storage.changeSubscriptionPlan(subscription.id, planId);
        // Clear any pending request
        await storage.setRequestedPlan(subscription.id, null);
      } else {
        // Save plan request for admin approval
        await storage.setRequestedPlan(subscription.id, planId);
      }

      // Mark popup as shown
      await storage.markPlanPopupShown(req.user!.id);

      res.json({ success: true, planName: targetPlan.name });
    } catch (error) {
      console.error("Request plan error:", error);
      res.status(500).json({ message: "Ошибка отправки запроса" });
    }
  });

  // Dismiss plan popup without selecting
  app.post("/api/dismiss-plan-popup", requireAuth, async (req, res) => {
    try {
      await storage.markPlanPopupShown(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка" });
    }
  });

  app.get("/api/catalog/:slug", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      const products = await storage.getProducts(tenant.id);
      const categories = await storage.getCategories(tenant.id);
      const promotions = await storage.getPromotions(tenant.id);
      const discounts = await storage.getDiscounts(tenant.id);

      await storage.logEvent({
        tenantId: tenant.id,
        eventType: "catalog_view",
        sessionId: req.sessionID,
      });

      const activeProducts = products.filter(p => p.isActive);
      
      // Get product images for products without mainImageUrl
      const productsWithPrices = await Promise.all(activeProducts.map(async (product) => {
        const priceData = computeProductPrice(product, discounts as any, promotions as any);
        
        // If no mainImageUrl, try to get from product_images
        let displayImageUrl = product.mainImageUrl;
        if (!displayImageUrl) {
          const productImages = await storage.getProductImages(product.id, tenant.id);
          const mainImage = productImages.find(img => img.isMain) || productImages[0];
          if (mainImage) {
            displayImageUrl = mainImage.url;
          }
        }
        
        return {
          ...product,
          ...priceData,
          mainImageUrl: displayImageUrl,
        };
      }));

      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          description: tenant.description,
          contactPhone: tenant.contactPhone,
          contactEmail: tenant.contactEmail,
          address: tenant.address,
          gisLink: (tenant as any).gisLink,
          workingHours: (tenant as any).workingHours,
          ogTitle: (tenant as any).ogTitle,
          ogDescription: (tenant as any).ogDescription,
          ogImageUrl: (tenant as any).ogImageUrl,
          catalogUsp: (tenant as any).catalogUsp,
          catalogTemplate: (tenant as any).catalogTemplate || "universal",
          showFavorites: (tenant as any).showFavorites,
          showQuickView: (tenant as any).showQuickView,
          showAiConsultant: (tenant as any).showAiConsultant,
          showFloatingWhatsApp: tenant.showFloatingWhatsApp,
        },
        products: productsWithPrices,
        categories: categories.filter(c => c.isActive),
        promotions: promotions.filter(p => p.isActive),
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка загрузки каталога" });
    }
  });

  // Get promo blocks for public catalog
  app.get("/api/catalog/:slug/promo-blocks", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      const blocks = await storage.getPromoBlocks(tenant.id);
      const activeBlocks = blocks.filter(b => b.isActive);
      
      res.json(activeBlocks);
    } catch (error) {
      res.status(500).json({ message: "Ошибка загрузки промо-блоков" });
    }
  });

  // Get single promo block for public catalog
  app.get("/api/catalog/:slug/promo/:promoId", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      const blocks = await storage.getPromoBlocks(tenant.id);
      const block = blocks.find(b => b.id === req.params.promoId && b.isActive);
      
      if (!block) {
        return res.status(404).json({ message: "Акция не найдена" });
      }
      
      res.json(block);
    } catch (error) {
      res.status(500).json({ message: "Ошибка загрузки акции" });
    }
  });

  // Track banner click
  app.post("/api/catalog/:slug/promo/:promoId/banner-click", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      await storage.incrementPromoBlockBannerClick(req.params.promoId, tenant.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка" });
    }
  });

  // Track CTA click
  app.post("/api/catalog/:slug/promo/:promoId/cta-click", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      await storage.incrementPromoBlockCtaClick(req.params.promoId, tenant.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка" });
    }
  });

  // Update promo block AI description
  app.put("/api/promo-blocks/:id/ai-description", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { aiDescription } = req.body;
      
      await storage.updatePromoBlockAiDescription(req.params.id, user.tenantId, aiDescription);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка сохранения описания" });
    }
  });

  // Get single product for public catalog with computed price
  app.get("/api/catalog/:slug/product/:productId", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      const product = await storage.getProduct(req.params.productId, tenant.id);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: "Товар не найден" });
      }

      const categories = await storage.getCategories(tenant.id);
      const discounts = await storage.getDiscounts(tenant.id);
      const promotions = await storage.getPromotions(tenant.id);

      // Compute discounted price with priority: promotion > product discount > category discount
      const now = new Date();
      let computedPrice = parseFloat(product.price);
      let discountPercent: number | null = null;
      let discountType: string | null = null;
      let appliedPromotion: typeof promotions[0] | null = null;
      let appliedDiscount: typeof discounts[0] | null = null;

      // Check promotions first (highest priority)
      const activePromotions = promotions.filter(p => {
        if (!p.isActive) return false;
        if (p.startsAt && new Date(p.startsAt) > now) return false;
        if (p.endsAt && new Date(p.endsAt) < now) return false;
        const productMatches = p.productIds && (p.productIds as string[]).includes(product.id);
        const categoryMatches = p.categoryIds && product.categoryId && (p.categoryIds as string[]).includes(product.categoryId);
        return productMatches || categoryMatches;
      }).sort((a, b) => b.priority - a.priority);

      if (activePromotions.length > 0) {
        const promo = activePromotions[0];
        appliedPromotion = promo;
        if (promo.discountType === "percent" && promo.discountValue) {
          discountPercent = parseFloat(promo.discountValue);
          computedPrice = computedPrice * (1 - discountPercent / 100);
          discountType = "promotion";
        } else if (promo.discountType === "amount" && promo.discountValue) {
          computedPrice = Math.max(0, computedPrice - parseFloat(promo.discountValue));
          discountType = "promotion";
        }
      } else {
        // Check product-level discounts
        const productDiscounts = discounts.filter(d => {
          if (!d.isActive) return false;
          if (d.startsAt && new Date(d.startsAt) > now) return false;
          if (d.endsAt && new Date(d.endsAt) < now) return false;
          return d.scope === "product" && d.scopeId === product.id;
        }).sort((a, b) => b.priority - a.priority);

        if (productDiscounts.length > 0) {
          const disc = productDiscounts[0];
          appliedDiscount = disc;
          if (disc.type === "percent") {
            discountPercent = parseFloat(disc.value);
            computedPrice = computedPrice * (1 - discountPercent / 100);
            discountType = "product";
          } else if (disc.type === "amount") {
            computedPrice = Math.max(0, computedPrice - parseFloat(disc.value));
            discountType = "product";
          }
        } else if (product.categoryId) {
          // Check category-level discounts
          const categoryDiscounts = discounts.filter(d => {
            if (!d.isActive) return false;
            if (d.startsAt && new Date(d.startsAt) > now) return false;
            if (d.endsAt && new Date(d.endsAt) < now) return false;
            return d.scope === "category" && d.scopeId === product.categoryId;
          }).sort((a, b) => b.priority - a.priority);

          if (categoryDiscounts.length > 0) {
            const disc = categoryDiscounts[0];
            appliedDiscount = disc;
            if (disc.type === "percent") {
              discountPercent = parseFloat(disc.value);
              computedPrice = computedPrice * (1 - discountPercent / 100);
              discountType = "category";
            } else if (disc.type === "amount") {
              computedPrice = Math.max(0, computedPrice - parseFloat(disc.value));
              discountType = "category";
            }
          }
        }
      }

      const category = categories.find(c => c.id === product.categoryId);
      
      const images = await storage.getProductImages(product.id, tenant.id);
      const sortedImages = images.sort((a, b) => a.sortOrder - b.sortOrder);
      const mainImage = sortedImages.find(img => img.isMain) || sortedImages[0];
      const galleryUrls = sortedImages
        .filter(img => img.id !== mainImage?.id)
        .map(img => img.url);
      
      const mainImageUrl = mainImage?.url || product.mainImageUrl;
      const allGalleryUrls = [...galleryUrls, ...(product.galleryUrls || [])];

      await storage.logEvent({
        tenantId: tenant.id,
        eventType: "product_view",
        sessionId: req.sessionID,
        productId: product.id,
      });

      res.json({
        product: {
          ...product,
          mainImageUrl,
          galleryUrls: allGalleryUrls,
          computedPrice: computedPrice.toFixed(2),
          originalPrice: product.price,
          discountPercent,
          discountType,
          hasDiscount: discountType !== null,
        },
        category,
        promotion: appliedPromotion,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          contactPhone: tenant.contactPhone,
        },
      });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Ошибка загрузки товара" });
    }
  });

  // AI Chat for product consultation (public endpoint)
  app.post("/api/catalog/:slug/product/:productId/ai-chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Сообщение обязательно" });
      }

      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") {
        return res.status(404).json({ message: "Каталог не найден" });
      }

      const product = await storage.getProduct(req.params.productId, tenant.id);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: "Товар не найден" });
      }

      const categories = await storage.getCategories(tenant.id);
      const category = categories.find(c => c.id === product.categoryId);

      // Import the OpenAI service
      const { generateAiResponse, isOpenAiConfigured } = await import("./services/openai");
      
      if (!isOpenAiConfigured()) {
        return res.status(503).json({ 
          message: "AI сервис временно недоступен",
          response: "Извините, AI-консультант временно недоступен. Пожалуйста, свяжитесь с нами по телефону или через WhatsApp."
        });
      }

      // Build product context for AI
      const productContext = {
        storeName: tenant.name,
        slug: tenant.slug,
        customDomain: (tenant as any)?.customDomain || undefined,
        storeDescription: tenant.description || undefined,
        contactPhone: tenant.contactPhone || undefined,
        products: [{
          name: product.name,
          price: parseFloat(product.price),
          description: product.description || undefined,
          category: category?.name,
        }],
        policies: {
          answerOnlyFromData: true,
          neverInventPrices: true,
        },
      };

      const { CATALOG_TEMPLATES } = await import("../shared/templateRegistry");
      const templateType = ((tenant as any).catalogTemplate || "universal") as keyof typeof CATALOG_TEMPLATES;
      const template = CATALOG_TEMPLATES[templateType] || CATALOG_TEMPLATES.universal;
      const aiRoleName = template.aiRole.roleName;
      const aiBasePrompt = (tenant as any).aiSystemPrompt || template.aiRole.defaultPrompt;

      const systemContext = `${aiBasePrompt}

Ты — ${aiRoleName} по товару "${product.name}" в магазине "${tenant.name}".

ИНФОРМАЦИЯ О ТОВАРЕ:
- Название: ${product.name}
- Цена: ${parseFloat(product.price).toLocaleString()} ₸
${product.description ? `- Описание: ${product.description}` : ''}
${category ? `- Категория: ${category.name}` : ''}
${product.sku ? `- Артикул: ${product.sku}` : ''}

ПРАВИЛА:
1. Отвечай только на вопросы об этом конкретном товаре
2. Будь дружелюбен и профессионален
3. Если не знаешь ответа — честно скажи об этом
4. Отвечай кратко, максимум 2-3 предложения
5. Отвечай на том же языке, на котором задан вопрос`;

      const result = await generateAiResponse(
        message,
        [{ role: "system", content: systemContext }],
        productContext
      );

      res.json({ response: result.content });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ 
        message: "Ошибка AI сервиса",
        response: "Извините, произошла ошибка. Попробуйте ещё раз."
      });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ошибка валидации" });
      }

      const { tenantSlug, items, ...orderData } = req.body;
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({ message: "Магазин не найден" });
      }

      let subtotal = 0;
      const orderItems: Array<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        unitPrice: string;
        total: string;
      }> = [];
      const orderProducts: Array<{id: string; name: string; price: string; sku: string}> = [];

      for (const item of items) {
        const product = await storage.getProduct(item.productId, tenant.id);
        if (!product) continue;
        
        const itemTotal = parseFloat(product.price) * item.quantity;
        subtotal += itemTotal;
        
        orderItems.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          unitPrice: product.price,
          total: itemTotal.toFixed(2),
        });
        orderProducts.push({ id: product.id, name: product.name, price: product.price, sku: product.sku });
      }

      const order = await storage.createOrder(
        {
          tenantId: tenant.id,
          orderNumber: generateOrderNumber(),
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          customerEmail: orderData.customerEmail || null,
          deliveryAddress: orderData.deliveryAddress || null,
          comment: orderData.comment || null,
          subtotal: subtotal.toFixed(2),
          discountTotal: "0",
          total: subtotal.toFixed(2),
          status: "new",
          whatsappSent: false,
          templateType: (tenant as any).catalogTemplate || "universal",
        },
        orderItems.map(item => ({
          orderId: "",
          ...item,
        }))
      );

      await storage.logEvent({
        tenantId: tenant.id,
        eventType: "order_created",
        sessionId: req.sessionID,
        orderId: order.id,
      });

      // Send Telegram notification for new order
      if (tenant.telegramBotToken && tenant.telegramChatId) {
        const { sendTelegramMessage, formatNewOrderNotification } = await import("./services/telegram");
        const message = formatNewOrderNotification({
          orderNumber: order.orderNumber,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          total: subtotal.toFixed(2),
          itemsCount: orderItems.length,
        });
        sendTelegramMessage({
          botToken: tenant.telegramBotToken,
          chatId: tenant.telegramChatId,
          message,
        }).catch(err => console.error("Failed to send Telegram notification:", err));
      }

      // Create deal in connected CRM systems
      try {
        const { createCrmDeal } = await import("./services/crm");
        const createdOrderItems = await storage.getOrderItems(order.id);
        createCrmDeal(order, createdOrderItems, orderProducts).catch(err => 
          console.error("Failed to create CRM deal:", err)
        );
      } catch (crmErr) {
        console.error("CRM integration error:", crmErr);
      }

      // Auto-generate Kaspi payment invoice if enabled
      let paymentUrl: string | null = null;
      try {
        const kaspiIntegration = await storage.getKaspiIntegration(tenant.id);
        if (kaspiIntegration && kaspiIntegration.status === "connected" && kaspiIntegration.autoGenerateInvoice) {
          const { createPaymentForOrder } = await import("./services/payments");
          const paymentResult = await createPaymentForOrder({
            order,
            tenantId: tenant.id,
            source: "catalog",
          });
          if (paymentResult.success && paymentResult.paymentUrl) {
            paymentUrl = paymentResult.paymentUrl;
            console.log(`[Payment] Auto-generated Kaspi invoice for order ${order.orderNumber}: ${paymentUrl}`);
          }
        }
      } catch (paymentErr) {
        console.error("Auto-payment generation error:", paymentErr);
      }

      res.json({ 
        orderId: order.id, 
        orderNumber: order.orderNumber,
        ownerWhatsAppPhone: tenant.notificationPhone || tenant.contactPhone || null,
        order: {
          ...order,
          items: orderItems,
        },
        catalogUrl: `${req.protocol}://${req.get('host')}/c/${tenantSlug}`,
        paymentUrl,
      });
    } catch (error) {
      console.error("Order error:", error);
      res.status(500).json({ message: "Ошибка создания заказа" });
    }
  });

  app.get("/api/admin/stats", requireSuperAdmin, async (req, res) => {
    try {
      const stats = await storage.getTenantStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статистики" });
    }
  });

  app.get("/api/admin/tenants", requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения тенантов" });
    }
  });

  app.patch("/api/admin/tenants/:id", requireSuperAdmin, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, req.body);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тенанта" });
    }
  });

  app.get("/api/admin/plans", requireSuperAdmin, async (req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения тарифов" });
    }
  });

  app.post("/api/admin/subscriptions/extend", requireSuperAdmin, async (req, res) => {
    try {
      const { tenantId, days, reason } = req.body;
      const subscription = await storage.getSubscription(tenantId);
      if (!subscription) {
        return res.status(404).json({ message: "Подписка не найдена" });
      }
      
      await storage.extendSubscription(subscription.id, days, reason, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка продления подписки" });
    }
  });

  // Change subscription plan
  const changePlanSchema = z.object({
    tenantId: z.string().uuid(),
    planId: z.string().uuid(),
  });

  app.post("/api/admin/subscriptions/change-plan", requireSuperAdmin, async (req, res) => {
    try {
      const parsed = changePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверные данные", errors: parsed.error.errors });
      }
      
      const { tenantId, planId } = parsed.data;
      
      // Verify plan exists
      const allPlans = await storage.getPlans();
      const targetPlan = allPlans.find(p => p.id === planId);
      if (!targetPlan) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      
      const subscription = await storage.getSubscription(tenantId);
      if (!subscription) {
        return res.status(404).json({ message: "Подписка не найдена" });
      }
      
      await storage.changeSubscriptionPlan(subscription.id, planId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка смены тарифа" });
    }
  });

  // Update plan (price, AI limit)
  const updatePlanSchema = z.object({
    price: z.number().min(0).optional(),
    aiMessagesLimit: z.number().int().min(0).optional(),
  });

  app.patch("/api/admin/plans/:id", requireSuperAdmin, async (req, res) => {
    try {
      const parsed = updatePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверные данные", errors: parsed.error.errors });
      }
      
      // Reject empty updates
      if (parsed.data.price === undefined && parsed.data.aiMessagesLimit === undefined) {
        return res.status(400).json({ message: "Нет данных для обновления" });
      }
      
      // Verify plan exists
      const allPlans = await storage.getPlans();
      const targetPlan = allPlans.find(p => p.id === req.params.id);
      if (!targetPlan) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      
      await storage.updatePlan(req.params.id, parsed.data);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тарифа" });
    }
  });

  // Get all users with details for admin
  app.get("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersWithDetails();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения пользователей" });
    }
  });

  // Get FREE users only
  app.get("/api/admin/users-free", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getFreeUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения бесплатных пользователей" });
    }
  });

  // Get leads from demo catalog
  app.get("/api/admin/leads", requireSuperAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения лидов" });
    }
  });

  // Update lead status
  const updateLeadStatusSchema = z.object({
    status: z.enum(["new", "contacted", "converted", "rejected"]),
  });

  app.patch("/api/admin/leads/:id", requireSuperAdmin, async (req, res) => {
    try {
      const parsed = updateLeadStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверный статус", errors: parsed.error.errors });
      }
      
      await storage.updateLeadStatus(req.params.id, parsed.data.status);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления статуса лида" });
    }
  });

  // ============ PLAN REQUESTS ============
  app.get("/api/admin/plan-requests", requireSuperAdmin, async (req, res) => {
    try {
      const requests = await storage.getPlanRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error getting plan requests:", error);
      res.status(500).json({ message: "Ошибка получения заявок на тариф" });
    }
  });

  const approvePlanRequestSchema = z.object({
    subscriptionId: z.string(),
    planId: z.string(),
    durationDays: z.number().min(1).max(365),
  });

  app.post("/api/admin/plan-requests/approve", requireSuperAdmin, async (req, res) => {
    try {
      const parsed = approvePlanRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверные данные", errors: parsed.error.errors });
      }

      const { subscriptionId, planId, durationDays } = parsed.data;
      await storage.approvePlanRequest(subscriptionId, planId, durationDays);
      res.json({ success: true });
    } catch (error) {
      console.error("Error approving plan request:", error);
      res.status(500).json({ message: "Ошибка одобрения заявки" });
    }
  });

  app.post("/api/admin/plan-requests/reject", requireSuperAdmin, async (req, res) => {
    try {
      const { subscriptionId } = req.body;
      if (!subscriptionId) {
        return res.status(400).json({ message: "subscriptionId обязателен" });
      }
      await storage.setRequestedPlan(subscriptionId, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting plan request:", error);
      res.status(500).json({ message: "Ошибка отклонения заявки" });
    }
  });

  // ============ PUBLIC EVENT TRACKING ============
  const ALLOWED_EVENT_TYPES = [
    'catalog_view', 'product_view', 'add_to_cart', 'remove_from_cart',
    'cart_view', 'checkout_start', 'order_created', 'whatsapp_open_clicked',
    'copy_order_text_clicked', 'promo_view', 'search'
  ];
  
  const eventRateLimit = new Map<string, number>();
  
  app.post("/api/events/track", async (req, res) => {
    try {
      const { tenantSlug, eventType, sessionId, visitorId, pagePath, referrer,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        objectType, objectId, productId, orderId, metadata } = req.body;
      
      if (!tenantSlug || !eventType) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
        return res.status(400).json({ message: "Invalid event type" });
      }
      
      // Simple rate limiting by sessionId
      const rateLimitKey = `${sessionId}-${eventType}`;
      const lastCall = eventRateLimit.get(rateLimitKey);
      const now = Date.now();
      if (lastCall && now - lastCall < 500) {
        return res.status(429).json({ message: "Too many requests" });
      }
      eventRateLimit.set(rateLimitKey, now);
      // Clean old entries every 1000 calls
      if (eventRateLimit.size > 1000) {
        const oneMinuteAgo = now - 60000;
        const entries = Array.from(eventRateLimit.entries());
        for (const entry of entries) {
          if (entry[1] < oneMinuteAgo) eventRateLimit.delete(entry[0]);
        }
      }
      
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      await storage.logEvent({
        tenantId: tenant.id,
        eventType,
        sessionId,
        visitorId,
        pagePath,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        objectType,
        objectId,
        productId,
        orderId,
        metadata,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Event tracking error:", error);
      res.status(500).json({ message: "Error tracking event" });
    }
  });
  
  // ============ CART SESSION MANAGEMENT ============
  app.post("/api/cart-session/update", async (req, res) => {
    try {
      const { tenantSlug, sessionId, visitorId, cartJson, totalEstimated, 
        checkoutPhone, lastStep, utmSource, utmMedium, utmCampaign } = req.body;
      
      if (!tenantSlug || !sessionId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      const session = await storage.upsertCartSession({
        tenantId: tenant.id,
        sessionId,
        visitorId,
        cartJson,
        totalEstimated: totalEstimated?.toString(),
        checkoutPhone,
        lastStep,
        utmSource,
        utmMedium,
        utmCampaign,
        status: 'active',
        firstSeenAt: new Date(),
        lastActivityAt: new Date(),
      });
      
      res.json({ success: true, sessionId: session.id });
    } catch (error) {
      console.error("Cart session error:", error);
      res.status(500).json({ message: "Error updating cart session" });
    }
  });
  
  app.post("/api/cart-session/convert", async (req, res) => {
    try {
      const { tenantSlug, sessionId, orderId } = req.body;
      
      if (!tenantSlug || !sessionId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      const existing = await storage.getCartSession(tenant.id, sessionId);
      if (existing) {
        await storage.updateCartSession(existing.id, tenant.id, {
          status: 'converted',
          orderId,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Cart conversion error:", error);
      res.status(500).json({ message: "Error converting cart" });
    }
  });
  
  // ============ ANALYTICS DASHBOARD ENDPOINTS ============
  app.get("/api/analytics/overview", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const overview = await storage.getAnalyticsOverview(req.user!.tenantId!, fromDate, toDate);
      
      // Calculate previous period for comparison
      const periodLength = toDate.getTime() - fromDate.getTime();
      const prevFrom = new Date(fromDate.getTime() - periodLength);
      const prevTo = new Date(fromDate.getTime());
      const prevOverview = await storage.getAnalyticsOverview(req.user!.tenantId!, prevFrom, prevTo);
      
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };
      
      res.json({
        current: overview,
        previous: prevOverview,
        changes: {
          visits: calculateChange(overview.visits, prevOverview.visits),
          uniqueVisitors: calculateChange(overview.uniqueVisitors, prevOverview.uniqueVisitors),
          ordersCreated: calculateChange(overview.ordersCreated, prevOverview.ordersCreated),
          revenue: calculateChange(overview.revenue, prevOverview.revenue),
          conversionRate: calculateChange(overview.conversionRate, prevOverview.conversionRate),
          abandonedCarts: calculateChange(overview.abandonedCarts, prevOverview.abandonedCarts),
        },
      });
    } catch (error) {
      console.error("Analytics overview error:", error);
      res.status(500).json({ message: "Ошибка получения обзора аналитики" });
    }
  });
  
  app.get("/api/analytics/funnel", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const overview = await storage.getAnalyticsOverview(req.user!.tenantId!, fromDate, toDate);
      
      const funnel = [
        { step: 'Посетители', count: overview.uniqueVisitors, conversionToNext: overview.uniqueVisitors > 0 ? (overview.addToCart / overview.uniqueVisitors * 100) : 0 },
        { step: 'Добавили в корзину', count: overview.addToCart, conversionToNext: overview.addToCart > 0 ? (overview.checkoutStarts / overview.addToCart * 100) : 0 },
        { step: 'Начали оформление', count: overview.checkoutStarts, conversionToNext: overview.checkoutStarts > 0 ? (overview.ordersCreated / overview.checkoutStarts * 100) : 0 },
        { step: 'Заказ создан', count: overview.ordersCreated, conversionToNext: overview.ordersCreated > 0 ? (overview.whatsappClicks / overview.ordersCreated * 100) : 0 },
        { step: 'Открыли WhatsApp', count: overview.whatsappClicks, conversionToNext: 100 },
      ];
      
      // Find bottleneck (biggest drop)
      let bottleneckIndex = 0;
      let biggestDrop = 100;
      for (let i = 0; i < funnel.length - 1; i++) {
        if (funnel[i].conversionToNext < biggestDrop && funnel[i].count > 0) {
          biggestDrop = funnel[i].conversionToNext;
          bottleneckIndex = i;
        }
      }
      
      // Generate recommendations based on funnel
      const recommendations: string[] = [];
      if (overview.uniqueVisitors > 10 && overview.cartConversion < 10) {
        recommendations.push("Низкая конверсия в корзину. Улучшите фото товаров, добавьте подробные описания, сделайте CTA-кнопки заметнее.");
      }
      if (overview.addToCart > 5 && overview.checkoutStarts < overview.addToCart * 0.3) {
        recommendations.push("Много брошенных корзин. Упростите процесс оформления, добавьте информацию о доставке и оплате.");
      }
      if (overview.ordersCreated > 3 && overview.whatsappConversion < 50) {
        recommendations.push("Клиенты не нажимают кнопку WhatsApp. Проверьте, заметна ли кнопка, или есть ли технические проблемы.");
      }
      
      res.json({ funnel, bottleneckIndex, recommendations });
    } catch (error) {
      console.error("Funnel analytics error:", error);
      res.status(500).json({ message: "Ошибка получения воронки" });
    }
  });
  
  app.get("/api/analytics/products", requireAuth, async (req, res) => {
    try {
      const { from, to, sortBy = 'revenue' } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const productStats = await storage.getProductAnalytics(req.user!.tenantId!, fromDate, toDate);
      
      // Sort by requested field
      const sorted = [...productStats].sort((a, b) => {
        switch (sortBy) {
          case 'views': return b.views - a.views;
          case 'addToCart': return b.addToCart - a.addToCart;
          case 'orders': return b.orders - a.orders;
          case 'conversion': return b.conversion - a.conversion;
          default: return b.revenue - a.revenue;
        }
      });
      
      res.json({
        products: sorted,
        totals: {
          views: productStats.reduce((sum, p) => sum + p.views, 0),
          addToCart: productStats.reduce((sum, p) => sum + p.addToCart, 0),
          orders: productStats.reduce((sum, p) => sum + p.orders, 0),
          revenue: productStats.reduce((sum, p) => sum + p.revenue, 0),
        },
      });
    } catch (error) {
      console.error("Product analytics error:", error);
      res.status(500).json({ message: "Ошибка получения аналитики товаров" });
    }
  });
  
  app.get("/api/analytics/orders", requireAuth, async (req, res) => {
    try {
      const { from, to, status } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const allOrders = await storage.getOrders(req.user!.tenantId!);
      const filtered = allOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        if (orderDate < fromDate || orderDate > toDate) return false;
        if (status && o.status !== status) return false;
        return true;
      });
      
      // Get event data for orders (utm sources, etc.)
      const events = await storage.getAnalyticsEvents(req.user!.tenantId!, fromDate, toDate);
      const orderEvents = events.filter(e => e.eventType === 'order_created');
      
      const ordersWithMeta = filtered.map(order => {
        const event = orderEvents.find(e => e.orderId === order.id);
        return {
          ...order,
          utmSource: event?.utmSource,
        };
      });
      
      res.json({
        orders: ordersWithMeta,
        summary: {
          total: filtered.length,
          revenue: filtered.reduce((sum, o) => sum + parseFloat(o.total), 0),
          avgCheck: filtered.length > 0 ? filtered.reduce((sum, o) => sum + parseFloat(o.total), 0) / filtered.length : 0,
          byStatus: {
            new: filtered.filter(o => o.status === 'new').length,
            processing: filtered.filter(o => o.status === 'processing').length,
            completed: filtered.filter(o => o.status === 'completed').length,
            cancelled: filtered.filter(o => o.status === 'cancelled').length,
          },
        },
      });
    } catch (error) {
      console.error("Orders analytics error:", error);
      res.status(500).json({ message: "Ошибка получения аналитики заказов" });
    }
  });
  
  app.get("/api/analytics/abandoned", requireAuth, async (req, res) => {
    try {
      const { from, to, hasPhone, minTotal } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const sessions = await storage.getCartSessions(req.user!.tenantId!, {
        status: 'abandoned',
        from: fromDate,
        to: toDate,
      });
      
      let filtered = sessions;
      if (hasPhone === 'true') {
        filtered = filtered.filter(s => s.checkoutPhone);
      }
      if (minTotal) {
        filtered = filtered.filter(s => parseFloat(s.totalEstimated || '0') >= parseFloat(minTotal as string));
      }
      
      res.json({
        sessions: filtered,
        summary: {
          total: filtered.length,
          withPhone: filtered.filter(s => s.checkoutPhone).length,
          totalValue: filtered.reduce((sum, s) => sum + parseFloat(s.totalEstimated || '0'), 0),
          byStatus: {
            new: filtered.filter(s => s.processedStatus === 'new').length,
            in_progress: filtered.filter(s => s.processedStatus === 'in_progress').length,
            processed: filtered.filter(s => s.processedStatus === 'processed').length,
          },
        },
      });
    } catch (error) {
      console.error("Abandoned carts error:", error);
      res.status(500).json({ message: "Ошибка получения брошенных корзин" });
    }
  });
  
  app.patch("/api/analytics/abandoned/:id", requireAuth, async (req, res) => {
    try {
      const { processedStatus, note } = req.body;
      const updated = await storage.updateCartSession(req.params.id, req.user!.tenantId!, {
        processedStatus,
        note,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления корзины" });
    }
  });
  
  // Store health check for dashboard
  app.get("/api/analytics/health", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      const tenant = await storage.getTenant(req.user!.tenantId!);
      const promotions = await storage.getPromotions(req.user!.tenantId!);
      
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const issues = {
        productsWithoutPhoto: products.filter(p => !p.mainImageUrl).length,
        productsWithoutDescription: products.filter(p => !p.description || p.description.length < 10).length,
        outOfStock: products.filter(p => (p.stockQty || 0) <= 0).length,
        expiringPromotions: promotions.filter(p => p.endsAt && new Date(p.endsAt) <= sevenDaysFromNow && new Date(p.endsAt) > now).length,
        noNotificationPhone: !tenant?.notificationPhone,
        noWhatsApp: !tenant?.contactPhone,
      };
      
      res.json(issues);
    } catch (error) {
      res.status(500).json({ message: "Ошибка проверки здоровья магазина" });
    }
  });

  // ============ AI API ROUTES ============
  
  // Get AI access status (available even without AI access for paywall check)
  app.get("/api/ai/status", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const subscription = await storage.getSubscription(tenantId);
      const hasAiAccess = subscription?.plan?.hasAiAccess || false;
      
      if (!hasAiAccess) {
        return res.json({ 
          hasAccess: false,
          planName: subscription?.plan?.name || "Нет подписки",
          upgradeRequired: true
        });
      }

      const settings = await storage.getOrCreateAiSettings(tenantId);
      const readiness = await storage.getAiReadinessStatus(tenantId);
      
      res.json({
        hasAccess: true,
        enabled: settings.enabled,
        readiness,
        planName: subscription?.plan?.name,
        aiMessagesLimit: subscription?.plan?.aiMessagesLimit || 0,
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статуса AI" });
    }
  });

  // AI Settings
  app.get("/api/ai/settings", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const settings = await storage.getOrCreateAiSettings(req.user!.tenantId!);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения настроек" });
    }
  });

  app.put("/api/ai/settings", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { enabled, aiLanguages, aiSystemPrompt, aiTypingDelay, ...rest } = req.body;
      
      // Update AI settings table
      await storage.getOrCreateAiSettings(tenantId);
      const settings = await storage.updateAiSettings(tenantId, { enabled, ...rest });
      
      // Update tenant AI fields if provided
      const tenantUpdate: any = {};
      if (enabled !== undefined) tenantUpdate.aiEnabled = enabled;
      if (aiLanguages !== undefined) tenantUpdate.aiLanguages = aiLanguages;
      if (aiSystemPrompt !== undefined) tenantUpdate.aiSystemPrompt = aiSystemPrompt;
      if (aiTypingDelay !== undefined) tenantUpdate.aiTypingDelay = aiTypingDelay;
      
      if (Object.keys(tenantUpdate).length > 0) {
        await storage.updateTenant(tenantId, tenantUpdate);
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating AI settings:", error);
      res.status(500).json({ message: "Ошибка сохранения настроек" });
    }
  });

  // AI Sales Scripts
  app.get("/api/ai/sales-scripts", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const scripts = await storage.getAiSalesScripts(req.user!.tenantId!);
      res.json(scripts);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения скриптов" });
    }
  });

  app.post("/api/ai/sales-scripts", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const script = await storage.createAiSalesScript({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(script);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания скрипта" });
    }
  });

  app.post("/api/ai/sales-scripts/:id/activate", requireAuth, requireAiAccess, async (req, res) => {
    try {
      await storage.setActiveAiSalesScript(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка активации скрипта" });
    }
  });

  // AI Tag Rules
  app.get("/api/ai/tags", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.ensureDefaultTags(tenantId);
      const tags = await storage.getAiTagRules(tenantId);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения тегов" });
    }
  });

  app.post("/api/ai/tags", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tag = await storage.createAiTagRule({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(tag);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания тега" });
    }
  });

  app.put("/api/ai/tags/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tag = await storage.updateAiTagRule(req.params.id, req.user!.tenantId!, req.body);
      res.json(tag);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тега" });
    }
  });

  app.delete("/api/ai/tags/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      await storage.deleteAiTagRule(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления тега" });
    }
  });

  // AI Knowledge Articles
  app.get("/api/ai/knowledge", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const articles = await storage.getAiKnowledgeArticles(req.user!.tenantId!);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статей" });
    }
  });

  app.post("/api/ai/knowledge", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const article = await storage.createAiKnowledgeArticle({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(article);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания статьи" });
    }
  });

  app.put("/api/ai/knowledge/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const article = await storage.updateAiKnowledgeArticle(req.params.id, req.user!.tenantId!, req.body);
      res.json(article);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления статьи" });
    }
  });

  app.delete("/api/ai/knowledge/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      await storage.deleteAiKnowledgeArticle(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления статьи" });
    }
  });

  // AI FAQ
  app.get("/api/ai/faq", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const items = await storage.getAiFaqItems(req.user!.tenantId!);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения FAQ" });
    }
  });

  app.post("/api/ai/faq", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const item = await storage.createAiFaqItem({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания FAQ" });
    }
  });

  app.put("/api/ai/faq/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const item = await storage.updateAiFaqItem(req.params.id, req.user!.tenantId!, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления FAQ" });
    }
  });

  app.delete("/api/ai/faq/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      await storage.deleteAiFaqItem(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления FAQ" });
    }
  });

  // AI Policies
  app.get("/api/ai/policies", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const policies = await storage.getOrCreateAiPolicies(req.user!.tenantId!);
      res.json(policies);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения политик" });
    }
  });

  app.put("/api/ai/policies", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.getOrCreateAiPolicies(tenantId);
      const policies = await storage.updateAiPolicies(tenantId, req.body);
      res.json(policies);
    } catch (error) {
      res.status(500).json({ message: "Ошибка сохранения политик" });
    }
  });

  // AI Inbox Tickets
  app.get("/api/ai/inbox", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const tickets = await storage.getAiInboxTickets(req.user!.tenantId!, status);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения тикетов" });
    }
  });

  app.post("/api/ai/inbox", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const ticket = await storage.createAiInboxTicket({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания тикета" });
    }
  });

  app.put("/api/ai/inbox/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const ticket = await storage.updateAiInboxTicket(req.params.id, req.user!.tenantId!, req.body);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тикета" });
    }
  });

  // AI Conversations (Sandbox)
  app.get("/api/ai/conversations", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const conversations = await storage.getAiConversations(req.user!.tenantId!);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения диалогов" });
    }
  });

  app.post("/api/ai/conversations", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const conversation = await storage.createAiConversation({
        tenantId: req.user!.tenantId!,
        channel: "sandbox",
        sessionId: `sandbox-${Date.now()}`,
      });
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания диалога" });
    }
  });

  app.get("/api/ai/conversations/:id/messages", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const messages = await storage.getAiMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения сообщений" });
    }
  });

  app.post("/api/ai/conversations/:id/messages", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const { generateAiResponse, isOpenAiConfigured } = await import("./services/openai");
      
      const message = await storage.createAiMessage({
        conversationId: req.params.id,
        role: req.body.role || "user",
        content: req.body.content,
      });

      // Generate AI response for user messages
      if (req.body.role === "user") {
        let aiContent: string;
        let matchedTag: string | undefined;
        
        const tenantId = req.user!.tenantId!;
        
        // First, check for saved corrections
        const matchedCorrection = await storage.findMatchingCorrection(tenantId, req.body.content);
        if (matchedCorrection) {
          aiContent = matchedCorrection.correctedResponse;
          matchedTag = "correction_used";
        } else if (isOpenAiConfigured()) {
          // Get conversation history for context
          const allMessages = await storage.getAiMessages(req.params.id);
          const history = allMessages.slice(-10).map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
          
          // Get all context data in parallel
          const [tenant, products, aiSettings, salesScripts, tagRules, faqItems, knowledge, policies, promotions, discounts, kaspiIntegration] = await Promise.all([
            storage.getTenant(tenantId),
            storage.getProducts(tenantId),
            storage.getAiSettings(tenantId),
            storage.getAiSalesScripts(tenantId),
            storage.getAiTagRules(tenantId),
            storage.getAiFaqItems(tenantId),
            storage.getAiKnowledgeArticles(tenantId),
            storage.getAiPolicies(tenantId),
            storage.getPromotions(tenantId),
            storage.getDiscounts(tenantId),
            storage.getKaspiIntegration(tenantId),
          ]);
          
          // Get active sales script
          const activeScript = salesScripts.find(s => s.isActive);
          
          // Get enabled tag rules
          const enabledTags = tagRules.filter(t => t.isEnabled);
          
          // Get categories for products
          const categories = await storage.getCategories(tenantId);
          const categoryMap = new Map(categories.map(c => [c.id, c.name]));
          
          // Build full context for AI
          const context = {
            storeName: tenant?.name || "Магазин",
            slug: tenant?.slug || "catalog",
            customDomain: (tenant as any)?.customDomain || undefined,
            storeDescription: tenant?.description || undefined,
            tone: aiSettings?.tone || "friendly",
            products: products.slice(0, 20).map(p => ({
              name: p.name,
              price: Number(p.price),
              description: p.description || undefined,
              category: p.categoryId ? categoryMap.get(p.categoryId) : undefined,
            })),
            salesScript: activeScript ? {
              stages: activeScript.stagesJson || [],
              forbiddenPhrases: activeScript.forbiddenPhrasesJson || [],
            } : undefined,
            tagRules: enabledTags.map(t => ({
              tag: t.tag,
              displayName: t.displayName,
              keywords: t.keywordsJson || [],
              action: t.action,
              responseTemplate: t.responseTemplate || undefined,
            })),
            faq: faqItems.filter(f => f.isPublished).map(f => ({
              question: f.question,
              answer: f.answer,
            })),
            knowledge: knowledge.filter(k => k.isPublished).map(k => ({
              title: k.title,
              content: k.content,
            })),
            policies: policies ? {
              answerOnlyFromData: policies.answerOnlyFromData,
              offerHandoffIfNoAnswer: policies.offerHandoffIfNoAnswer,
              neverInventPrices: policies.neverInventPrices,
              followSalesScript: policies.followSalesScript,
              boundariesText: policies.boundariesText || undefined,
            } : undefined,
            promotions: promotions.filter(p => p.isActive).map(p => ({
              name: p.title,
              description: p.description || undefined,
              discountPercent: p.discountType === 'percent' && p.discountValue ? Number(p.discountValue) : undefined,
              discountAmount: p.discountType === 'amount' && p.discountValue ? Number(p.discountValue) : undefined,
              startDate: p.startsAt || undefined,
              endDate: p.endsAt || undefined,
            })),
            discounts: discounts.filter(d => d.isActive).map(d => ({
              name: d.name,
              type: d.type,
              value: Number(d.value),
              scope: d.scope,
              categoryName: d.scope === 'category' && d.scopeId ? categoryMap.get(d.scopeId) : undefined,
              productName: d.scope === 'product' && d.scopeId ? products.find(p => p.id === d.scopeId)?.name : undefined,
            })),
            contactPhone: tenant?.contactPhone || undefined,
            aiLanguages: (tenant as any).aiLanguages || ["ru"],
            aiSystemPrompt: (tenant as any).aiSystemPrompt || undefined,
            paymentOptions: kaspiIntegration && kaspiIntegration.status === "connected" ? {
              kaspiEnabled: true,
              autoInvoice: kaspiIntegration.autoGenerateInvoice || false,
              kaspiPayLink: kaspiIntegration.kaspiPayLink || undefined,
            } : undefined,
          };
          
          try {
            const result = await generateAiResponse(req.body.content, history, context);
            aiContent = result.content;
            matchedTag = result.matchedTag;
          } catch (error) {
            console.error("AI generation error:", error);
            aiContent = "Извините, произошла ошибка. Пожалуйста, попробуйте позже.";
          }
        } else {
          aiContent = "AI-ассистент временно недоступен. Пожалуйста, попробуйте позже.";
        }
        
        const aiResponse = await storage.createAiMessage({
          conversationId: req.params.id,
          role: "assistant",
          content: aiContent,
          tagMatched: matchedTag,
        });
        return res.json([message, aiResponse]);
      }

      res.json(message);
    } catch (error) {
      console.error("Message creation error:", error);
      res.status(500).json({ message: "Ошибка отправки сообщения" });
    }
  });

  // Update AI message content (with tenant ownership verification)
  app.patch("/api/ai/messages/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Контент обязателен" });
      }
      const updated = await storage.updateAiMessageSecure(req.params.id, req.user!.tenantId!, { content: content.trim() });
      if (!updated) {
        return res.status(404).json({ message: "Сообщение не найдено" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({ message: "Ошибка обновления сообщения" });
    }
  });

  // Create AI response correction
  app.post("/api/ai/corrections", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const { userMessagePattern, originalResponse, correctedResponse } = req.body;
      if (!userMessagePattern || !originalResponse || !correctedResponse) {
        return res.status(400).json({ message: "Все поля обязательны" });
      }
      const correction = await storage.createAiResponseCorrection({
        tenantId: req.user!.tenantId!,
        userMessagePattern,
        originalResponse,
        correctedResponse,
      });
      res.json(correction);
    } catch (error) {
      console.error("Error creating correction:", error);
      res.status(500).json({ message: "Ошибка сохранения корректировки" });
    }
  });

  // Get AI response corrections
  app.get("/api/ai/corrections", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const corrections = await storage.getAiResponseCorrections(req.user!.tenantId!);
      res.json(corrections);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения корректировок" });
    }
  });

  // AI Analytics
  app.get("/api/ai/analytics", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date();
      
      const analytics = await storage.getAiAnalytics(req.user!.tenantId!, from, to);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения аналитики" });
    }
  });

  // ============ BUSINESS CONSULTANT ============
  const { chat: consultantChat, CONSULTANT_MODES, QUICK_TEMPLATES } = await import("./services/business-consultant/consultant.service");

  const consultantChatSchema = z.object({
    mode: z.enum(['analyst', 'marketer', 'rop', 'finance', 'support']),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })),
    userMessage: z.string().min(1).max(2000),
  });

  app.get("/api/consultant/modes", requireAuth, async (_req, res) => {
    res.json({
      modes: Object.values(CONSULTANT_MODES),
      quickTemplates: QUICK_TEMPLATES,
    });
  });

  app.post("/api/consultant/chat", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ message: "Доступ запрещён" });
      }

      const parsed = consultantChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Неверные данные", errors: parsed.error.errors });
      }

      const { mode, messages, userMessage } = parsed.data;
      const result = await consultantChat(tenantId, mode, messages, userMessage);

      res.json(result);
    } catch (error) {
      console.error("Business consultant error:", error);
      res.status(500).json({ message: "Ошибка консультанта" });
    }
  });

  // ============ SMART CONTACT (SAFE BULK MESSAGING) ============
  const { smartContactService, TRIGGER_TYPES } = await import("./services/smart-contact.service");

  // Validation schemas for Smart Contact
  const smartContactSettingsUpdateSchema = z.object({
    enabled: z.boolean().optional(),
    quietHoursStart: z.number().min(0).max(23).optional(),
    quietHoursEnd: z.number().min(0).max(23).optional(),
    maxFollowUpsPerClient: z.number().min(1).max(10).optional(),
    minHoursBetweenMessages: z.number().min(1).max(168).optional(),
    dailyMessageLimit: z.number().min(10).max(1000).optional(),
    autoStopOnNegativeSignals: z.boolean().optional()
  });

  const smartContactMessageSchema = z.object({
    contactId: z.string().min(1),
    triggerType: z.enum(['abandoned_cart', 'unpaid_order', 'reactivation', 'inactivity', 'manual']),
    messageText: z.string().min(1).max(1000),
    scheduledAt: z.string().datetime().optional().nullable()
  });

  const smartContactBatchSchema = z.object({
    triggerType: z.enum(['abandoned_cart', 'unpaid_order', 'reactivation', 'inactivity', 'manual']),
    maxMessages: z.number().min(1).max(100).default(10)
  });

  const smartContactGenerateSchema = z.object({
    triggerType: z.enum(['abandoned_cart', 'unpaid_order', 'reactivation', 'inactivity', 'manual']),
    context: z.object({
      clientName: z.string().optional(),
      productName: z.string().optional(),
      orderNumber: z.string().optional(),
      lastInteraction: z.string().optional()
    }).optional()
  });

  // Get Smart Contact settings
  app.get("/api/smart-contact/settings", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const settings = await smartContactService.getSettings(req.user!.tenantId!);
      res.json(settings || {
        enabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 9,
        maxFollowUpsPerClient: 3,
        minHoursBetweenMessages: 24,
        dailyMessageLimit: 100,
        autoStopOnNegativeSignals: true
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения настроек" });
    }
  });

  // Update Smart Contact settings
  app.put("/api/smart-contact/settings", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const validated = smartContactSettingsUpdateSchema.parse(req.body);
      const settings = await smartContactService.updateSettings(req.user!.tenantId!, validated);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      res.status(500).json({ message: "Ошибка сохранения настроек" });
    }
  });

  // Get Smart Contact stats
  app.get("/api/smart-contact/stats", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const stats = await smartContactService.getStats(req.user!.tenantId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статистики" });
    }
  });

  // Get contacts list
  app.get("/api/smart-contact/contacts", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const contacts = await smartContactService.getContacts(req.user!.tenantId!, limit, offset);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения контактов" });
    }
  });

  // Get eligible contacts
  app.get("/api/smart-contact/contacts/eligible", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const contacts = await smartContactService.getEligibleContacts(req.user!.tenantId!);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения доступных контактов" });
    }
  });

  // Get messages history
  app.get("/api/smart-contact/messages", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await smartContactService.getMessages(req.user!.tenantId!, limit);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения сообщений" });
    }
  });

  // Get trigger types
  app.get("/api/smart-contact/triggers", requireAuth, requireAiAccess, async (_req, res) => {
    res.json(TRIGGER_TYPES);
  });

  // Generate AI message preview
  app.post("/api/smart-contact/generate-message", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const validated = smartContactGenerateSchema.parse(req.body);
      const message = await smartContactService.generateMessage(req.user!.tenantId!, validated.triggerType, validated.context || {});
      res.json({ message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      res.status(500).json({ message: "Ошибка генерации сообщения" });
    }
  });

  // Create and queue message
  app.post("/api/smart-contact/messages", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const validated = smartContactMessageSchema.parse(req.body);
      
      // Check if quiet hours
      const isQuiet = await smartContactService.isQuietHours(tenantId);
      if (isQuiet && !validated.scheduledAt) {
        return res.status(400).json({ message: "Сейчас тихие часы. Сообщение будет отправлено позже." });
      }
      
      // Check health status
      const health = await smartContactService.getHealthStatus(tenantId);
      if (health.status === 'stop') {
        return res.status(400).json({ message: health.message });
      }
      
      // Check daily limit
      if (health.sentToday >= health.dailyLimit) {
        return res.status(400).json({ message: "Достигнут дневной лимит сообщений" });
      }
      
      // Check contact eligibility (cooldown and max follow-ups)
      const canSend = await smartContactService.canSendToContact(tenantId, validated.contactId);
      if (!canSend.allowed) {
        return res.status(400).json({ message: canSend.reason });
      }
      
      const message = await smartContactService.createMessage({
        tenantId,
        contactId: validated.contactId,
        triggerType: validated.triggerType,
        messageText: validated.messageText,
        status: 'pending',
        scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : null
      });
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      res.status(500).json({ message: "Ошибка создания сообщения" });
    }
  });

  // Send message now (via WAHA)
  app.post("/api/smart-contact/messages/:id/send", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const messageId = req.params.id;
      
      // Get tenant WAHA settings
      const tenant = await storage.getTenant(tenantId);
      if (!tenant?.wahaBaseUrl || !tenant?.wahaInstanceName) {
        return res.status(400).json({ message: "WhatsApp не настроен" });
      }
      
      // Get message and contact
      const messages = await smartContactService.getMessages(tenantId, 1000);
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        return res.status(404).json({ message: "Сообщение не найдено" });
      }
      
      const contacts = await smartContactService.getContacts(tenantId, 1000);
      const contact = contacts.find(c => c.id === message.contactId);
      if (!contact) {
        return res.status(404).json({ message: "Контакт не найден" });
      }
      
      const result = await smartContactService.sendViaWaha(
        tenantId,
        messageId,
        contact.phone,
        message.messageText,
        tenant.wahaBaseUrl,
        tenant.wahaInstanceName
      );
      
      if (result.success) {
        res.json({ success: true, wahaMessageId: result.wahaMessageId });
      } else {
        res.status(500).json({ message: result.error });
      }
    } catch (error) {
      res.status(500).json({ message: "Ошибка отправки сообщения" });
    }
  });

  // Batch send to eligible contacts
  app.post("/api/smart-contact/batch-send", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const validated = smartContactBatchSchema.parse(req.body);
      
      // Get settings and check if enabled
      const settings = await smartContactService.getSettings(tenantId);
      if (!settings?.enabled) {
        return res.status(400).json({ message: "Модуль отключён" });
      }
      
      // Check quiet hours
      const isQuiet = await smartContactService.isQuietHours(tenantId);
      if (isQuiet) {
        return res.status(400).json({ message: "Сейчас тихие часы" });
      }
      
      // Check health
      const health = await smartContactService.getHealthStatus(tenantId);
      if (health.status === 'stop') {
        return res.status(400).json({ message: health.message });
      }
      
      // Check remaining daily quota
      const remainingQuota = Math.max(0, settings.dailyMessageLimit - health.sentToday);
      if (remainingQuota === 0) {
        return res.status(400).json({ message: "Достигнут дневной лимит сообщений" });
      }
      
      // Get eligible contacts (already filtered by cooldown)
      const eligibleContacts = await smartContactService.getEligibleContacts(
        tenantId, 
        settings.minHoursBetweenMessages
      );
      
      // Apply hard cap: min of requested, remaining quota, and 100 max per batch
      const batchSize = Math.min(validated.maxMessages, remainingQuota, 100);
      const contactsToMessage = eligibleContacts.slice(0, batchSize);
      
      // Create messages for each contact
      const createdMessages = [];
      for (const contact of contactsToMessage) {
        // Double-check eligibility (max follow-ups)
        const canSend = await smartContactService.canSendToContact(tenantId, contact.id);
        if (!canSend.allowed) continue;
        
        const messageText = await smartContactService.generateMessage(tenantId, validated.triggerType, {
          clientName: contact.name || undefined,
          lastInteraction: contact.lastClientReplyAt?.toISOString()
        });
        
        const message = await smartContactService.createMessage({
          tenantId,
          contactId: contact.id,
          triggerType: validated.triggerType,
          messageText,
          status: 'queued'
        });
        
        createdMessages.push(message);
      }
      
      res.json({ 
        queued: createdMessages.length,
        message: `Поставлено в очередь: ${createdMessages.length} сообщений`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      res.status(500).json({ message: "Ошибка создания рассылки" });
    }
  });

  // ============ WAHA INTEGRATION ============
  const { wahaService } = await import("./services/waha");

  // Get WAHA health status
  app.get("/api/waha/health", requireAuth, requireAiAccess, async (_req, res) => {
    try {
      const healthy = await wahaService.checkHealth();
      res.json({ healthy, baseUrl: process.env.WAHA_BASE_URL });
    } catch (error) {
      res.json({ healthy: false, error: (error as Error).message });
    }
  });

  // Get tenant's WAHA instances
  app.get("/api/waha/instances", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instances = await storage.getWahaInstances(req.user!.tenantId!);
      
      // Enrich with live status from WAHA server
      const enrichedInstances = await Promise.all(instances.map(async (instance) => {
        try {
          const session = await wahaService.getSession(instance.instanceName);
          return {
            ...instance,
            liveStatus: session.status,
            phoneNumber: session.me?.id?.replace("@c.us", "") || instance.phoneNumber,
          };
        } catch {
          return { ...instance, liveStatus: "unknown" };
        }
      }));
      
      res.json(enrichedInstances);
    } catch (error) {
      console.error("Error fetching WAHA instances:", error);
      res.status(500).json({ message: "Ошибка получения инстансов" });
    }
  });

  // Create new WAHA instance
  app.post("/api/waha/instances", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      // Check plan limits
      const subscription = await storage.getSubscription(tenantId);
      if (!subscription?.plan) {
        return res.status(403).json({ message: "Нет активной подписки" });
      }
      
      const currentCount = await storage.countWahaInstances(tenantId);
      if (currentCount >= subscription.plan.maxWahaInstances) {
        return res.status(403).json({ 
          message: `Достигнут лимит инстансов WhatsApp (${subscription.plan.maxWahaInstances})` 
        });
      }

      const instanceName = wahaService.generateInstanceName(tenantId);
      
      // Get webhook URL - use explicit env var, then REPLIT_DEV_DOMAIN, then derive from request
      let baseUrl = process.env.WAHA_WEBHOOK_BASE_URL;
      if (!baseUrl && process.env.REPLIT_DEV_DOMAIN) {
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      }
      if (!baseUrl) {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        if (host) {
          baseUrl = `${protocol}://${host}`;
        }
      }
      const webhookUrl = baseUrl ? `${baseUrl}/api/waha/webhook` : "";
      
      // Create session in WAHA
      await wahaService.createSession(instanceName, webhookUrl || undefined);
      
      // Start session
      await wahaService.startSession(instanceName);
      
      // Save to database
      const instance = await storage.createWahaInstance({
        tenantId,
        instanceName,
        status: "starting",
        webhookUrl: webhookUrl || null,
        isActive: true,
      });
      
      res.json(instance);
    } catch (error) {
      console.error("Error creating WAHA instance:", error);
      res.status(500).json({ message: (error as Error).message || "Ошибка создания инстанса" });
    }
  });

  // Get QR code for an instance
  app.get("/api/waha/instances/:id/qr", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      const qrCode = await wahaService.getQRCode(instance.instanceName);
      
      // Update stored QR
      if (qrCode) {
        await storage.updateWahaInstance(instance.id, req.user!.tenantId!, { 
          qrCode, 
          status: "scan_qr" 
        });
      }
      
      res.json({ qrCode, instanceName: instance.instanceName });
    } catch (error) {
      console.error("Error getting QR code:", error);
      res.status(500).json({ message: "Ошибка получения QR-кода" });
    }
  });

  // Get instance status
  app.get("/api/waha/instances/:id/status", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      const session = await wahaService.getSession(instance.instanceName);
      
      // Update local status based on WAHA response
      let newStatus = instance.status;
      if (session.status === "WORKING") {
        newStatus = "running";
        await storage.updateWahaInstance(instance.id, req.user!.tenantId!, { 
          status: "running",
          phoneNumber: session.me?.id?.replace("@c.us", "") || null,
          lastConnectedAt: new Date(),
        });
      } else if (session.status === "SCAN_QR_CODE") {
        newStatus = "scan_qr";
      } else if (session.status === "STOPPED") {
        newStatus = "stopped";
      } else if (session.status === "FAILED") {
        newStatus = "failed";
      }
      
      res.json({ 
        ...instance, 
        status: newStatus,
        wahaStatus: session.status,
        phoneNumber: session.me?.id?.replace("@c.us", "") || instance.phoneNumber,
      });
    } catch (error) {
      console.error("Error getting instance status:", error);
      res.status(500).json({ message: "Ошибка получения статуса" });
    }
  });

  // Stop instance
  app.post("/api/waha/instances/:id/stop", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      await wahaService.stopSession(instance.instanceName);
      await storage.updateWahaInstance(instance.id, req.user!.tenantId!, { status: "stopped" });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping instance:", error);
      res.status(500).json({ message: "Ошибка остановки инстанса" });
    }
  });

  // Start instance
  app.post("/api/waha/instances/:id/start", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      await wahaService.startSession(instance.instanceName);
      await storage.updateWahaInstance(instance.id, req.user!.tenantId!, { status: "starting" });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting instance:", error);
      res.status(500).json({ message: "Ошибка запуска инстанса" });
    }
  });

  // Sync webhook URL for instance
  app.post("/api/waha/instances/:id/sync-webhook", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      const currentDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
      if (!currentDomain) {
        return res.status(500).json({ message: "Не удалось определить домен приложения" });
      }
      
      const newWebhookUrl = `https://${currentDomain}/api/waha/webhook`;
      
      console.log(`[WAHA] Syncing webhook for ${instance.instanceName}: ${newWebhookUrl}`);
      
      await wahaService.updateSessionWebhook(instance.instanceName, newWebhookUrl);
      await storage.updateWahaInstance(instance.id, req.user!.tenantId!, { webhookUrl: newWebhookUrl });
      
      res.json({ success: true, webhookUrl: newWebhookUrl });
    } catch (error) {
      console.error("Error syncing webhook:", error);
      res.status(500).json({ message: "Ошибка синхронизации webhook: " + (error as Error).message });
    }
  });

  // Delete instance
  app.delete("/api/waha/instances/:id", requireAuth, requireAiAccess, async (req, res) => {
    try {
      const instance = await storage.getWahaInstance(req.params.id, req.user!.tenantId!);
      if (!instance) {
        return res.status(404).json({ message: "Инстанс не найден" });
      }
      
      // Delete from WAHA
      try {
        await wahaService.deleteSession(instance.instanceName);
      } catch (e) {
        // Session might already be deleted
        console.log("Session might already be deleted:", e);
      }
      
      // Delete from database
      await storage.deleteWahaInstance(instance.id, req.user!.tenantId!);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting instance:", error);
      res.status(500).json({ message: "Ошибка удаления инстанса" });
    }
  });

  // WAHA Webhook endpoint (for receiving messages)
  app.post("/api/waha/webhook", async (req, res) => {
    try {
      const { event, session, payload } = req.body;
      console.log("[WAHA Webhook] Received:", JSON.stringify({ event, session, payloadKeys: Object.keys(payload || {}), from: payload?.from, body: payload?.body?.substring?.(0, 50) }));
      
      // Find instance by session name
      const instance = await storage.getWahaInstanceByName(session);
      if (!instance) {
        console.log("[WAHA] Unknown session:", session);
        return res.json({ ok: true });
      }
      
      // Handle different event types
      if (event === "session.status") {
        const status = payload?.status;
        let newStatus = instance.status;
        
        if (status === "WORKING") {
          newStatus = "running";
        } else if (status === "SCAN_QR_CODE") {
          newStatus = "scan_qr";
        } else if (status === "STOPPED") {
          newStatus = "stopped";
        } else if (status === "FAILED") {
          newStatus = "failed";
        }
        
        await storage.updateWahaInstance(instance.id, instance.tenantId, { status: newStatus });
      }
      
      // Handle incoming messages (only process "message" event to avoid duplicates, 
      // WAHA sends both "message" and "message.any" for the same message)
      if (event === "message") {
        const from = payload?.from;
        const text = payload?.body;
        const fromMe = payload?.fromMe;
        
        // Only process incoming messages (not our own)
        if (from && text && !fromMe) {
          console.log(`[WAHA] Message from ${from}: ${text}`);
          
          // Process message async to not block webhook response
          processIncomingWhatsAppMessage(instance, from, text).catch(err => {
            console.error("[WAHA] Error processing message:", err);
          });
        }
      }
      
      res.json({ ok: true });
    } catch (error) {
      console.error("[WAHA] Webhook error:", error);
      res.json({ ok: true }); // Always return 200 to WAHA
    }
  });

  // Process incoming WhatsApp message with AI
  async function processIncomingWhatsAppMessage(instance: any, from: string, text: string) {
    const { generateAiResponse, isOpenAiConfigured } = await import("./services/openai");
    
    const tenantId = instance.tenantId;
    
    // Check if tenant has AI enabled
    const tenant = await storage.getTenant(tenantId);
    if (!tenant || !tenant.aiEnabled) {
      console.log(`[WAHA] AI disabled for tenant ${tenantId}`);
      return;
    }
    
    // Check if OpenAI is configured
    if (!isOpenAiConfigured()) {
      console.error("[WAHA] OpenAI not configured");
      return;
    }
    
    // Normalize phone number (remove @c.us suffix if present)
    const customerPhone = from.replace("@c.us", "").replace("@s.whatsapp.net", "");
    
    // Find or create conversation
    let conversation = await storage.getAiConversationByPhone(tenantId, customerPhone, "whatsapp");
    
    if (!conversation) {
      conversation = await storage.createAiConversation({
        tenantId,
        channel: "whatsapp",
        customerPhone,
        status: "open",
      });
      console.log(`[WAHA] Created new conversation ${conversation.id} for ${customerPhone}`);
    }
    
    // Save user message
    await storage.createAiMessage({
      conversationId: conversation.id,
      role: "user",
      content: text,
    });
    
    // Get conversation history
    const messages = await storage.getAiMessages(conversation.id);
    const conversationHistory = messages.slice(-10).map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));
    
    // Build AI context
    const products = await storage.getProducts(tenantId);
    const categories = await storage.getCategories(tenantId);
    const promotions = await storage.getPromotions(tenantId);
    const discounts = await storage.getDiscounts(tenantId);
    const policies = await storage.getAiPolicies(tenantId);
    const tagRules = await storage.getAiTagRules(tenantId);
    const faqItems = await storage.getAiFaqItems(tenantId);
    const knowledgeArticles = await storage.getAiKnowledgeArticles(tenantId);
    const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
    
    // Build category map
    const categoryMap = new Map<string, string>();
    categories.forEach(c => categoryMap.set(c.id, c.name));
    
    const context = {
      storeName: tenant.name,
      slug: tenant.slug,
      customDomain: (tenant as any)?.customDomain || undefined,
      storeDescription: tenant.description || undefined,
      contactPhone: tenant.contactPhone || undefined,
      products: products.slice(0, 50).map(p => ({
        name: p.name,
        price: Number(p.price),
        description: p.description || undefined,
        category: p.categoryId ? categoryMap.get(p.categoryId) : undefined,
      })),
      promotions: promotions.filter(p => p.isActive).map(p => ({
        name: p.title,
        description: p.description || undefined,
        discountPercent: p.discountType === "percent" && p.discountValue ? Number(p.discountValue) : undefined,
        discountAmount: p.discountType === "amount" && p.discountValue ? Number(p.discountValue) : undefined,
        startDate: p.startsAt || undefined,
        endDate: p.endsAt || undefined,
      })),
      discounts: discounts.filter(d => d.isActive).map(d => ({
        name: d.name,
        type: d.type,
        value: Number(d.value),
        scope: d.scope,
        categoryName: d.scope === "category" && d.scopeId ? categoryMap.get(d.scopeId) : undefined,
        productName: undefined,
      })),
      policies: policies ? {
        answerOnlyFromData: policies.answerOnlyFromData || undefined,
        offerHandoffIfNoAnswer: policies.offerHandoffIfNoAnswer || undefined,
        neverInventPrices: policies.neverInventPrices || undefined,
        followSalesScript: policies.followSalesScript || undefined,
        boundariesText: policies.boundariesText || undefined,
      } : undefined,
      tagRules: tagRules.map(r => ({
        tag: r.tag,
        displayName: r.displayName,
        keywords: r.keywordsJson || [],
        action: r.action,
        responseTemplate: r.responseTemplate || undefined,
      })),
      faq: faqItems.map(f => ({
        question: f.question,
        answer: f.answer,
      })),
      knowledge: knowledgeArticles.map((k: { title: string; content: string }) => ({
        title: k.title,
        content: k.content,
      })),
      currentStage: conversation.currentStage || undefined,
      aiLanguages: (tenant as any).aiLanguages || ["ru"],
      aiSystemPrompt: (tenant as any).aiSystemPrompt || undefined,
      paymentOptions: kaspiIntegration && kaspiIntegration.status === "connected" ? {
        kaspiEnabled: true,
        autoInvoice: kaspiIntegration.autoGenerateInvoice || false,
        kaspiPayLink: kaspiIntegration.kaspiPayLink || undefined,
      } : undefined,
    };
    
    try {
      // Generate AI response
      const aiResult = await generateAiResponse(text, conversationHistory, context);
      
      console.log(`[WAHA] AI response: ${aiResult.content.substring(0, 100)}...`);
      
      // Save assistant message
      await storage.createAiMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: aiResult.content,
        tagMatched: aiResult.matchedTag || null,
      });
      
      // Update conversation stage if suggested
      if (aiResult.suggestedStage) {
        await storage.updateAiConversation(conversation.id, {
          currentStage: aiResult.suggestedStage,
        });
      }
      
      // Handle handoff action
      if (aiResult.action === "handoff") {
        await storage.updateAiConversation(conversation.id, {
          status: "handoff",
        });
        // Create intervention event
        await storage.createAiInterventionEvent({
          tenantId,
          conversationId: conversation.id,
          type: "handoff_requested",
          note: `Клиент ${customerPhone} запросил менеджера`,
        });
        
        // Send Telegram notification for handoff request
        if (tenant.telegramBotToken && tenant.telegramChatId) {
          const { sendTelegramMessage, formatHumanRequestNotification } = await import("./services/telegram");
          const message = formatHumanRequestNotification({
            customerPhone,
            message: text,
          });
          sendTelegramMessage({
            botToken: tenant.telegramBotToken,
            chatId: tenant.telegramChatId,
            message,
          }).catch(err => console.error("Failed to send Telegram handoff notification:", err));
        }
      }
      
      // Handle AI unknown answer notification
      if (aiResult.action === "unknown_answer" || aiResult.matchedTag === "unknown") {
        if (tenant.telegramBotToken && tenant.telegramChatId) {
          const { sendTelegramMessage, formatAiUnknownNotification } = await import("./services/telegram");
          const message = formatAiUnknownNotification({
            customerPhone,
            question: text,
          });
          sendTelegramMessage({
            botToken: tenant.telegramBotToken,
            chatId: tenant.telegramChatId,
            message,
          }).catch(err => console.error("Failed to send Telegram unknown notification:", err));
        }
      }
      
      // Apply typing delay after AI generation (simulates human typing)
      const typingDelay = (tenant as any).aiTypingDelay || 0;
      if (typingDelay > 0) {
        console.log(`[WAHA] Simulating typing for ${typingDelay}s...`);
        await new Promise(resolve => setTimeout(resolve, typingDelay * 1000));
      }
      
      // Send response via WAHA
      const chatId = from.includes("@") ? from : `${from}@c.us`;
      await wahaService.sendTextMessage(instance.instanceName, chatId, aiResult.content);
      
      console.log(`[WAHA] Sent response to ${chatId}`);
      
    } catch (error) {
      console.error("[WAHA] Error generating/sending AI response:", error);
      
      // Try to send fallback message
      try {
        const chatId = from.includes("@") ? from : `${from}@c.us`;
        await wahaService.sendTextMessage(
          instance.instanceName, 
          chatId, 
          "Извините, произошла ошибка. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую."
        );
      } catch (sendError) {
        console.error("[WAHA] Error sending fallback message:", sendError);
      }
    }
  }

  // ============ TENANT LINKS (Link-in-Bio) ============
  app.get("/api/links", requireAuth, async (req, res) => {
    try {
      const links = await storage.getTenantLinks(req.user!.tenantId!);
      res.json(links);
    } catch (error) {
      console.error("Error getting links:", error);
      res.status(500).json({ message: "Ошибка получения ссылок" });
    }
  });

  app.post("/api/links", requireAuth, async (req, res) => {
    try {
      const { title, url, icon } = req.body;
      if (!title || !url) {
        return res.status(400).json({ message: "Название и URL обязательны" });
      }
      const link = await storage.createTenantLink({
        tenantId: req.user!.tenantId!,
        title,
        url,
        icon: icon || null,
      });
      res.json(link);
    } catch (error) {
      console.error("Error creating link:", error);
      res.status(500).json({ message: "Ошибка создания ссылки" });
    }
  });

  app.put("/api/links/:id", requireAuth, async (req, res) => {
    try {
      const { title, url, icon, isActive } = req.body;
      const updated = await storage.updateTenantLink(req.params.id, req.user!.tenantId!, {
        title,
        url,
        icon,
        isActive,
      });
      if (!updated) {
        return res.status(404).json({ message: "Ссылка не найдена" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating link:", error);
      res.status(500).json({ message: "Ошибка обновления ссылки" });
    }
  });

  app.delete("/api/links/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTenantLink(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting link:", error);
      res.status(500).json({ message: "Ошибка удаления ссылки" });
    }
  });

  app.post("/api/links/reorder", requireAuth, async (req, res) => {
    try {
      const { linkIds } = req.body;
      if (!Array.isArray(linkIds)) {
        return res.status(400).json({ message: "linkIds должен быть массивом" });
      }
      await storage.reorderTenantLinks(req.user!.tenantId!, linkIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering links:", error);
      res.status(500).json({ message: "Ошибка сортировки ссылок" });
    }
  });

  // Public links page API
  app.get("/api/public/links/:slug", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ message: "Страница не найдена" });
      }
      const links = await storage.getTenantLinksBySlug(req.params.slug);
      res.json({
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          description: tenant.description,
        },
        links,
      });
    } catch (error) {
      console.error("Error getting public links:", error);
      res.status(500).json({ message: "Ошибка загрузки страницы" });
    }
  });

  // ============ TELEGRAM NOTIFICATIONS ============
  const { sendTelegramMessage, verifyTelegramBot } = await import("./services/telegram");

  // Save Telegram settings
  app.post("/api/telegram/settings", requireAuth, async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      const tenantId = req.user!.tenantId!;
      
      if (botToken) {
        // Verify the bot token
        const verify = await verifyTelegramBot(botToken);
        if (!verify.success) {
          return res.status(400).json({ message: verify.error });
        }
      }
      
      await storage.updateTenant(tenantId, {
        telegramBotToken: botToken || null,
        telegramChatId: chatId || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving Telegram settings:", error);
      res.status(500).json({ message: "Ошибка сохранения настроек" });
    }
  });

  // ============ KASPI INTEGRATION ============
  
  app.get("/api/kaspi/integration", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getKaspiIntegration(req.user!.tenantId!);
      res.json(integration || null);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения интеграции Kaspi" });
    }
  });

  app.post("/api/kaspi/connect", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { kaspiPayLink } = req.body;
      
      if (!kaspiPayLink) {
        return res.status(400).json({ success: false, message: "Ссылка Kaspi Pay обязательна" });
      }
      
      const { kaspiBusinessService } = await import("./services/payments/kaspi-business.service");
      const result = await kaspiBusinessService.connect(tenantId, kaspiPayLink);
      
      if (result.success) {
        const integration = await storage.getKaspiIntegration(tenantId);
        res.json({ success: true, integration });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error connecting Kaspi:", error);
      res.status(500).json({ success: false, message: "Ошибка подключения Kaspi" });
    }
  });

  app.delete("/api/kaspi/integration", requireAuth, async (req, res) => {
    try {
      await storage.deleteKaspiIntegration(req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления интеграции" });
    }
  });

  app.patch("/api/kaspi/settings", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const settings = req.body;
      
      const updated = await storage.updateKaspiIntegration(tenantId, settings);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления настроек" });
    }
  });

  app.post("/api/kaspi/disconnect", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { kaspiBusinessService } = await import("./services/payments/kaspi-business.service");
      await kaspiBusinessService.disconnect(tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Kaspi:", error);
      res.status(500).json({ message: "Ошибка отключения Kaspi" });
    }
  });

  // ============ PAYMENTS ============
  
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const status = req.query.status as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const payments = await storage.getPayments(tenantId, { status, limit, offset });
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения платежей" });
    }
  });

  app.get("/api/payments/:orderId", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { checkPaymentStatus } = await import("./services/payments");
      const result = await checkPaymentStatus(tenantId, req.params.orderId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статуса платежа" });
    }
  });

  app.post("/api/payments/create", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { orderId } = req.body;
      
      const order = await storage.getOrder(orderId, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      const { createPaymentForOrder } = await import("./services/payments");
      const result = await createPaymentForOrder({
        order,
        tenantId,
        source: "manual",
      });
      
      if (result.success) {
        res.json({
          success: true,
          payment: result.payment,
          paymentUrl: result.paymentUrl,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Ошибка создания платежа",
        });
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Ошибка создания платежа" });
    }
  });

  app.post("/api/payments/kaspi-business/create", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const { kaspiBusinessCreateInvoiceSchema } = await import("@shared/schema");
      const parsed = kaspiBusinessCreateInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Ошибка валидации" });
      }
      
      const { orderId, sendWhatsApp } = parsed.data;
      
      const order = await storage.getOrder(orderId, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      if (!order.customerPhone) {
        return res.status(400).json({ message: "Телефон клиента обязателен для выставления счёта" });
      }
      
      const { createKaspiBusinessInvoice } = await import("./services/payments");
      const result = await createKaspiBusinessInvoice({
        order,
        tenantId,
        sendWhatsApp,
      });
      
      if (result.success) {
        res.json({
          success: true,
          payment: result.payment,
          paymentUrl: result.paymentUrl,
          whatsappSent: result.whatsappSent,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Ошибка создания счёта Kaspi Business",
        });
      }
    } catch (error) {
      console.error("Error creating Kaspi Business invoice:", error);
      res.status(500).json({ message: "Ошибка создания счёта Kaspi Business" });
    }
  });

  app.post("/api/payments/:paymentId/confirm", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { paymentId } = req.params;
      const confirmedBy = req.user!.id;
      
      const { confirmPaymentByManager } = await import("./services/payments");
      const result = await confirmPaymentByManager(tenantId, paymentId, confirmedBy);
      
      if (result.success) {
        res.json({ success: true, message: "Оплата подтверждена" });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ success: false, message: "Ошибка подтверждения оплаты" });
    }
  });

  app.post("/api/payments/:paymentId/upload-receipt", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { paymentId } = req.params;
      const { receiptImageUrl } = req.body;
      
      if (!receiptImageUrl) {
        return res.status(400).json({ success: false, message: "URL изображения чека обязателен" });
      }
      
      const payment = await storage.getPayment(paymentId);
      if (!payment || payment.tenantId !== tenantId) {
        return res.status(404).json({ success: false, message: "Платёж не найден" });
      }
      
      await storage.updatePayment(paymentId, {
        receiptImageUrl,
      });
      
      const { kaspiBusinessService } = await import("./services/payments/kaspi-business.service");
      const verificationResult = await kaspiBusinessService.verifyReceipt(
        receiptImageUrl,
        parseFloat(payment.amount),
        payment.orderId
      );
      
      await storage.updatePayment(paymentId, {
        aiVerified: verificationResult.verified,
        aiVerificationData: verificationResult as unknown as Record<string, unknown>,
      });
      
      const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
      if (kaspiIntegration?.notifyManager) {
        const tenant = await storage.getTenant(tenantId);
        if (tenant?.telegramBotToken && tenant?.telegramChatId) {
          const order = await storage.getOrder(payment.orderId, tenantId);
          const { sendTelegramMessage } = await import("./services/telegram");
          const statusEmoji = verificationResult.verified ? "V" : "?";
          sendTelegramMessage({
            botToken: tenant.telegramBotToken,
            chatId: tenant.telegramChatId,
            message: `${statusEmoji} Чек получен!\n\nЗаказ: #${order?.orderNumber}\nСумма: ${payment.amount} ₸\nAI проверка: ${verificationResult.verified ? "Подтверждён" : "Требует проверки"}\n${verificationResult.warnings.length > 0 ? `Предупреждения: ${verificationResult.warnings.join(", ")}` : ""}\n\nПодтвердите оплату в панели управления.`,
          }).catch(err => console.error("Failed to send receipt notification:", err));
        }
      }
      
      res.json({
        success: true,
        verification: verificationResult,
      });
    } catch (error) {
      console.error("Error uploading receipt:", error);
      res.status(500).json({ success: false, message: "Ошибка загрузки чека" });
    }
  });

  app.post("/api/payments/:paymentId/reject", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { paymentId } = req.params;
      const { reason } = req.body;
      
      const payment = await storage.getPayment(paymentId);
      if (!payment || payment.tenantId !== tenantId) {
        return res.status(404).json({ success: false, message: "Платёж не найден" });
      }
      
      await storage.updatePayment(paymentId, {
        status: "failed",
        failedAt: new Date(),
        failureReason: reason || "Оплата отклонена менеджером",
      });
      
      res.json({ success: true, message: "Оплата отклонена" });
    } catch (error) {
      console.error("Error rejecting payment:", error);
      res.status(500).json({ success: false, message: "Ошибка отклонения оплаты" });
    }
  });

  // ============ WHATSAPP CLOUD API ============

  app.get("/api/whatsapp-cloud/integration", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const integration = await storage.getWaCloudIntegration(tenantId);
      res.json(integration || null);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения интеграции" });
    }
  });

  app.delete("/api/whatsapp-cloud/integration", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.deleteWaCloudIntegration(tenantId);
      res.json({ success: true, message: "Интеграция сброшена" });
    } catch (error) {
      console.error("Delete integration error:", error);
      res.status(500).json({ message: "Ошибка удаления интеграции" });
    }
  });

  app.post("/api/whatsapp-cloud/onboarding/start", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      
      const appId = process.env.META_APP_ID || "";
      const appSecret = process.env.META_APP_SECRET || "";
      if (!appId || !appSecret) {
        return res.status(400).json({ message: "Meta App не настроен" });
      }
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.BASE_URL || "http://localhost:5000";
      const redirectUri = `${baseUrl}/api/whatsapp-cloud/oauth/callback`;
      
      const oauthUrl = await metaCloudService.initiateOAuth(tenantId, appId, redirectUri, appSecret);
      res.json({ success: true, oauthUrl });
    } catch (error) {
      console.error("Onboarding start error:", error);
      res.status(500).json({ message: "Ошибка запуска подключения" });
    }
  });

  app.get("/api/whatsapp-cloud/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.redirect("/dashboard/whatsapp-cloud?error=missing_params");
      }
      
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      const appSecret = process.env.META_APP_SECRET || "";
      
      const stateVerification = metaCloudService.verifyOAuthState(state as string, appSecret);
      if (!stateVerification.valid || !stateVerification.tenantId || !stateVerification.nonce) {
        console.error("OAuth state verification failed:", stateVerification.error);
        return res.redirect(`/dashboard/whatsapp-cloud?error=${encodeURIComponent(stateVerification.error || "invalid_state")}`);
      }
      
      const tenantId = stateVerification.tenantId;
      
      const nonceValid = await metaCloudService.validateOAuthNonce(tenantId, stateVerification.nonce);
      if (!nonceValid) {
        console.error("OAuth nonce validation failed for tenant:", tenantId);
        return res.redirect("/dashboard/whatsapp-cloud?error=invalid_or_used_state");
      }
      
      const appId = process.env.META_APP_ID || "";
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.BASE_URL || "http://localhost:5000";
      const redirectUri = `${baseUrl}/api/whatsapp-cloud/oauth/callback`;
      
      const result = await metaCloudService.handleOAuthCallback(
        tenantId, 
        code as string, 
        appId, 
        appSecret, 
        redirectUri
      );
      
      if (result.success) {
        res.redirect("/dashboard/whatsapp-cloud?success=1");
      } else {
        res.redirect(`/dashboard/whatsapp-cloud?error=${encodeURIComponent(result.error || "auth_failed")}`);
      }
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect("/dashboard/whatsapp-cloud?error=callback_failed");
    }
  });

  app.get("/api/whatsapp-cloud/phones", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const phones = await storage.getWaCloudPhoneNumbers(tenantId);
      res.json(phones);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения номеров" });
    }
  });

  app.post("/api/whatsapp-cloud/phones/sync", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      
      const result = await metaCloudService.fetchPhoneNumbers(tenantId);
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      const integration = await storage.getWaCloudIntegration(tenantId);
      if (!integration) {
        return res.status(404).json({ message: "Интеграция не найдена" });
      }
      
      const existingPhones = await storage.getWaCloudPhoneNumbers(tenantId);
      for (const phone of result.phones || []) {
        const existing = existingPhones.find(p => p.phoneNumberId === phone.id);
        if (existing) {
          await storage.updateWaCloudPhoneNumber(existing.id, {
            qualityRating: phone.quality_rating?.toLowerCase() || "unknown",
            messagingTier: phone.messaging_limit_tier?.toLowerCase() || "tier_1",
            displayPhoneNumber: phone.display_phone_number,
            lastSyncAt: new Date(),
          });
        } else {
          await storage.createWaCloudPhoneNumber({
            tenantId,
            integrationId: integration.id,
            phoneNumber: phone.display_phone_number,
            phoneNumberId: phone.id,
            displayPhoneNumber: phone.display_phone_number,
            status: "active",
            verificationStatus: "verified",
            qualityRating: phone.quality_rating?.toLowerCase() || "unknown",
            messagingTier: phone.messaging_limit_tier?.toLowerCase() || "tier_1",
            channelType: "cloud_api",
            isDefault: existingPhones.length === 0,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка синхронизации номеров" });
    }
  });

  const testMessageSchema = z.object({
    phoneNumberId: z.string().min(1),
    recipientPhone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  });

  app.post("/api/whatsapp-cloud/test-message", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const validationResult = testMessageSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Некорректные данные",
          details: validationResult.error.flatten()
        });
      }
      
      const { phoneNumberId, recipientPhone } = validationResult.data;
      
      const phones = await storage.getWaCloudPhoneNumbers(tenantId);
      const phoneExists = phones.some(p => p.phoneNumberId === phoneNumberId);
      if (!phoneExists) {
        return res.status(403).json({ success: false, error: "Номер не принадлежит этому аккаунту" });
      }
      
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      const result = await metaCloudService.sendTestMessage(tenantId, phoneNumberId, recipientPhone);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Ошибка отправки сообщения" });
    }
  });

  app.get("/api/whatsapp-cloud/templates", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const templates = await storage.getWaCloudTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения шаблонов" });
    }
  });

  const createTemplateSchema = z.object({
    name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
    language: z.string().min(2).max(10).default("ru"),
    category: z.enum(["utility", "marketing", "authentication"]),
    bodyText: z.string().min(1).max(1024),
    headerType: z.enum(["text", "image", "video", "document"]).optional(),
    headerContent: z.string().optional(),
    footerText: z.string().max(60).optional(),
    buttons: z.array(z.object({
      type: z.enum(["QUICK_REPLY", "PHONE_NUMBER", "URL"]),
      text: z.string().max(25),
      url: z.string().optional(),
      phoneNumber: z.string().optional(),
    })).max(3).optional(),
  });

  app.post("/api/whatsapp-cloud/templates", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const validationResult = createTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Некорректные данные шаблона",
          details: validationResult.error.flatten()
        });
      }
      
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      const result = await metaCloudService.createTemplate(tenantId, validationResult.data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Ошибка создания шаблона" });
    }
  });

  app.post("/api/whatsapp-cloud/templates/sync", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      
      const result = await metaCloudService.syncTemplates(tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Ошибка синхронизации шаблонов" });
    }
  });

  app.get("/api/whatsapp-cloud/campaigns", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const campaigns = await storage.getWaCloudCampaigns(tenantId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения рассылок" });
    }
  });

  app.get("/api/whatsapp-cloud/warmup", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      
      await metaCloudService.updateWarmupProgress(tenantId);
      const warmup = await storage.getWaCloudWarmupStatus(tenantId);
      res.json(warmup || null);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статуса прогрева" });
    }
  });

  app.get("/api/whatsapp-cloud/risk", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      
      const integration = await storage.getWaCloudIntegration(tenantId);
      if (!integration) {
        return res.json({ score: "green", issues: [], recommendations: [] });
      }
      
      const phones = await storage.getWaCloudPhoneNumbers(tenantId);
      const warmup = await storage.getWaCloudWarmupStatus(tenantId);
      
      const riskStatus = metaCloudService.calculateRiskScore(integration, phones, warmup);
      res.json(riskStatus);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статуса риска" });
    }
  });

  app.get("/api/whatsapp-cloud/webhook/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      
      if (req.query["hub.mode"] === "subscribe") {
        const integration = await storage.getWaCloudIntegration(tenantId);
        if (integration?.webhookVerifyToken === req.query["hub.verify_token"]) {
          return res.send(req.query["hub.challenge"]);
        }
        return res.status(403).send("Verification failed");
      }
      
      res.status(400).send("Bad request");
    } catch (error) {
      console.error("WhatsApp Cloud webhook verification error:", error);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/whatsapp-cloud/webhook/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      
      const signature = req.headers["x-hub-signature-256"] as string;
      if (!signature) {
        return res.status(401).json({ error: "Missing signature" });
      }
      
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      const appSecret = process.env.META_APP_SECRET || "";
      
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error("Raw body not available for webhook signature verification");
        return res.status(500).json({ error: "Server configuration error" });
      }
      
      if (!metaCloudService.verifyWebhookSignature(rawBody, signature, appSecret)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      await metaCloudService.handleWebhookEvent(tenantId, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp Cloud webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global webhook endpoint for Meta verification (without tenantId)
  const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "BOTFACTORY_VERIFY_2026";
  
  app.get("/api/whatsapp-cloud/webhook", async (req, res) => {
    try {
      if (req.query["hub.mode"] === "subscribe") {
        if (req.query["hub.verify_token"] === WEBHOOK_VERIFY_TOKEN) {
          console.log("WhatsApp Cloud webhook verification successful");
          return res.send(req.query["hub.challenge"]);
        }
        console.log("WhatsApp Cloud webhook verification failed: invalid token");
        return res.status(403).send("Verification failed");
      }
      res.status(400).send("Bad request");
    } catch (error) {
      console.error("WhatsApp Cloud webhook verification error:", error);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/whatsapp-cloud/webhook", async (req, res) => {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      if (!signature) {
        return res.status(401).json({ error: "Missing signature" });
      }
      
      const { metaCloudService } = await import("./services/whatsapp-cloud/meta.service");
      const appSecret = process.env.META_APP_SECRET || "";
      
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error("Raw body not available for webhook signature verification");
        return res.status(500).json({ error: "Server configuration error" });
      }
      
      if (!metaCloudService.verifyWebhookSignature(rawBody, signature, appSecret)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      // Extract tenantId from webhook payload (in entry[].changes[].value.metadata.phone_number_id)
      // and route to appropriate handler
      const body = req.body;
      if (body.entry) {
        for (const entry of body.entry) {
          const phoneNumberId = entry.changes?.[0]?.value?.metadata?.phone_number_id;
          if (phoneNumberId) {
            // Find tenant by phone_number_id
            const integration = await storage.getWaCloudIntegrationByPhoneNumberId(phoneNumberId);
            if (integration) {
              await metaCloudService.handleWebhookEvent(integration.tenantId, body);
            }
          }
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp Cloud webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ INSTAGRAM DIRECT INTEGRATION ============
  
  app.get("/api/instagram/integration", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const integration = await storage.getInstagramIntegration(tenantId);
      res.json(integration || null);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения интеграции Instagram" });
    }
  });

  app.delete("/api/instagram/integration", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { instagramService } = await import("./services/instagram/instagram.service");
      await instagramService.disconnect(tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка отключения Instagram" });
    }
  });

  app.post("/api/instagram/onboarding/start", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      
      if (!appId || !appSecret) {
        return res.status(500).json({ error: "Instagram integration not configured" });
      }
      
      const protocol = req.get("host")?.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${req.get("host")}`;
      const redirectUri = `${baseUrl}/api/instagram/oauth/callback`;
      
      const { instagramService } = await import("./services/instagram/instagram.service");
      const authUrl = await instagramService.initiateOAuth(tenantId, appId, redirectUri, appSecret);
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Instagram onboarding error:", error);
      res.status(500).json({ error: "Failed to start Instagram onboarding" });
    }
  });

  app.get("/api/instagram/oauth/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;
      
      if (oauthError) {
        console.error("Instagram OAuth error:", oauthError, error_description);
        return res.redirect(`/dashboard/ai/integrations?error=${encodeURIComponent(error_description as string || "OAuth failed")}`);
      }
      
      if (!code || !state) {
        return res.redirect("/dashboard/ai/integrations?error=missing_params");
      }
      
      const appId = process.env.META_APP_ID!;
      const appSecret = process.env.META_APP_SECRET!;
      const protocol = req.get("host")?.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${req.get("host")}`;
      const redirectUri = `${baseUrl}/api/instagram/oauth/callback`;
      
      const { instagramService } = await import("./services/instagram/instagram.service");
      const result = await instagramService.handleOAuthCallback(
        code as string,
        state as string,
        appId,
        appSecret,
        redirectUri
      );
      
      if (result.success) {
        res.redirect("/dashboard/ai/integrations?instagram=success");
      } else {
        res.redirect(`/dashboard/ai/integrations?error=${encodeURIComponent(result.error || "Connection failed")}`);
      }
    } catch (error) {
      console.error("Instagram OAuth callback error:", error);
      res.redirect("/dashboard/ai/integrations?error=callback_failed");
    }
  });

  app.get("/api/instagram/messages", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await storage.getInstagramMessages(tenantId, limit);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения сообщений" });
    }
  });

  app.get("/api/instagram/webhook", async (req, res) => {
    try {
      const mode = req.query["hub.mode"] as string | undefined;
      const token = req.query["hub.verify_token"] as string | undefined;
      const challenge = req.query["hub.challenge"] as string | undefined;
      
      const globalVerifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
      
      if (globalVerifyToken && mode === "subscribe" && token === globalVerifyToken) {
        return res.status(200).send(challenge);
      }
      
      res.status(403).send("Forbidden");
    } catch (error) {
      console.error("Instagram webhook verify error:", error);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/instagram/webhook", async (req, res) => {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      const appSecret = process.env.META_APP_SECRET || "";
      const rawBody = (req as any).rawBody;
      
      if (!rawBody) {
        console.error("Raw body not available for Instagram webhook");
        return res.status(500).json({ error: "Server configuration error" });
      }
      
      const { instagramService } = await import("./services/instagram/instagram.service");
      await instagramService.processWebhookEvent(req.body, appSecret, signature, rawBody);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Instagram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ TELEGRAM BOT INTEGRATION ============
  
  app.get("/api/telegram/integration", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getTelegramIntegration(req.user!.tenantId!);
      res.json(integration || null);
    } catch (error) {
      console.error("Get Telegram integration error:", error);
      res.status(500).json({ error: "Ошибка получения интеграции" });
    }
  });

  app.post("/api/telegram/connect", requireAuth, async (req, res) => {
    try {
      const { botToken } = req.body;
      if (!botToken || typeof botToken !== "string" || botToken.length < 40) {
        return res.status(400).json({ error: "Некорректный токен бота" });
      }

      const { telegramService } = await import("./services/telegram/telegram.service");
      const baseUrl = process.env.BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
      
      const result = await telegramService.connectBot(req.user!.tenantId!, botToken, baseUrl);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result.integration);
    } catch (error) {
      console.error("Connect Telegram bot error:", error);
      res.status(500).json({ error: "Ошибка подключения бота" });
    }
  });

  app.delete("/api/telegram/integration", requireAuth, async (req, res) => {
    try {
      const { telegramService } = await import("./services/telegram/telegram.service");
      const result = await telegramService.disconnectBot(req.user!.tenantId!);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Disconnect Telegram bot error:", error);
      res.status(500).json({ error: "Ошибка отключения бота" });
    }
  });

  app.get("/api/telegram/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getTelegramMessages(req.user!.tenantId!);
      res.json(messages);
    } catch (error) {
      console.error("Get Telegram messages error:", error);
      res.status(500).json({ error: "Ошибка получения сообщений" });
    }
  });

  app.post("/api/telegram/webhook/:botId", async (req, res) => {
    try {
      const { botId } = req.params;
      const secretToken = req.headers["x-telegram-bot-api-secret-token"] as string;
      
      const { telegramService } = await import("./services/telegram/telegram.service");
      const integration = await telegramService.findIntegrationByBotId(botId);
      
      if (!integration) {
        return res.status(404).json({ error: "Bot not found" });
      }
      
      if (!telegramService.verifyWebhookRequest(secretToken, integration.webhookSecret || "")) {
        return res.status(401).json({ error: "Invalid secret" });
      }
      
      const tenant = await storage.getTenant(integration.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      await telegramService.processWebhookUpdate(req.body, integration, tenant);
      
      res.json({ ok: true });
    } catch (error) {
      console.error("Telegram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ WIDGET INTEGRATION ============
  
  app.get("/api/widget/integration", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getWidgetIntegration(req.user!.tenantId!);
      res.json(integration || null);
    } catch (error) {
      console.error("Get Widget integration error:", error);
      res.status(500).json({ error: "Ошибка получения интеграции" });
    }
  });

  app.post("/api/widget/create", requireAuth, async (req, res) => {
    try {
      const { name, primaryColor, position, welcomeMessage, placeholder, allowedDomains } = req.body;
      
      const { widgetService } = await import("./services/widget/widget.service");
      const result = await widgetService.createWidget(req.user!.tenantId!, {
        name,
        primaryColor,
        position,
        welcomeMessage,
        placeholder,
        allowedDomains,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result.widget);
    } catch (error) {
      console.error("Create Widget error:", error);
      res.status(500).json({ error: "Ошибка создания виджета" });
    }
  });

  app.put("/api/widget/integration", requireAuth, async (req, res) => {
    try {
      const { name, primaryColor, position, welcomeMessage, placeholder, allowedDomains, isActive } = req.body;
      
      const { widgetService } = await import("./services/widget/widget.service");
      const result = await widgetService.updateWidget(req.user!.tenantId!, {
        name,
        primaryColor,
        position,
        welcomeMessage,
        placeholder,
        allowedDomains,
        isActive,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result.widget);
    } catch (error) {
      console.error("Update Widget error:", error);
      res.status(500).json({ error: "Ошибка обновления виджета" });
    }
  });

  app.delete("/api/widget/integration", requireAuth, async (req, res) => {
    try {
      const { widgetService } = await import("./services/widget/widget.service");
      const result = await widgetService.deleteWidget(req.user!.tenantId!);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete Widget error:", error);
      res.status(500).json({ error: "Ошибка удаления виджета" });
    }
  });

  app.get("/api/widget/embed-code", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getWidgetIntegration(req.user!.tenantId!);
      if (!integration) {
        return res.status(404).json({ error: "Виджет не создан" });
      }
      
      const { widgetService } = await import("./services/widget/widget.service");
      const baseUrl = process.env.BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
      const embedCode = widgetService.generateEmbedScript(integration.widgetKey, baseUrl);
      
      res.json({ embedCode, widgetKey: integration.widgetKey });
    } catch (error) {
      console.error("Get embed code error:", error);
      res.status(500).json({ error: "Ошибка получения кода виджета" });
    }
  });

  // Public widget API routes
  app.get("/api/public/widget/:widgetKey/config", async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const origin = req.headers.origin || "";
      
      const { widgetService } = await import("./services/widget/widget.service");
      const widget = await widgetService.getWidgetByKey(widgetKey);
      
      if (!widget || !widget.isActive) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      if (!widgetService.validateDomain(new URL(origin).hostname, widget.allowedDomains)) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      
      res.json({
        name: widget.name,
        primaryColor: widget.primaryColor,
        position: widget.position,
        welcomeMessage: widget.welcomeMessage,
        placeholder: widget.placeholder,
      });
    } catch (error) {
      console.error("Get widget config error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/public/widget/:widgetKey/conversation", async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
      }
      
      const { widgetService } = await import("./services/widget/widget.service");
      const result = await widgetService.getOrCreateConversation(widgetKey, sessionId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        conversationId: result.conversation!.id,
        welcomeMessage: result.widget!.welcomeMessage,
      });
    } catch (error) {
      console.error("Create widget conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/public/widget/:widgetKey/message", async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ error: "conversationId and message required" });
      }
      
      const { widgetService } = await import("./services/widget/widget.service");
      const result = await widgetService.sendMessage(conversationId, widgetKey, message);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ reply: result.reply });
    } catch (error) {
      console.error("Widget message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/public/widget/:widgetKey/messages/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const { widgetService } = await import("./services/widget/widget.service");
      const messages = await widgetService.getMessages(conversationId);
      
      res.json(messages);
    } catch (error) {
      console.error("Get widget messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ CRM INTEGRATIONS ============
  
  // Get CRM integrations
  app.get("/api/crm/integrations", requireAuth, async (req, res) => {
    try {
      const integrations = await storage.getCrmIntegrations(req.user!.tenantId!);
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения интеграций" });
    }
  });

  // Get auth URL for CRM
  app.get("/api/crm/auth/url", requireAuth, async (req, res) => {
    try {
      const crmType = req.query.crmType as string;
      const state = Buffer.from(JSON.stringify({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        crmType,
      })).toString("base64");

      let url = "";
      if (crmType === "bitrix24") {
        const clientId = process.env.BITRIX24_CLIENT_ID || "";
        const redirectUri = process.env.BITRIX24_REDIRECT_URI || `${process.env.BASE_URL || "https://botfactory.kz"}/api/crm/oauth/bitrix24/callback`;
        url = `https://oauth.bitrix.info/oauth/authorize/?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      } else if (crmType === "amocrm") {
        const clientId = process.env.AMOCRM_CLIENT_ID || "";
        url = `https://www.amocrm.ru/oauth?client_id=${clientId}&mode=post_message&state=${state}`;
      }

      res.json({ url });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения URL авторизации" });
    }
  });

  // OAuth callback for CRM
  app.post("/api/crm/auth/callback", requireAuth, async (req, res) => {
    try {
      const { crmType, code, domain } = req.body;
      const tenantId = req.user!.tenantId!;

      // Check existing integration
      const existing = await storage.getCrmIntegrationByCrmType(tenantId, crmType);
      if (existing) {
        await storage.deleteCrmIntegration(existing.id, tenantId);
      }

      let accessToken = "";
      let refreshToken = "";
      let tokenExpiresAt = new Date();
      let crmDomain = domain || "";

      if (crmType === "bitrix24") {
        const clientId = process.env.BITRIX24_CLIENT_ID || "";
        const clientSecret = process.env.BITRIX24_CLIENT_SECRET || "";
        const redirectUri = process.env.BITRIX24_REDIRECT_URI || `${process.env.BASE_URL || "https://botfactory.kz"}/api/crm/oauth/bitrix24/callback`;

        const tokenRes = await fetch("https://oauth.bitrix.info/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error("Не удалось получить токен");
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
        crmDomain = tokenData.domain || tokenData.member_id;
      } else if (crmType === "amocrm") {
        const clientId = process.env.AMOCRM_CLIENT_ID || "";
        const clientSecret = process.env.AMOCRM_CLIENT_SECRET || "";
        const redirectUri = process.env.AMOCRM_REDIRECT_URI || `${process.env.BASE_URL || "https://botfactory.kz"}/api/crm/oauth/amocrm/callback`;

        const tokenRes = await fetch(`https://${domain}/oauth2/access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error("Не удалось получить токен");
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);
        crmDomain = domain;
      }

      const integration = await storage.createCrmIntegration({
        tenantId,
        crmType,
        status: "pending",
        accessToken,
        refreshToken,
        tokenExpiresAt,
        crmDomain,
      });

      res.json({ integrationId: integration.id });
    } catch (error: any) {
      console.error("CRM auth error:", error);
      res.status(500).json({ message: error.message || "Ошибка авторизации" });
    }
  });

  // Get pipelines from CRM
  app.get("/api/crm/integrations/:id/pipelines", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getCrmIntegration(req.params.id, req.user!.tenantId!);
      if (!integration) {
        return res.status(404).json({ message: "Интеграция не найдена" });
      }

      let pipelines: any[] = [];
      
      if (integration.crmType === "bitrix24" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/rest/crm.category.list`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${integration.accessToken}`,
          },
          body: JSON.stringify({ entityTypeId: 2 }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const categories = data.result?.categories || [];
          
          for (const cat of categories) {
            const stagesRes = await fetch(`https://${integration.crmDomain}/rest/crm.dealcategory.stage.list`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${integration.accessToken}`,
              },
              body: JSON.stringify({ id: cat.ID }),
            });
            
            let stages: any[] = [];
            if (stagesRes.ok) {
              const stagesData = await stagesRes.json();
              stages = (stagesData.result || []).map((s: any) => ({
                id: s.STATUS_ID,
                name: s.NAME,
              }));
            }
            
            pipelines.push({
              id: cat.ID,
              name: cat.NAME,
              stages,
            });
          }
        }
      } else if (integration.crmType === "amocrm" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/api/v4/leads/pipelines`, {
          headers: { "Authorization": `Bearer ${integration.accessToken}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          pipelines = (data._embedded?.pipelines || []).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            stages: (p._embedded?.statuses || []).map((s: any) => ({
              id: String(s.id),
              name: s.name,
            })),
          }));
        }
      }

      res.json(pipelines);
    } catch (error) {
      console.error("Get pipelines error:", error);
      res.status(500).json({ message: "Ошибка получения воронок" });
    }
  });

  // Get users from CRM
  app.get("/api/crm/integrations/:id/users", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getCrmIntegration(req.params.id, req.user!.tenantId!);
      if (!integration) {
        return res.status(404).json({ message: "Интеграция не найдена" });
      }

      let users: any[] = [];
      
      if (integration.crmType === "bitrix24" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/rest/user.get`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${integration.accessToken}`,
          },
          body: JSON.stringify({ FILTER: { ACTIVE: true } }),
        });
        
        if (response.ok) {
          const data = await response.json();
          users = (data.result || []).map((u: any) => ({
            id: String(u.ID),
            name: `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || u.EMAIL,
          }));
        }
      } else if (integration.crmType === "amocrm" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/api/v4/users`, {
          headers: { "Authorization": `Bearer ${integration.accessToken}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          users = (data._embedded?.users || []).map((u: any) => ({
            id: String(u.id),
            name: u.name,
          }));
        }
      }

      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Ошибка получения пользователей" });
    }
  });

  // Update CRM integration settings
  app.patch("/api/crm/integrations/:id", requireAuth, async (req, res) => {
    try {
      const integration = await storage.updateCrmIntegration(
        req.params.id, 
        req.user!.tenantId!, 
        {
          ...req.body,
          status: "connected",
        }
      );
      
      if (!integration) {
        return res.status(404).json({ message: "Интеграция не найдена" });
      }
      
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления интеграции" });
    }
  });

  // Test CRM connection
  app.post("/api/crm/integrations/:id/test", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getCrmIntegration(req.params.id, req.user!.tenantId!);
      if (!integration) {
        return res.status(404).json({ message: "Интеграция не найдена" });
      }

      let success = false;
      
      if (integration.crmType === "bitrix24" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/rest/profile`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${integration.accessToken}` },
        });
        success = response.ok;
      } else if (integration.crmType === "amocrm" && integration.crmDomain && integration.accessToken) {
        const response = await fetch(`https://${integration.crmDomain}/api/v4/account`, {
          headers: { "Authorization": `Bearer ${integration.accessToken}` },
        });
        success = response.ok;
      }

      if (success) {
        await storage.updateCrmIntegration(req.params.id, req.user!.tenantId!, {
          status: "connected",
          lastSyncAt: new Date(),
        });
      } else {
        await storage.updateCrmIntegration(req.params.id, req.user!.tenantId!, {
          status: "error",
          lastError: "Не удалось подключиться к CRM",
          lastErrorAt: new Date(),
        });
      }

      res.json({ success, error: success ? null : "Не удалось подключиться к CRM" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Ошибка тестирования" });
    }
  });

  // Send test deal to CRM
  app.post("/api/crm/integrations/:id/test-deal", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getCrmIntegration(req.params.id, req.user!.tenantId!);
      if (!integration || integration.status !== "connected") {
        return res.status(400).json({ success: false, message: "Интеграция не настроена" });
      }

      const tenant = await storage.getTenant(req.user!.tenantId!);
      const testData = {
        title: `[ТЕСТ] Заявка от SmartCatalog`,
        clientName: "Тестовый клиент",
        phone: "+77765348417",
        email: "test@example.com",
        products: "Тестовый товар x1 = 10000₸",
        amount: 10000,
        comment: "Это тестовая заявка для проверки интеграции",
      };

      let dealId = "";
      
      if (integration.crmType === "bitrix24" && integration.crmDomain && integration.accessToken) {
        const fields: any = {
          TITLE: testData.title,
          STAGE_ID: integration.stageId || "NEW",
          OPPORTUNITY: testData.amount,
          CURRENCY_ID: "KZT",
          COMMENTS: `${testData.products}\n\n${testData.comment}`,
          SOURCE_ID: "WEB",
          SOURCE_DESCRIPTION: "SmartCatalog",
        };
        
        if (integration.responsibleUserId) {
          fields.ASSIGNED_BY_ID = integration.responsibleUserId;
        }

        const response = await fetch(`https://${integration.crmDomain}/rest/crm.deal.add`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${integration.accessToken}`,
          },
          body: JSON.stringify({ fields }),
        });

        if (response.ok) {
          const data = await response.json();
          dealId = String(data.result);
        } else {
          throw new Error("Ошибка создания сделки");
        }
      } else if (integration.crmType === "amocrm" && integration.crmDomain && integration.accessToken) {
        const leadData: any = {
          name: testData.title,
          price: testData.amount,
          pipeline_id: integration.pipelineId ? parseInt(integration.pipelineId) : undefined,
          status_id: integration.stageId ? parseInt(integration.stageId) : undefined,
          _embedded: {
            tags: [{ name: "SmartCatalog" }, { name: "Тест" }],
          },
        };

        if (integration.responsibleUserId) {
          leadData.responsible_user_id = parseInt(integration.responsibleUserId);
        }

        const response = await fetch(`https://${integration.crmDomain}/api/v4/leads`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${integration.accessToken}`,
          },
          body: JSON.stringify([leadData]),
        });

        if (response.ok) {
          const data = await response.json();
          dealId = String(data._embedded?.leads?.[0]?.id || "");
        } else {
          throw new Error("Ошибка создания лида");
        }
      }

      await storage.updateCrmIntegration(req.params.id, req.user!.tenantId!, {
        lastSyncAt: new Date(),
      });

      res.json({ 
        success: true, 
        message: "Тестовая сделка успешно создана!", 
        dealId 
      });
    } catch (error: any) {
      console.error("Test deal error:", error);
      res.json({ 
        success: false, 
        message: error.message || "Ошибка создания тестовой сделки" 
      });
    }
  });

  // Delete CRM integration
  app.delete("/api/crm/integrations/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCrmIntegration(req.params.id, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления интеграции" });
    }
  });

  // Get Telegram settings
  app.get("/api/telegram/settings", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId!);
      if (!tenant) {
        return res.status(404).json({ message: "Тенант не найден" });
      }
      
      res.json({
        botToken: tenant.telegramBotToken || "",
        chatId: tenant.telegramChatId || "",
        isConfigured: !!(tenant.telegramBotToken && tenant.telegramChatId),
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения настроек" });
    }
  });

  // Test Telegram notification
  app.post("/api/telegram/test", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId!);
      if (!tenant?.telegramBotToken || !tenant?.telegramChatId) {
        return res.status(400).json({ message: "Telegram не настроен" });
      }
      
      const result = await sendTelegramMessage({
        botToken: tenant.telegramBotToken,
        chatId: tenant.telegramChatId,
        message: `✅ <b>Тестовое уведомление</b>\n\nУведомления для магазина "${tenant.name}" успешно настроены!`,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Ошибка отправки тестового сообщения" });
    }
  });

  // Dynamic OG tags for catalog pages - serves HTML with proper meta tags for messengers
  app.get("/c/:slug", async (req, res, next) => {
    try {
      // In development mode, skip OG middleware and let Vite's catch-all handle HTML serving
      // Vite must transform index.html to inject its client scripts for React to work
      if (process.env.NODE_ENV !== "production") {
        return next();
      }
      
      const slug = req.params.slug;
      const tenant = await storage.getTenantBySlug(slug);
      
      if (!tenant) {
        return next();
      }
      
      const indexPath = path.resolve(process.cwd(), "dist", "public", "index.html");
      
      if (!fs.existsSync(indexPath)) {
        return next();
      }
      
      let html = fs.readFileSync(indexPath, "utf-8");
      
      // Prepare OG meta tags
      const ogTitle = tenant.ogTitle || tenant.name || "SmartCatalog";
      const ogDescription = tenant.ogDescription || tenant.description || "Онлайн-каталог товаров";
      const ogImageRaw = tenant.ogImageUrl || tenant.logoUrl || "";
      
      // Use https for production (Replit proxy uses x-forwarded-proto)
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const baseUrl = `${protocol}://${req.get("host")}`;
      const platformDomain = process.env.PLATFORM_DOMAIN || "botfactory.kz";
      const canonicalUrl = (tenant as any).customDomain 
        ? `https://${(tenant as any).customDomain}`
        : `https://${encodeURIComponent(slug)}.${platformDomain}`;
      
      // Ensure og:image is a full URL
      const ogImage = ogImageRaw ? (ogImageRaw.startsWith("http") ? ogImageRaw : `${baseUrl}${ogImageRaw}`) : "";
      
      console.log(`[OG] Serving /c/${slug} - Title: ${ogTitle}, Image: ${ogImage || "none"}`);
      
      // Build meta tags string
      const metaTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ""}
    <meta name="description" content="${escapeHtml(ogDescription)}" />
    <title>${escapeHtml(ogTitle)}</title>`;
      
      // Insert meta tags before </head>
      html = html.replace("</head>", `${metaTags}\n  </head>`);
      
      res.set("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Error serving catalog page with OG tags:", error);
      next();
    }
  });

  registerAiRopRoutes(app, storage, pool, requireAuth, requireAiAccess);
  registerAiTestingRoutes(app, storage, pool, requireAuth, requireAiAccess);
  registerAiTrainingRoutes(app, storage, pool, requireAuth, requireAiAccess);
  registerAiAnalyticsRoutes(app, requireAuth, requireAiAccess);
  registerAiRopConnectRoutes(app, storage, requireAuth, requireAiAccess);

  return httpServer;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
