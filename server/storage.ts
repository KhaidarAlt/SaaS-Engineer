import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  users, tenants, subscriptions, plans, products, categories,
  discounts, promotions, orders, orderItems, analyticsEvents, cartSessions,
  subscriptionExtensions, knowledgeBase, auditLogs, carts, productVariants, productImages,
  aiSettings, aiSalesScripts, aiTagRules, aiKnowledgeArticles, aiFaqItems,
  aiPolicies, aiConversations, aiMessages, aiInterventionEvents, aiInboxTickets,
  wahaInstances, aiResponseCorrections, leads, passwordResetTokens, tenantLinks,
  type User, type InsertUser, type Tenant, type InsertTenant,
  type Subscription, type InsertSubscription, type Plan, type InsertPlan,
  type Product, type InsertProduct, type Category, type InsertCategory,
  type Discount, type InsertDiscount, type Promotion, type InsertPromotion,
  type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type AnalyticsEvent, type InsertAnalyticsEvent,
  type SubscriptionExtension, type InsertSubscriptionExtension,
  type ProductVariant, type InsertProductVariant,
  type ProductImage, type InsertProductImage,
  type CartSession, type InsertCartSession,
  type AiSettings, type InsertAiSettings,
  type AiSalesScript, type InsertAiSalesScript,
  type AiTagRule, type InsertAiTagRule,
  type AiKnowledgeArticle, type InsertAiKnowledgeArticle,
  type AiFaqItem, type InsertAiFaqItem,
  type AiPolicy, type InsertAiPolicy,
  type AiConversation, type InsertAiConversation,
  type AiMessage, type InsertAiMessage,
  type AiInterventionEvent, type InsertAiInterventionEvent,
  type AiInboxTicket, type InsertAiInboxTicket,
  type WahaInstance, type InsertWahaInstance,
  type Lead, type InsertLead,
  type AiResponseCorrection, type InsertAiResponseCorrection,
  type TenantLink, type InsertTenantLink,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  getPlan(id: string): Promise<Plan | undefined>;
  getPlans(): Promise<Plan[]>;
  getAllPlans(): Promise<Plan[]>;
  getDefaultPlan(): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  
  getSubscription(tenantId: string): Promise<(Subscription & { plan?: Plan }) | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  extendSubscription(subscriptionId: string, days: number, reason: string, addedBy: string): Promise<void>;
  
  getProducts(tenantId: string): Promise<Product[]>;
  getProduct(id: string, tenantId: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, tenantId: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string, tenantId: string): Promise<boolean>;
  
  getProductVariants(productId: string, tenantId: string): Promise<ProductVariant[]>;
  createProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  updateProductVariant(id: string, tenantId: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(id: string, tenantId: string): Promise<boolean>;
  
  getProductImages(productId: string, tenantId: string): Promise<ProductImage[]>;
  getAllProductImages(): Promise<ProductImage[]>;
  createProductImage(image: InsertProductImage): Promise<ProductImage>;
  updateProductImage(id: string, tenantId: string, data: Partial<InsertProductImage>): Promise<ProductImage | undefined>;
  updateProductImageUrl(id: string, newUrl: string): Promise<void>;
  deleteProductImage(id: string, tenantId: string): Promise<boolean>;
  setMainImage(productId: string, imageId: string, tenantId: string): Promise<void>;
  
  getCategories(tenantId: string): Promise<Category[]>;
  getCategory(id: string, tenantId: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, tenantId: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string, tenantId: string): Promise<boolean>;
  
  getDiscounts(tenantId: string): Promise<Discount[]>;
  createDiscount(discount: InsertDiscount): Promise<Discount>;
  updateDiscount(id: string, tenantId: string, data: Partial<InsertDiscount>): Promise<Discount | undefined>;
  deleteDiscount(id: string, tenantId: string): Promise<boolean>;
  
  getPromotions(tenantId: string): Promise<Promotion[]>;
  
  getOrders(tenantId: string): Promise<Order[]>;
  getOrder(id: string, tenantId: string): Promise<(Order & { items?: OrderItem[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: string, tenantId: string, status: string): Promise<Order | undefined>;
  
  logEvent(event: InsertAnalyticsEvent): Promise<void>;
  getAnalytics(tenantId: string): Promise<{
    totalVisits: number;
    uniqueVisitors: number;
    productViews: number;
    addToCart: number;
    checkoutStarts: number;
    ordersCreated: number;
    revenue: number;
    conversionRate: number;
    abandonedCarts: number;
    topProducts: Array<{ id: string; name: string; views: number; orders: number; revenue: number }>;
  }>;
  
  getAllTenants(): Promise<(Tenant & { subscription?: Subscription & { plan?: Plan }; ownerEmail?: string })[]>;
  getTenantStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    newTenantsThisMonth: number;
    expiringSubscriptions: number;
    totalUsers: number;
    totalRevenue: number;
  }>;
  
  changeSubscriptionPlan(subscriptionId: string, planId: string): Promise<void>;
  updatePlan(id: string, data: Partial<{
    name: string;
    price: number;
    maxProducts: number;
    maxCategories: number;
    maxPromotions: number;
    maxDiscountRules: number;
    maxManagers: number;
    maxWahaInstances: number;
    aiMessagesLimit: number;
    hasAiAccess: boolean;
    features: string[];
    isActive: boolean;
  }>): Promise<void>;
  getAllUsersWithDetails(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    storeName: string;
    slug: string;
    status: string;
    planName: string;
    planId: string;
    requestedPlanName?: string;
    requestedPlanId?: string;
    daysLeft: number;
    subscriptionEndsAt?: string;
    createdAt: string;
    tenantId: string;
  }>>;
  getFreeUsers(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    storeName: string;
    slug: string;
    createdAt: string;
    tenantId: string;
  }>>;
  getAllLeads(): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLeadStatus(id: string, status: string): Promise<void>;
  
  // Tenant Links (Link-in-Bio)
  getTenantLinks(tenantId: string): Promise<TenantLink[]>;
  getTenantLinksBySlug(slug: string): Promise<TenantLink[]>;
  createTenantLink(link: InsertTenantLink): Promise<TenantLink>;
  updateTenantLink(id: string, tenantId: string, data: Partial<InsertTenantLink>): Promise<TenantLink | undefined>;
  deleteTenantLink(id: string, tenantId: string): Promise<boolean>;
  reorderTenantLinks(tenantId: string, linkIds: string[]): Promise<void>;
  
  getPlanRequests(): Promise<Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    phone?: string;
    storeName: string;
    slug: string;
    currentPlanName: string;
    currentPlanId: string;
    requestedPlanName: string;
    requestedPlanId: string;
    requestedPlanPrice: number;
    createdAt: string;
    tenantId: string;
    subscriptionId: string;
  }>>;
  approvePlanRequest(subscriptionId: string, planId: string, durationDays: number): Promise<void>;
  
  setRequestedPlan(subscriptionId: string, planId: string | null): Promise<void>;
  markPlanPopupShown(userId: string): Promise<void>;
  
  getCartSession(tenantId: string, sessionId: string): Promise<CartSession | undefined>;
  upsertCartSession(data: InsertCartSession): Promise<CartSession>;
  updateCartSession(id: string, tenantId: string, data: Partial<InsertCartSession>): Promise<CartSession | undefined>;
  getCartSessions(tenantId: string, filters?: { status?: string; from?: Date; to?: Date }): Promise<CartSession[]>;
  markAbandonedCarts(thresholdHours: number): Promise<number>;
  
  getAnalyticsEvents(tenantId: string, from: Date, to: Date): Promise<AnalyticsEvent[]>;
  getAnalyticsOverview(tenantId: string, from: Date, to: Date): Promise<{
    visits: number;
    uniqueVisitors: number;
    productViews: number;
    addToCart: number;
    checkoutStarts: number;
    ordersCreated: number;
    whatsappClicks: number;
    revenue: number;
    avgCheck: number;
    abandonedCarts: number;
    conversionRate: number;
    cartConversion: number;
    whatsappConversion: number;
  }>;
  getProductAnalytics(tenantId: string, from: Date, to: Date): Promise<Array<{
    id: string;
    name: string;
    views: number;
    addToCart: number;
    orders: number;
    revenue: number;
    conversion: number;
  }>>;
  
  getTrafficSources(tenantId: string, from: Date, to: Date): Promise<{
    referrers: Array<{ source: string; visitors: number; percentage: number }>;
    utmSources: Array<{ source: string; medium: string; campaign: string; visitors: number; percentage: number }>;
    totalVisitors: number;
  }>;
  
  // Password reset
  createPasswordResetToken(data: { email: string; token: string; expiresAt: Date }): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ email: string; token: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      password: hashedPassword,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug.toLowerCase()));
    return tenant;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values({
      ...insertTenant,
      slug: insertTenant.slug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    }).returning();
    return tenant;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [tenant] = await db.update(tenants).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(tenants.id, id)).returning();
    return tenant;
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }

  async getPlans(): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.isActive, true));
  }

  async getAllPlans(): Promise<Plan[]> {
    return db.select().from(plans);
  }

  async getDefaultPlan(): Promise<Plan | undefined> {
    const allPlans = await this.getPlans();
    return allPlans[0];
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(insertPlan as any).returning();
    return plan;
  }

  async getSubscription(tenantId: string): Promise<(Subscription & { plan?: Plan }) | undefined> {
    const results = await db
      .select()
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    
    if (results.length === 0) return undefined;
    
    const { subscriptions: sub, plans: plan } = results[0];
    return { ...sub, plan: plan || undefined };
  }

  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values(insertSubscription).returning();
    return subscription;
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [subscription] = await db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning();
    return subscription;
  }

  async extendSubscription(subscriptionId: string, days: number, reason: string, addedBy: string): Promise<void> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    if (!sub) throw new Error("Subscription not found");

    const newEndDate = new Date(sub.endsAt);
    newEndDate.setDate(newEndDate.getDate() + days);

    await db.update(subscriptions).set({ endsAt: newEndDate }).where(eq(subscriptions.id, subscriptionId));
    await db.insert(subscriptionExtensions).values({
      subscriptionId,
      addedDays: days,
      reason,
      addedBy,
    });
  }

  async getProducts(tenantId: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.tenantId, tenantId)).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string, tenantId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct as any).returning();
    return product;
  }

  async updateProduct(id: string, tenantId: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set({
      ...data,
      updatedAt: new Date(),
    } as any).where(and(eq(products.id, id), eq(products.tenantId, tenantId))).returning();
    return product;
  }

  async deleteProduct(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async getProductVariants(productId: string, tenantId: string): Promise<ProductVariant[]> {
    return db.select().from(productVariants).where(
      and(eq(productVariants.productId, productId), eq(productVariants.tenantId, tenantId))
    );
  }

  async createProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const [created] = await db.insert(productVariants).values(variant).returning();
    return created;
  }

  async updateProductVariant(id: string, tenantId: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined> {
    const [updated] = await db.update(productVariants)
      .set(data)
      .where(and(eq(productVariants.id, id), eq(productVariants.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteProductVariant(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(productVariants).where(
      and(eq(productVariants.id, id), eq(productVariants.tenantId, tenantId))
    );
    return (result.rowCount || 0) > 0;
  }

  async getProductImages(productId: string, tenantId: string): Promise<ProductImage[]> {
    return db.select().from(productImages)
      .where(and(eq(productImages.productId, productId), eq(productImages.tenantId, tenantId)))
      .orderBy(productImages.sortOrder);
  }

  async getAllProductImages(): Promise<ProductImage[]> {
    return db.select().from(productImages);
  }

  async updateProductImageUrl(id: string, newUrl: string): Promise<void> {
    await db.update(productImages).set({ url: newUrl }).where(eq(productImages.id, id));
  }

  async createProductImage(image: InsertProductImage): Promise<ProductImage> {
    const [created] = await db.insert(productImages).values(image).returning();
    return created;
  }

  async updateProductImage(id: string, tenantId: string, data: Partial<InsertProductImage>): Promise<ProductImage | undefined> {
    const [updated] = await db.update(productImages)
      .set(data)
      .where(and(eq(productImages.id, id), eq(productImages.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteProductImage(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(productImages).where(
      and(eq(productImages.id, id), eq(productImages.tenantId, tenantId))
    );
    return (result.rowCount || 0) > 0;
  }

  async setMainImage(productId: string, imageId: string, tenantId: string): Promise<void> {
    await db.update(productImages)
      .set({ isMain: false })
      .where(and(eq(productImages.productId, productId), eq(productImages.tenantId, tenantId)));
    await db.update(productImages)
      .set({ isMain: true })
      .where(and(eq(productImages.id, imageId), eq(productImages.tenantId, tenantId)));
  }

  async getCategories(tenantId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.tenantId, tenantId)).orderBy(categories.sortOrder);
  }

  async getCategory(id: string, tenantId: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values({
      ...insertCategory,
      slug: insertCategory.name.toLowerCase().replace(/[^a-zа-яё0-9]/g, '-'),
    }).returning();
    return category;
  }

  async updateCategory(id: string, tenantId: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db.update(categories).set(data).where(and(eq(categories.id, id), eq(categories.tenantId, tenantId))).returning();
    return category;
  }

  async deleteCategory(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async getDiscounts(tenantId: string): Promise<Discount[]> {
    return db.select().from(discounts).where(eq(discounts.tenantId, tenantId)).orderBy(desc(discounts.priority));
  }

  async createDiscount(insertDiscount: InsertDiscount): Promise<Discount> {
    const [discount] = await db.insert(discounts).values(insertDiscount).returning();
    return discount;
  }

  async updateDiscount(id: string, tenantId: string, data: Partial<InsertDiscount>): Promise<Discount | undefined> {
    const [discount] = await db.update(discounts).set(data).where(and(eq(discounts.id, id), eq(discounts.tenantId, tenantId))).returning();
    return discount;
  }

  async deleteDiscount(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(discounts).where(and(eq(discounts.id, id), eq(discounts.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async getPromotions(tenantId: string): Promise<Promotion[]> {
    return db.select().from(promotions).where(eq(promotions.tenantId, tenantId)).orderBy(desc(promotions.priority));
  }

  async getOrders(tenantId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.tenantId, tenantId)).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string, tenantId: string): Promise<(Order & { items?: OrderItem[] }) | undefined> {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
    if (!order) return undefined;

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async createOrder(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    
    if (items.length > 0) {
      await db.insert(orderItems).values(items.map(item => ({
        ...item,
        orderId: order.id,
      })));
    }
    
    return order;
  }

  async updateOrderStatus(id: string, tenantId: string, status: string): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      status,
      updatedAt: new Date(),
    }).where(and(eq(orders.id, id), eq(orders.tenantId, tenantId))).returning();
    return order;
  }

  async logEvent(event: InsertAnalyticsEvent): Promise<void> {
    await db.insert(analyticsEvents).values(event);
  }

  async getAnalytics(tenantId: string): Promise<{
    totalVisits: number;
    uniqueVisitors: number;
    productViews: number;
    addToCart: number;
    checkoutStarts: number;
    ordersCreated: number;
    revenue: number;
    conversionRate: number;
    abandonedCarts: number;
    topProducts: Array<{ id: string; name: string; views: number; orders: number; revenue: number }>;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const events = await db.select().from(analyticsEvents)
      .where(and(eq(analyticsEvents.tenantId, tenantId), gte(analyticsEvents.createdAt, thirtyDaysAgo)));

    const allOrders = await db.select().from(orders)
      .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, thirtyDaysAgo)));

    const catalogViews = events.filter(e => e.eventType === 'catalog_view').length;
    const productViews = events.filter(e => e.eventType === 'product_view').length;
    const addToCart = events.filter(e => e.eventType === 'add_to_cart').length;
    const checkoutStarts = events.filter(e => e.eventType === 'checkout_start').length;
    const ordersCreated = allOrders.length;
    // Only count revenue from completed orders
    const completedOrders = allOrders.filter(o => o.status === 'completed');
    const revenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const uniqueSessions = new Set(events.map(e => e.sessionId).filter(Boolean));

    return {
      totalVisits: catalogViews,
      uniqueVisitors: uniqueSessions.size,
      productViews,
      addToCart,
      checkoutStarts,
      ordersCreated,
      revenue,
      conversionRate: catalogViews > 0 ? (ordersCreated / catalogViews) * 100 : 0,
      abandonedCarts: Math.max(0, checkoutStarts - ordersCreated),
      topProducts: [],
    };
  }

  async getAllTenants(): Promise<(Tenant & { subscription?: Subscription & { plan?: Plan }; ownerEmail?: string })[]> {
    const allTenants = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
    
    const results = await Promise.all(allTenants.map(async (tenant) => {
      const subscription = await this.getSubscription(tenant.id);
      const [owner] = await db.select().from(users).where(and(eq(users.tenantId, tenant.id), eq(users.role, 'owner')));
      return {
        ...tenant,
        subscription,
        ownerEmail: owner?.email,
        daysLeft: subscription?.endsAt ? Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined,
      };
    }));
    
    return results;
  }

  async getTenantStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    newTenantsThisMonth: number;
    expiringSubscriptions: number;
    totalUsers: number;
    totalRevenue: number;
  }> {
    const allTenants = await db.select().from(tenants);
    const allUsers = await db.select().from(users);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const activeTenants = allTenants.filter(t => t.status === 'active').length;
    const suspendedTenants = allTenants.filter(t => t.status === 'suspended').length;
    const newTenantsThisMonth = allTenants.filter(t => new Date(t.createdAt) >= thisMonth).length;

    const allSubscriptions = await db.select().from(subscriptions);
    const expiringSubscriptions = allSubscriptions.filter(s => 
      s.status === 'active' && new Date(s.endsAt) <= sevenDaysFromNow
    ).length;

    return {
      totalTenants: allTenants.length,
      activeTenants,
      suspendedTenants,
      newTenantsThisMonth,
      expiringSubscriptions,
      totalUsers: allUsers.length,
      totalRevenue: 0,
    };
  }

  async getCartSession(tenantId: string, sessionId: string): Promise<CartSession | undefined> {
    const [session] = await db.select().from(cartSessions)
      .where(and(eq(cartSessions.tenantId, tenantId), eq(cartSessions.sessionId, sessionId)));
    return session;
  }

  async upsertCartSession(data: InsertCartSession): Promise<CartSession> {
    const existing = await this.getCartSession(data.tenantId, data.sessionId);
    if (existing) {
      const [updated] = await db.update(cartSessions)
        .set({ ...data, lastActivityAt: new Date() } as any)
        .where(eq(cartSessions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cartSessions).values(data as any).returning();
    return created;
  }

  async updateCartSession(id: string, tenantId: string, data: Partial<InsertCartSession>): Promise<CartSession | undefined> {
    const [updated] = await db.update(cartSessions)
      .set({ ...data, lastActivityAt: new Date() } as any)
      .where(and(eq(cartSessions.id, id), eq(cartSessions.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async getCartSessions(tenantId: string, filters?: { status?: string; from?: Date; to?: Date }): Promise<CartSession[]> {
    let query = db.select().from(cartSessions).where(eq(cartSessions.tenantId, tenantId));
    
    const conditions = [eq(cartSessions.tenantId, tenantId)];
    if (filters?.status) conditions.push(eq(cartSessions.status, filters.status));
    if (filters?.from) conditions.push(gte(cartSessions.lastActivityAt, filters.from));
    if (filters?.to) conditions.push(lte(cartSessions.lastActivityAt, filters.to));
    
    return db.select().from(cartSessions)
      .where(and(...conditions))
      .orderBy(desc(cartSessions.lastActivityAt));
  }

  async markAbandonedCarts(thresholdHours: number): Promise<number> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - thresholdHours);
    
    const result = await db.update(cartSessions)
      .set({ status: 'abandoned' })
      .where(and(
        eq(cartSessions.status, 'active'),
        lte(cartSessions.lastActivityAt, threshold)
      ));
    return result.rowCount || 0;
  }

  async getAnalyticsEvents(tenantId: string, from: Date, to: Date): Promise<AnalyticsEvent[]> {
    return db.select().from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.tenantId, tenantId),
        gte(analyticsEvents.createdAt, from),
        lte(analyticsEvents.createdAt, to)
      ))
      .orderBy(desc(analyticsEvents.createdAt));
  }

  async getAnalyticsOverview(tenantId: string, from: Date, to: Date): Promise<{
    visits: number;
    uniqueVisitors: number;
    productViews: number;
    addToCart: number;
    checkoutStarts: number;
    ordersCreated: number;
    whatsappClicks: number;
    revenue: number;
    avgCheck: number;
    abandonedCarts: number;
    conversionRate: number;
    cartConversion: number;
    whatsappConversion: number;
  }> {
    const events = await this.getAnalyticsEvents(tenantId, from, to);
    const periodOrders = await db.select().from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      ));
    
    const abandoned = await db.select().from(cartSessions)
      .where(and(
        eq(cartSessions.tenantId, tenantId),
        eq(cartSessions.status, 'abandoned'),
        gte(cartSessions.lastActivityAt, from),
        lte(cartSessions.lastActivityAt, to)
      ));

    const visits = events.filter(e => e.eventType === 'catalog_view').length;
    const uniqueVisitors = new Set(events.filter(e => e.eventType === 'catalog_view').map(e => e.visitorId || e.sessionId)).size;
    const productViews = events.filter(e => e.eventType === 'product_view').length;
    const addToCart = events.filter(e => e.eventType === 'add_to_cart').length;
    const checkoutStarts = events.filter(e => e.eventType === 'checkout_start').length;
    const ordersCreated = periodOrders.length;
    const whatsappClicks = events.filter(e => e.eventType === 'whatsapp_open_clicked').length;
    
    const completedOrders = periodOrders.filter(o => o.status !== 'cancelled');
    const revenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const avgCheck = ordersCreated > 0 ? revenue / ordersCreated : 0;

    return {
      visits,
      uniqueVisitors,
      productViews,
      addToCart,
      checkoutStarts,
      ordersCreated,
      whatsappClicks,
      revenue,
      avgCheck,
      abandonedCarts: abandoned.length,
      conversionRate: uniqueVisitors > 0 ? (ordersCreated / uniqueVisitors) * 100 : 0,
      cartConversion: uniqueVisitors > 0 ? (new Set(events.filter(e => e.eventType === 'add_to_cart').map(e => e.sessionId)).size / uniqueVisitors) * 100 : 0,
      whatsappConversion: ordersCreated > 0 ? (whatsappClicks / ordersCreated) * 100 : 0,
    };
  }

  async getProductAnalytics(tenantId: string, from: Date, to: Date): Promise<Array<{
    id: string;
    name: string;
    views: number;
    addToCart: number;
    orders: number;
    revenue: number;
    conversion: number;
  }>> {
    const events = await this.getAnalyticsEvents(tenantId, from, to);
    const allProducts = await db.select().from(products).where(eq(products.tenantId, tenantId));
    const periodOrders = await db.select().from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to)
      ));
    const periodOrderItems = periodOrders.length > 0 
      ? await db.select().from(orderItems).where(sql`${orderItems.orderId} IN (${sql.join(periodOrders.map(o => sql`${o.id}`), sql`,`)})`)
      : [];

    const productStats = new Map<string, { views: number; addToCart: number; orders: number; revenue: number }>();
    
    events.forEach(e => {
      if (e.productId && (e.eventType === 'product_view' || e.eventType === 'add_to_cart')) {
        const stats = productStats.get(e.productId) || { views: 0, addToCart: 0, orders: 0, revenue: 0 };
        if (e.eventType === 'product_view') stats.views++;
        if (e.eventType === 'add_to_cart') stats.addToCart++;
        productStats.set(e.productId, stats);
      }
    });

    periodOrderItems.forEach(item => {
      const stats = productStats.get(item.productId) || { views: 0, addToCart: 0, orders: 0, revenue: 0 };
      stats.orders += item.quantity;
      stats.revenue += parseFloat(item.total);
      productStats.set(item.productId, stats);
    });

    return allProducts
      .map(p => {
        const stats = productStats.get(p.id) || { views: 0, addToCart: 0, orders: 0, revenue: 0 };
        return {
          id: p.id,
          name: p.name,
          views: stats.views,
          addToCart: stats.addToCart,
          orders: stats.orders,
          revenue: stats.revenue,
          conversion: stats.views > 0 ? (stats.orders / stats.views) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getTrafficSources(tenantId: string, from: Date, to: Date): Promise<{
    referrers: Array<{ source: string; visitors: number; percentage: number }>;
    utmSources: Array<{ source: string; medium: string; campaign: string; visitors: number; percentage: number }>;
    totalVisitors: number;
  }> {
    const events = await this.getAnalyticsEvents(tenantId, from, to);
    
    // Count unique visitors
    const uniqueVisitorIds = new Set(events.map(e => e.visitorId).filter(Boolean));
    const totalVisitors = uniqueVisitorIds.size;
    
    // Group by referrer
    const referrerMap = new Map<string, Set<string>>();
    events.forEach(e => {
      if (e.visitorId) {
        const referrer = e.referrer || 'Прямой переход';
        // Parse domain from referrer URL
        let source = referrer;
        try {
          if (referrer !== 'Прямой переход' && referrer.startsWith('http')) {
            source = new URL(referrer).hostname;
          }
        } catch {}
        
        if (!referrerMap.has(source)) {
          referrerMap.set(source, new Set());
        }
        referrerMap.get(source)!.add(e.visitorId);
      }
    });
    
    const referrers = Array.from(referrerMap.entries())
      .map(([source, visitors]) => ({
        source,
        visitors: visitors.size,
        percentage: totalVisitors > 0 ? Math.round((visitors.size / totalVisitors) * 100) : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10);
    
    // Group by UTM parameters
    const utmMap = new Map<string, Set<string>>();
    events.forEach(e => {
      if (e.visitorId && (e.utmSource || e.utmMedium || e.utmCampaign)) {
        const key = `${e.utmSource || '-'}|${e.utmMedium || '-'}|${e.utmCampaign || '-'}`;
        if (!utmMap.has(key)) {
          utmMap.set(key, new Set());
        }
        utmMap.get(key)!.add(e.visitorId);
      }
    });
    
    const utmSources = Array.from(utmMap.entries())
      .map(([key, visitors]) => {
        const [source, medium, campaign] = key.split('|');
        return {
          source,
          medium,
          campaign,
          visitors: visitors.size,
          percentage: totalVisitors > 0 ? Math.round((visitors.size / totalVisitors) * 100) : 0,
        };
      })
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10);
    
    return { referrers, utmSources, totalVisitors };
  }

  // ============ AI SETTINGS ============
  async getAiSettings(tenantId: string): Promise<AiSettings | undefined> {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.tenantId, tenantId));
    return settings;
  }

  async createAiSettings(data: InsertAiSettings): Promise<AiSettings> {
    const [settings] = await db.insert(aiSettings).values(data as any).returning();
    return settings;
  }

  async updateAiSettings(tenantId: string, data: Partial<InsertAiSettings>): Promise<AiSettings | undefined> {
    const [settings] = await db.update(aiSettings)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(aiSettings.tenantId, tenantId))
      .returning();
    return settings;
  }

  async getOrCreateAiSettings(tenantId: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(tenantId);
    if (existing) return existing;
    return this.createAiSettings({ tenantId, enabled: false });
  }

  // ============ AI SALES SCRIPTS ============
  async getAiSalesScripts(tenantId: string): Promise<AiSalesScript[]> {
    return db.select().from(aiSalesScripts)
      .where(eq(aiSalesScripts.tenantId, tenantId))
      .orderBy(desc(aiSalesScripts.version));
  }

  async getActiveAiSalesScript(tenantId: string): Promise<AiSalesScript | undefined> {
    const [script] = await db.select().from(aiSalesScripts)
      .where(and(eq(aiSalesScripts.tenantId, tenantId), eq(aiSalesScripts.isActive, true)));
    return script;
  }

  async createAiSalesScript(data: InsertAiSalesScript): Promise<AiSalesScript> {
    const existing = await this.getAiSalesScripts(data.tenantId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map(s => s.version)) + 1 : 1;
    const [script] = await db.insert(aiSalesScripts).values({ ...data, version: nextVersion } as any).returning();
    return script;
  }

  async setActiveAiSalesScript(id: string, tenantId: string): Promise<void> {
    await db.update(aiSalesScripts).set({ isActive: false }).where(eq(aiSalesScripts.tenantId, tenantId));
    await db.update(aiSalesScripts).set({ isActive: true }).where(and(eq(aiSalesScripts.id, id), eq(aiSalesScripts.tenantId, tenantId)));
  }

  // ============ AI TAG RULES ============
  async getAiTagRules(tenantId: string): Promise<AiTagRule[]> {
    return db.select().from(aiTagRules)
      .where(eq(aiTagRules.tenantId, tenantId))
      .orderBy(desc(aiTagRules.priority));
  }

  async createAiTagRule(data: InsertAiTagRule): Promise<AiTagRule> {
    const [rule] = await db.insert(aiTagRules).values(data as any).returning();
    return rule;
  }

  async updateAiTagRule(id: string, tenantId: string, data: Partial<InsertAiTagRule>): Promise<AiTagRule | undefined> {
    const [rule] = await db.update(aiTagRules)
      .set(data as any)
      .where(and(eq(aiTagRules.id, id), eq(aiTagRules.tenantId, tenantId)))
      .returning();
    return rule;
  }

  async deleteAiTagRule(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(aiTagRules)
      .where(and(eq(aiTagRules.id, id), eq(aiTagRules.tenantId, tenantId)));
    return true;
  }

  async ensureDefaultTags(tenantId: string): Promise<void> {
    const existing = await this.getAiTagRules(tenantId);
    if (existing.length > 0) return;

    const defaultTags: InsertAiTagRule[] = [
      { tenantId, tag: "handoff_human", displayName: "Переведи на человека", keywordsJson: ["хочу человека", "живой оператор", "позови менеджера", "переведи на менеджера"], priority: 100, action: "handoff" },
      { tenantId, tag: "handoff_manager", displayName: "Хочу менеджера", keywordsJson: ["хочу поговорить с менеджером", "нужен менеджер", "где менеджер"], priority: 100, action: "handoff" },
      { tenantId, tag: "no_answer", displayName: "Нет ответа от ИИ", keywordsJson: [], priority: 50, action: "notify" },
      { tenantId, tag: "catalog", displayName: "Каталог", keywordsJson: ["покажи каталог", "весь ассортимент", "что есть", "все товары"], priority: 30, action: "send_catalog_link" },
      { tenantId, tag: "complaint", displayName: "Жалоба/Негатив", keywordsJson: ["это ужасно", "отвратительно", "жалоба", "негатив", "плохо", "ужас"], priority: 90, action: "handoff" },
      { tenantId, tag: "delivery", displayName: "Доставка", keywordsJson: ["доставка", "когда привезут", "как доставляете", "сроки доставки"], priority: 20, action: "none" },
      { tenantId, tag: "payment", displayName: "Оплата", keywordsJson: ["как оплатить", "способы оплаты", "карта", "наличные", "каспи"], priority: 20, action: "none" },
      { tenantId, tag: "return", displayName: "Возврат/Гарантия", keywordsJson: ["возврат", "гарантия", "обмен", "вернуть деньги"], priority: 20, action: "none" },
    ];

    for (const tag of defaultTags) {
      await this.createAiTagRule(tag);
    }
  }

  // ============ AI KNOWLEDGE ARTICLES ============
  async getAiKnowledgeArticles(tenantId: string): Promise<AiKnowledgeArticle[]> {
    return db.select().from(aiKnowledgeArticles)
      .where(eq(aiKnowledgeArticles.tenantId, tenantId))
      .orderBy(desc(aiKnowledgeArticles.updatedAt));
  }

  async getAiKnowledgeArticle(id: string, tenantId: string): Promise<AiKnowledgeArticle | undefined> {
    const [article] = await db.select().from(aiKnowledgeArticles)
      .where(and(eq(aiKnowledgeArticles.id, id), eq(aiKnowledgeArticles.tenantId, tenantId)));
    return article;
  }

  async createAiKnowledgeArticle(data: InsertAiKnowledgeArticle): Promise<AiKnowledgeArticle> {
    const [article] = await db.insert(aiKnowledgeArticles).values(data).returning();
    return article;
  }

  async updateAiKnowledgeArticle(id: string, tenantId: string, data: Partial<InsertAiKnowledgeArticle>): Promise<AiKnowledgeArticle | undefined> {
    const [article] = await db.update(aiKnowledgeArticles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aiKnowledgeArticles.id, id), eq(aiKnowledgeArticles.tenantId, tenantId)))
      .returning();
    return article;
  }

  async deleteAiKnowledgeArticle(id: string, tenantId: string): Promise<boolean> {
    await db.delete(aiKnowledgeArticles)
      .where(and(eq(aiKnowledgeArticles.id, id), eq(aiKnowledgeArticles.tenantId, tenantId)));
    return true;
  }

  // ============ AI FAQ ============
  async getAiFaqItems(tenantId: string): Promise<AiFaqItem[]> {
    return db.select().from(aiFaqItems)
      .where(eq(aiFaqItems.tenantId, tenantId))
      .orderBy(aiFaqItems.sortOrder);
  }

  async createAiFaqItem(data: InsertAiFaqItem): Promise<AiFaqItem> {
    const [item] = await db.insert(aiFaqItems).values(data).returning();
    return item;
  }

  async updateAiFaqItem(id: string, tenantId: string, data: Partial<InsertAiFaqItem>): Promise<AiFaqItem | undefined> {
    const [item] = await db.update(aiFaqItems)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aiFaqItems.id, id), eq(aiFaqItems.tenantId, tenantId)))
      .returning();
    return item;
  }

  async deleteAiFaqItem(id: string, tenantId: string): Promise<boolean> {
    await db.delete(aiFaqItems)
      .where(and(eq(aiFaqItems.id, id), eq(aiFaqItems.tenantId, tenantId)));
    return true;
  }

  // ============ AI POLICIES ============
  async getAiPolicies(tenantId: string): Promise<AiPolicy | undefined> {
    const [policy] = await db.select().from(aiPolicies).where(eq(aiPolicies.tenantId, tenantId));
    return policy;
  }

  async getOrCreateAiPolicies(tenantId: string): Promise<AiPolicy> {
    const existing = await this.getAiPolicies(tenantId);
    if (existing) return existing;
    const [policy] = await db.insert(aiPolicies).values({ tenantId }).returning();
    return policy;
  }

  async updateAiPolicies(tenantId: string, data: Partial<InsertAiPolicy>): Promise<AiPolicy | undefined> {
    const [policy] = await db.update(aiPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiPolicies.tenantId, tenantId))
      .returning();
    return policy;
  }

  // ============ AI CONVERSATIONS ============
  async getAiConversations(tenantId: string, limit = 50): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(eq(aiConversations.tenantId, tenantId))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(limit);
  }

  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conv;
  }

  async getAiConversationByPhone(tenantId: string, customerPhone: string, channel: string = "whatsapp"): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.tenantId, tenantId),
        eq(aiConversations.customerPhone, customerPhone),
        eq(aiConversations.channel, channel),
        eq(aiConversations.status, "open")
      ))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(1);
    return conv;
  }

  async createAiConversation(data: InsertAiConversation): Promise<AiConversation> {
    const [conv] = await db.insert(aiConversations).values(data).returning();
    return conv;
  }

  async updateAiConversation(id: string, data: Partial<InsertAiConversation>): Promise<AiConversation | undefined> {
    const [conv] = await db.update(aiConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiConversations.id, id))
      .returning();
    return conv;
  }

  // ============ AI MESSAGES ============
  async getAiMessages(conversationId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);
  }

  async createAiMessage(data: InsertAiMessage): Promise<AiMessage> {
    const [msg] = await db.insert(aiMessages).values(data).returning();
    await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, data.conversationId));
    return msg;
  }

  async updateAiMessage(id: string, data: { content: string }): Promise<AiMessage | undefined> {
    const [msg] = await db.update(aiMessages)
      .set({ content: data.content })
      .where(eq(aiMessages.id, id))
      .returning();
    return msg;
  }

  async updateAiMessageSecure(messageId: string, tenantId: string, data: { content: string }): Promise<AiMessage | undefined> {
    // First verify the message belongs to a conversation owned by this tenant
    const [message] = await db.select().from(aiMessages).where(eq(aiMessages.id, messageId));
    if (!message) return undefined;
    
    const [conversation] = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.id, message.conversationId),
        eq(aiConversations.tenantId, tenantId)
      ));
    
    if (!conversation) return undefined;
    
    // Now safe to update
    const [updated] = await db.update(aiMessages)
      .set({ content: data.content })
      .where(eq(aiMessages.id, messageId))
      .returning();
    return updated;
  }

  // ============ AI RESPONSE CORRECTIONS ============
  async getAiResponseCorrections(tenantId: string): Promise<AiResponseCorrection[]> {
    return db.select().from(aiResponseCorrections)
      .where(and(
        eq(aiResponseCorrections.tenantId, tenantId),
        eq(aiResponseCorrections.isActive, true)
      ))
      .orderBy(desc(aiResponseCorrections.createdAt));
  }

  async createAiResponseCorrection(data: InsertAiResponseCorrection): Promise<AiResponseCorrection> {
    const [correction] = await db.insert(aiResponseCorrections).values(data).returning();
    return correction;
  }

  async findMatchingCorrection(tenantId: string, userMessage: string): Promise<AiResponseCorrection | undefined> {
    const corrections = await this.getAiResponseCorrections(tenantId);
    const lowerMessage = userMessage.toLowerCase().trim();
    
    for (const correction of corrections) {
      const pattern = correction.userMessagePattern.toLowerCase().trim();
      if (lowerMessage.includes(pattern) || pattern.includes(lowerMessage) || 
          this.calculateSimilarity(lowerMessage, pattern) > 0.7) {
        await db.update(aiResponseCorrections)
          .set({ usageCount: sql`${aiResponseCorrections.usageCount} + 1` })
          .where(eq(aiResponseCorrections.id, correction.id));
        return correction;
      }
    }
    return undefined;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const arr1 = Array.from(set1);
    const intersection = arr1.filter(x => set2.has(x)).length;
    const unionSet = new Set(words1.concat(words2));
    const union = unionSet.size;
    return union > 0 ? intersection / union : 0;
  }

  // ============ AI INTERVENTION EVENTS ============
  async createAiInterventionEvent(data: InsertAiInterventionEvent): Promise<AiInterventionEvent> {
    const [event] = await db.insert(aiInterventionEvents).values(data).returning();
    return event;
  }

  async getAiInterventionEvents(tenantId: string, from: Date, to: Date): Promise<AiInterventionEvent[]> {
    return db.select().from(aiInterventionEvents)
      .where(and(
        eq(aiInterventionEvents.tenantId, tenantId),
        gte(aiInterventionEvents.createdAt, from),
        lte(aiInterventionEvents.createdAt, to)
      ))
      .orderBy(desc(aiInterventionEvents.createdAt));
  }

  // ============ AI INBOX TICKETS ============
  async getAiInboxTickets(tenantId: string, status?: string): Promise<AiInboxTicket[]> {
    if (status) {
      return db.select().from(aiInboxTickets)
        .where(and(eq(aiInboxTickets.tenantId, tenantId), eq(aiInboxTickets.status, status)))
        .orderBy(desc(aiInboxTickets.createdAt));
    }
    return db.select().from(aiInboxTickets)
      .where(eq(aiInboxTickets.tenantId, tenantId))
      .orderBy(desc(aiInboxTickets.createdAt));
  }

  async createAiInboxTicket(data: InsertAiInboxTicket): Promise<AiInboxTicket> {
    const [ticket] = await db.insert(aiInboxTickets).values(data).returning();
    return ticket;
  }

  async updateAiInboxTicket(id: string, tenantId: string, data: Partial<InsertAiInboxTicket>): Promise<AiInboxTicket | undefined> {
    const [ticket] = await db.update(aiInboxTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aiInboxTickets.id, id), eq(aiInboxTickets.tenantId, tenantId)))
      .returning();
    return ticket;
  }

  // ============ AI ANALYTICS ============
  async getAiAnalytics(tenantId: string, from: Date, to: Date): Promise<{
    totalConversations: number;
    handoffs: number;
    noAnswers: number;
    complaints: number;
    ordersFromAi: number;
    avgMessagesPerConversation: number;
    interventionsByType: Record<string, number>;
  }> {
    const conversations = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.tenantId, tenantId),
        gte(aiConversations.createdAt, from),
        lte(aiConversations.createdAt, to)
      ));

    const events = await this.getAiInterventionEvents(tenantId, from, to);
    
    const interventionsByType: Record<string, number> = {};
    events.forEach(e => {
      interventionsByType[e.type] = (interventionsByType[e.type] || 0) + 1;
    });

    const messages = conversations.length > 0
      ? await db.select().from(aiMessages).where(sql`${aiMessages.conversationId} IN (${sql.join(conversations.map(c => sql`${c.id}`), sql`,`)})`)
      : [];

    return {
      totalConversations: conversations.length,
      handoffs: events.filter(e => e.type === 'handoff_requested' || e.type === 'tag_triggered').length,
      noAnswers: events.filter(e => e.type === 'no_answer').length,
      complaints: events.filter(e => e.type === 'complaint').length,
      ordersFromAi: 0, // TODO: track orders created from AI conversations
      avgMessagesPerConversation: conversations.length > 0 ? messages.length / conversations.length : 0,
      interventionsByType,
    };
  }

  async getAiReadinessStatus(tenantId: string): Promise<{
    salesScriptConfigured: boolean;
    tagsConfigured: boolean;
    faqConfigured: boolean;
    knowledgeConfigured: boolean;
    policiesConfigured: boolean;
    overallProgress: number;
  }> {
    const [scripts, tags, faqs, articles, policies] = await Promise.all([
      this.getAiSalesScripts(tenantId),
      this.getAiTagRules(tenantId),
      this.getAiFaqItems(tenantId),
      this.getAiKnowledgeArticles(tenantId),
      this.getAiPolicies(tenantId),
    ]);

    const salesScriptConfigured = scripts.some(s => s.isActive);
    const tagsConfigured = tags.length >= 3;
    const faqConfigured = faqs.filter(f => f.isPublished).length >= 5;
    const knowledgeConfigured = articles.filter(a => a.isPublished).length >= 1;
    const policiesConfigured = !!policies;

    const completed = [salesScriptConfigured, tagsConfigured, faqConfigured, knowledgeConfigured, policiesConfigured].filter(Boolean).length;
    const overallProgress = Math.round((completed / 5) * 100);

    return { salesScriptConfigured, tagsConfigured, faqConfigured, knowledgeConfigured, policiesConfigured, overallProgress };
  }

  // ============ WAHA INSTANCES ============
  async getWahaInstances(tenantId: string): Promise<WahaInstance[]> {
    return db.select().from(wahaInstances)
      .where(eq(wahaInstances.tenantId, tenantId))
      .orderBy(desc(wahaInstances.createdAt));
  }

  async getWahaInstance(id: string, tenantId: string): Promise<WahaInstance | undefined> {
    const [instance] = await db.select().from(wahaInstances)
      .where(and(eq(wahaInstances.id, id), eq(wahaInstances.tenantId, tenantId)));
    return instance;
  }

  async getWahaInstanceByName(instanceName: string): Promise<WahaInstance | undefined> {
    const [instance] = await db.select().from(wahaInstances)
      .where(eq(wahaInstances.instanceName, instanceName));
    return instance;
  }

  async createWahaInstance(data: InsertWahaInstance): Promise<WahaInstance> {
    const [instance] = await db.insert(wahaInstances).values(data as any).returning();
    return instance;
  }

  async updateWahaInstance(id: string, tenantId: string, data: Partial<InsertWahaInstance>): Promise<WahaInstance | undefined> {
    const [instance] = await db.update(wahaInstances)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(wahaInstances.id, id), eq(wahaInstances.tenantId, tenantId)))
      .returning();
    return instance;
  }

  async deleteWahaInstance(id: string, tenantId: string): Promise<boolean> {
    await db.delete(wahaInstances)
      .where(and(eq(wahaInstances.id, id), eq(wahaInstances.tenantId, tenantId)));
    return true;
  }

  async countWahaInstances(tenantId: string): Promise<number> {
    const instances = await db.select().from(wahaInstances)
      .where(and(eq(wahaInstances.tenantId, tenantId), eq(wahaInstances.isActive, true)));
    return instances.length;
  }

  // ============ ADMIN: PLAN MANAGEMENT ============
  async changeSubscriptionPlan(subscriptionId: string, planId: string): Promise<void> {
    await db.update(subscriptions)
      .set({ planId, requestedPlanId: null } as any)
      .where(eq(subscriptions.id, subscriptionId));
  }

  async updatePlan(id: string, data: Partial<{
    name: string;
    price: number;
    maxProducts: number;
    maxCategories: number;
    maxPromotions: number;
    maxDiscountRules: number;
    maxManagers: number;
    maxWahaInstances: number;
    aiMessagesLimit: number;
    hasAiAccess: boolean;
    features: string[];
    isActive: boolean;
  }>): Promise<void> {
    await db.update(plans)
      .set(data as any)
      .where(eq(plans.id, id));
  }

  async setRequestedPlan(subscriptionId: string, planId: string | null): Promise<void> {
    await db.update(subscriptions)
      .set({ requestedPlanId: planId } as any)
      .where(eq(subscriptions.id, subscriptionId));
  }

  async markPlanPopupShown(userId: string): Promise<void> {
    await db.update(users)
      .set({ planPopupShown: true } as any)
      .where(eq(users.id, userId));
  }

  // ============ ADMIN: USER MANAGEMENT ============
  async getAllUsersWithDetails(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    storeName: string;
    slug: string;
    status: string;
    planName: string;
    planId: string;
    requestedPlanName?: string;
    requestedPlanId?: string;
    daysLeft: number;
    subscriptionEndsAt?: string;
    createdAt: string;
    tenantId: string;
  }>> {
    const allUsers = await db.select().from(users)
      .where(eq(users.role, "owner"))
      .orderBy(desc(users.createdAt));
    
    const result = [];
    for (const user of allUsers) {
      if (!user.tenantId) continue;
      
      const tenant = await this.getTenant(user.tenantId);
      if (!tenant) continue;
      
      const subscription = await this.getSubscription(user.tenantId);
      if (!subscription) continue;
      
      // Skip free plan users (price = 0)
      if (subscription.plan && subscription.plan.price === 0) continue;
      
      const daysLeft = subscription.endsAt 
        ? Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;
      
      let requestedPlanName: string | undefined;
      if ((subscription as any).requestedPlanId) {
        const requestedPlan = await db.select().from(plans).where(eq(plans.id, (subscription as any).requestedPlanId));
        if (requestedPlan.length > 0) {
          requestedPlanName = requestedPlan[0].name;
        }
      }
      
      result.push({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: tenant.contactPhone || undefined,
        storeName: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        planName: subscription.plan?.name || "Без тарифа",
        planId: subscription.planId,
        requestedPlanName,
        requestedPlanId: (subscription as any).requestedPlanId,
        daysLeft,
        subscriptionEndsAt: subscription.endsAt?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        tenantId: user.tenantId,
      });
    }
    
    return result;
  }

  async getFreeUsers(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    storeName: string;
    slug: string;
    createdAt: string;
    tenantId: string;
  }>> {
    // Get the free plan (price = 0)
    const freePlans = await db.select().from(plans).where(eq(plans.price, 0));
    if (freePlans.length === 0) return [];
    
    const freePlanIds = freePlans.map(p => p.id);
    
    const allUsers = await db.select().from(users)
      .where(eq(users.role, "owner"))
      .orderBy(desc(users.createdAt));
    
    const result = [];
    for (const user of allUsers) {
      if (!user.tenantId) continue;
      
      const tenant = await this.getTenant(user.tenantId);
      if (!tenant) continue;
      
      const subscription = await this.getSubscription(user.tenantId);
      if (!subscription || !freePlanIds.includes(subscription.planId)) continue;
      
      result.push({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: tenant.contactPhone || undefined,
        storeName: tenant.name,
        slug: tenant.slug,
        createdAt: user.createdAt.toISOString(),
        tenantId: user.tenantId,
      });
    }
    
    return result;
  }

  // ============ ADMIN: LEADS ============
  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead as any).returning();
    return newLead;
  }

  async updateLeadStatus(id: string, status: string): Promise<void> {
    await db.update(leads)
      .set({ status } as any)
      .where(eq(leads.id, id));
  }

  // ============ TENANT LINKS (Link-in-Bio) ============
  async getTenantLinks(tenantId: string): Promise<TenantLink[]> {
    return await db.select().from(tenantLinks)
      .where(eq(tenantLinks.tenantId, tenantId))
      .orderBy(tenantLinks.sortOrder);
  }

  async getTenantLinksBySlug(slug: string): Promise<TenantLink[]> {
    const tenant = await this.getTenantBySlug(slug);
    if (!tenant) return [];
    return await db.select().from(tenantLinks)
      .where(and(
        eq(tenantLinks.tenantId, tenant.id),
        eq(tenantLinks.isActive, true)
      ))
      .orderBy(tenantLinks.sortOrder);
  }

  async createTenantLink(link: InsertTenantLink): Promise<TenantLink> {
    const existingLinks = await this.getTenantLinks(link.tenantId);
    const maxOrder = existingLinks.length > 0 
      ? Math.max(...existingLinks.map(l => l.sortOrder)) + 1 
      : 0;
    const [newLink] = await db.insert(tenantLinks)
      .values({ ...link, sortOrder: link.sortOrder ?? maxOrder } as any)
      .returning();
    return newLink;
  }

  async updateTenantLink(id: string, tenantId: string, data: Partial<InsertTenantLink>): Promise<TenantLink | undefined> {
    const [updated] = await db.update(tenantLinks)
      .set(data as any)
      .where(and(eq(tenantLinks.id, id), eq(tenantLinks.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteTenantLink(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(tenantLinks)
      .where(and(eq(tenantLinks.id, id), eq(tenantLinks.tenantId, tenantId)));
    return true;
  }

  async reorderTenantLinks(tenantId: string, linkIds: string[]): Promise<void> {
    for (let i = 0; i < linkIds.length; i++) {
      await db.update(tenantLinks)
        .set({ sortOrder: i } as any)
        .where(and(eq(tenantLinks.id, linkIds[i]), eq(tenantLinks.tenantId, tenantId)));
    }
  }

  // ============ PLAN REQUESTS ============
  async getPlanRequests(): Promise<Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    phone?: string;
    storeName: string;
    slug: string;
    currentPlanName: string;
    currentPlanId: string;
    requestedPlanName: string;
    requestedPlanId: string;
    requestedPlanPrice: number;
    createdAt: string;
    tenantId: string;
    subscriptionId: string;
  }>> {
    const allUsers = await db.select().from(users)
      .where(eq(users.role, "owner"))
      .orderBy(desc(users.createdAt));
    
    const result = [];
    for (const user of allUsers) {
      if (!user.tenantId) continue;
      
      const tenant = await this.getTenant(user.tenantId);
      if (!tenant) continue;
      
      const subscription = await this.getSubscription(user.tenantId);
      if (!subscription) continue;
      
      const requestedPlanId = (subscription as any).requestedPlanId;
      if (!requestedPlanId) continue;
      
      const [requestedPlan] = await db.select().from(plans).where(eq(plans.id, requestedPlanId));
      if (!requestedPlan) continue;
      
      const currentPlan = subscription.plan;
      
      result.push({
        id: `${subscription.id}-${requestedPlanId}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        phone: tenant.contactPhone || undefined,
        storeName: tenant.name,
        slug: tenant.slug,
        currentPlanName: currentPlan?.name || "Без тарифа",
        currentPlanId: subscription.planId,
        requestedPlanName: requestedPlan.name,
        requestedPlanId: requestedPlan.id,
        requestedPlanPrice: requestedPlan.price,
        createdAt: user.createdAt.toISOString(),
        tenantId: user.tenantId,
        subscriptionId: subscription.id,
      });
    }
    
    return result;
  }

  async approvePlanRequest(subscriptionId: string, planId: string, durationDays: number): Promise<void> {
    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);
    
    await db.update(subscriptions)
      .set({ 
        planId,
        startsAt,
        endsAt,
        status: "active",
        requestedPlanId: null,
      } as any)
      .where(eq(subscriptions.id, subscriptionId));
  }

  // ============ PASSWORD RESET ============
  async createPasswordResetToken(data: { email: string; token: string; expiresAt: Date }): Promise<void> {
    await db.insert(passwordResetTokens).values({
      email: data.email.toLowerCase(),
      token: data.token,
      expiresAt: data.expiresAt,
    } as any);
  }

  async getPasswordResetToken(token: string): Promise<{ email: string; token: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [result] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    if (!result) return undefined;
    return {
      email: result.email,
      token: result.token,
      expiresAt: result.expiresAt,
      usedAt: result.usedAt,
    };
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() } as any)
      .where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
