import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { loginSchema, registerSchema, checkoutSchema } from "@shared/schema";
import type { User, Tenant, Subscription, Plan } from "@shared/schema";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

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
    // Basic catalog plan - no AI
    await storage.createPlan({
      name: "Каталог",
      price: 9990,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 300,
      maxCategories: 30,
      maxPromotions: 10,
      maxDiscountRules: 20,
      maxManagers: 1,
      maxWahaInstances: 0,
      aiMessagesLimit: 0,
      hasAiAccess: false,
      features: ["Онлайн-каталог", "Базовая аналитика", "WhatsApp заказы"],
      isActive: true,
    });
    // Catalog + AI plan
    await storage.createPlan({
      name: "Каталог + AI",
      price: 19990,
      currency: "KZT",
      periodDays: 30,
      maxProducts: 1000,
      maxCategories: 50,
      maxPromotions: 20,
      maxDiscountRules: 50,
      maxManagers: 2,
      maxWahaInstances: 1,
      aiMessagesLimit: 1000,
      hasAiAccess: true,
      features: ["Онлайн-каталог", "AI-ассистент", "Расширенная аналитика", "WhatsApp интеграция"],
      isActive: true,
    });
    // Pro plan with AI
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
      hasAiAccess: true,
      features: ["Расширенная аналитика", "AI-ассистент", "WhatsApp интеграция", "Приоритетная поддержка"],
      isActive: true,
    });
    // Business plan with full AI
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
      hasAiAccess: true,
      features: ["Полная аналитика", "AI-ассистент", "WhatsApp интеграция", "API доступ", "Приоритетная поддержка"],
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

  app.post("/api/products/:productId/images", requireAuth, upload.array("images", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Файлы не загружены" });
      }

      const existingImages = await storage.getProductImages(req.params.productId, req.user!.tenantId!);
      const hasMainImage = existingImages.some(img => img.isMain);

      const createdImages = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const image = await storage.createProductImage({
          productId: req.params.productId,
          tenantId: req.user!.tenantId!,
          url: `/uploads/${file.filename}`,
          isMain: !hasMainImage && i === 0,
          sortOrder: existingImages.length + i,
        });
        createdImages.push(image);
      }

      res.status(201).json(createdImages);
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ message: "Ошибка загрузки изображений" });
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
      const images = await storage.getProductImages(req.params.productId, req.user!.tenantId!);
      const imageToDelete = images.find(img => img.id === req.params.imageId);
      
      if (imageToDelete) {
        const filePath = path.join(uploadsDir, path.basename(imageToDelete.url));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await storage.deleteProductImage(req.params.imageId, req.user!.tenantId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления изображения" });
    }
  });

  app.post("/api/upload", requireAuth, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }
      res.json({ url: `/uploads/${req.file.filename}` });
    } catch (error) {
      res.status(500).json({ message: "Ошибка загрузки файла" });
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

  app.get("/api/catalog-health", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts(req.user!.tenantId!);
      const categories = await storage.getCategories(req.user!.tenantId!);

      const productsWithoutImages = products.filter(p => !p.mainImageUrl);
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
        for (const [key, time] of eventRateLimit.entries()) {
          if (time < oneMinuteAgo) eventRateLimit.delete(key);
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

  // Serve OG meta tags for catalog pages (for messenger/social media previews)
  // Only intercept requests from bots/crawlers, let regular browsers go through Vite
  app.get("/c/:slug", async (req, res, next) => {
    const userAgent = req.get('user-agent') || '';
    
    // List of bot/crawler user agents that need OG meta tags
    const botPatterns = [
      'WhatsApp', 'TelegramBot', 'facebookexternalhit', 'Facebot',
      'LinkedInBot', 'Twitterbot', 'Slackbot', 'Discordbot',
      'vkShare', 'Googlebot', 'bingbot', 'yandex'
    ];
    
    const isBot = botPatterns.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
    
    if (!isBot) {
      return next(); // Let Vite handle regular browser requests
    }
    
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return next(); // Let Vite handle 404
      }
      
      const tenantData = tenant as any;
      const ogTitle = tenantData.ogTitle || tenant.name || "Каталог";
      const ogDescription = tenantData.ogDescription || tenant.description || "Онлайн-каталог товаров";
      const ogImage = tenantData.ogImageUrl || tenant.logoUrl || "";
      // Use https for production (Replit proxy uses x-forwarded-proto)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const baseUrl = `${protocol}://${req.get('host')}`;
      const fullUrl = `${baseUrl}/c/${tenant.slug}`;
      
      // Serve a minimal HTML page with OG meta tags for bots
      const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${fullUrl}" />
  ${ogImage ? `<meta property="og:image" content="${ogImage.startsWith('http') ? ogImage : baseUrl + ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  ${ogImage ? `<meta name="twitter:image" content="${ogImage.startsWith('http') ? ogImage : baseUrl + ogImage}" />` : ''}
  <meta name="description" content="${escapeHtml(ogDescription)}" />
</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p>${escapeHtml(ogDescription)}</p>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      next(); // Let Vite handle errors
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
      await storage.getOrCreateAiSettings(tenantId);
      const settings = await storage.updateAiSettings(tenantId, req.body);
      res.json(settings);
    } catch (error) {
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
          const [tenant, products, aiSettings, salesScripts, tagRules, faqItems, knowledge, policies, promotions, discounts] = await Promise.all([
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
            aiLanguage: (tenant as any).aiLanguage || "ru",
            aiSystemPrompt: (tenant as any).aiSystemPrompt || undefined,
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
    
    // Build category map
    const categoryMap = new Map<string, string>();
    categories.forEach(c => categoryMap.set(c.id, c.name));
    
    const context = {
      storeName: tenant.name,
      slug: tenant.slug,
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
      aiLanguage: (tenant as any).aiLanguage || "ru",
      aiSystemPrompt: (tenant as any).aiSystemPrompt || undefined,
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
