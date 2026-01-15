import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { loginSchema, registerSchema, checkoutSchema } from "@shared/schema";
import type { User, Tenant, Subscription, Plan } from "@shared/schema";

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

async function ensureDefaultPlans() {
  const existingPlans = await storage.getPlans();
  if (existingPlans.length === 0) {
    await storage.createPlan({
      name: "Старт",
      price: 19900,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 300,
      maxCategories: 30,
      maxPromotions: 10,
      maxDiscountRules: 20,
      maxManagers: 1,
      maxWahaInstances: 1,
      aiMessagesLimit: 500,
      features: ["Базовая аналитика", "WhatsApp интеграция"],
      isActive: true,
    });
    await storage.createPlan({
      name: "Про",
      price: 49900,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 3000,
      maxCategories: 200,
      maxPromotions: 50,
      maxDiscountRules: 100,
      maxManagers: 5,
      maxWahaInstances: 3,
      aiMessagesLimit: 5000,
      features: ["Расширенная аналитика", "WhatsApp интеграция", "Приоритетная поддержка"],
      isActive: true,
    });
    await storage.createPlan({
      name: "Бизнес",
      price: 99900,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 20000,
      maxCategories: 1000,
      maxPromotions: 200,
      maxDiscountRules: 500,
      maxManagers: 20,
      maxWahaInstances: 10,
      aiMessagesLimit: 20000,
      features: ["Полная аналитика", "WhatsApp интеграция", "API доступ", "Приоритетная поддержка"],
      isActive: true,
    });
    console.log("Default plans created");
  }
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await ensureDefaultPlans();

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
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

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

  app.get("/api/tenant", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId!);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения данных" });
    }
  });

  app.put("/api/tenant", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.user!.tenantId!, req.body);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления" });
    }
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      res.json(products);
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
      
      const discount = await storage.createDiscount({
        ...req.body,
        tenantId: req.user!.tenantId!,
      });
      res.json(discount);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания скидки" });
    }
  });

  app.put("/api/discounts/:id", requireAuth, async (req, res) => {
    try {
      const discount = await storage.updateDiscount(req.params.id, req.user!.tenantId!, req.body);
      res.json(discount);
    } catch (error) {
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

  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrders(req.user!.tenantId!);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения заказов" });
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
      const order = await storage.updateOrderStatus(req.params.id, req.user!.tenantId!, req.body.status);
      res.json(order);
    } catch (error) {
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
      const productsWithPrices = activeProducts.map(product => {
        const priceData = computeProductPrice(product, discounts as any, promotions as any);
        return {
          ...product,
          ...priceData,
        };
      });

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
        },
        products: productsWithPrices,
        categories: categories.filter(c => c.isActive),
        promotions: promotions.filter(p => p.isActive),
      });
    } catch (error) {
      res.status(500).json({ message: "Ошибка загрузки каталога" });
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

      await storage.logEvent({
        tenantId: tenant.id,
        eventType: "product_view",
        sessionId: req.sessionID,
        productId: product.id,
      });

      res.json({
        product: {
          ...product,
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

      res.json({ 
        orderId: order.id, 
        orderNumber: order.orderNumber,
        ownerWhatsAppPhone: tenant.notificationPhone || tenant.contactPhone || null,
        order: {
          ...order,
          items: orderItems,
        },
        catalogUrl: `${req.protocol}://${req.get('host')}/c/${tenantSlug}`,
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

  return httpServer;
}
