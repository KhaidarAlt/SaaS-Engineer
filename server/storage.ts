import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  users, tenants, subscriptions, plans, products, categories,
  discounts, promotions, orders, orderItems, analyticsEvents,
  subscriptionExtensions, knowledgeBase, auditLogs, carts, productVariants, productImages,
  type User, type InsertUser, type Tenant, type InsertTenant,
  type Subscription, type InsertSubscription, type Plan, type InsertPlan,
  type Product, type InsertProduct, type Category, type InsertCategory,
  type Discount, type InsertDiscount, type Promotion, type InsertPromotion,
  type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type AnalyticsEvent, type InsertAnalyticsEvent,
  type SubscriptionExtension, type InsertSubscriptionExtension,
  type ProductVariant, type InsertProductVariant,
  type ProductImage, type InsertProductImage,
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
  createProductImage(image: InsertProductImage): Promise<ProductImage>;
  updateProductImage(id: string, tenantId: string, data: Partial<InsertProductImage>): Promise<ProductImage | undefined>;
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

  async getDefaultPlan(): Promise<Plan | undefined> {
    const allPlans = await this.getPlans();
    return allPlans[0];
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(insertPlan).returning();
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
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, tenantId: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set({
      ...data,
      updatedAt: new Date(),
    }).where(and(eq(products.id, id), eq(products.tenantId, tenantId))).returning();
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
}

export const storage = new DatabaseStorage();
