import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ PLANS ============
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("KZT"),
  periodDays: integer("period_days").notNull().default(30),
  maxProducts: integer("max_products").notNull(),
  maxCategories: integer("max_categories").notNull(),
  maxPromotions: integer("max_promotions").notNull(),
  maxDiscountRules: integer("max_discount_rules").notNull(),
  maxManagers: integer("max_managers").notNull(),
  maxWahaInstances: integer("max_waha_instances").notNull(),
  aiMessagesLimit: integer("ai_messages_limit").notNull(),
  features: jsonb("features").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// ============ TENANTS ============
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("KZT"),
  timezone: text("timezone").notNull().default("Asia/Almaty"),
  language: text("language").notNull().default("ru"),
  logoUrl: text("logo_url"),
  description: text("description"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active, suspended, banned
  wahaBaseUrl: text("waha_base_url"),
  wahaInstanceName: text("waha_instance_name"),
  wahaStatus: text("waha_status").default("disconnected"),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  notificationPhone: text("notification_phone"),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ============ USERS ============
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"), // superadmin, owner, manager
  tenantId: varchar("tenant_id").references(() => tenants.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============ SUBSCRIPTIONS ============
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  planId: varchar("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull().default("active"), // active, expired, cancelled
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
  gracePeriodDays: integer("grace_period_days").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ============ CATEGORIES ============
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  parentId: varchar("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoriesRelations = relations(categories, ({ one }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
}));

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// ============ PRODUCTS ============
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  categoryId: varchar("category_id").references(() => categories.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  inStock: boolean("in_stock").notNull().default(true),
  alwaysInStock: boolean("always_in_stock").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  mainImageUrl: text("main_image_url"),
  galleryUrls: jsonb("gallery_urls").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ one }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ============ DISCOUNTS ============
export const discounts = pgTable("discounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  scope: text("scope").notNull(), // product, category
  scopeId: varchar("scope_id"), // productId or categoryId
  type: text("type").notNull(), // percent, amount
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  priority: integer("priority").notNull().default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discountsRelations = relations(discounts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [discounts.tenantId],
    references: [tenants.id],
  }),
}));

export const insertDiscountSchema = createInsertSchema(discounts).omit({ id: true, createdAt: true });
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type Discount = typeof discounts.$inferSelect;

// ============ PROMOTIONS ============
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  conditionsText: text("conditions_text"),
  imageUrl: text("image_url"),
  priority: integer("priority").notNull().default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  productIds: jsonb("product_ids").$type<string[]>(),
  categoryIds: jsonb("category_ids").$type<string[]>(),
  discountType: text("discount_type"), // percent, amount
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promotionsRelations = relations(promotions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [promotions.tenantId],
    references: [tenants.id],
  }),
}));

export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true });
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;

// ============ ORDERS ============
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deliveryAddress: text("delivery_address"),
  comment: text("comment"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("new"), // new, in_progress, completed, cancelled
  whatsappSent: boolean("whatsapp_sent").notNull().default(false),
  whatsappSentAt: timestamp("whatsapp_sent_at"),
  whatsappError: text("whatsapp_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  items: many(orderItems),
}));

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ============ ORDER ITEMS ============
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountedPrice: decimal("discounted_price", { precision: 12, scale: 2 }),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// ============ ANALYTICS EVENTS ============
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(), // catalog_view, product_view, add_to_cart, checkout_start, order_created, order_sent_whatsapp
  sessionId: text("session_id"),
  productId: varchar("product_id"),
  orderId: varchar("order_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsEvents.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ id: true, createdAt: true });
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// ============ SUBSCRIPTION EXTENSIONS ============
export const subscriptionExtensions = pgTable("subscription_extensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id),
  addedDays: integer("added_days").notNull(),
  reason: text("reason").notNull(),
  addedBy: varchar("added_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionExtensionsRelations = relations(subscriptionExtensions, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionExtensions.subscriptionId],
    references: [subscriptions.id],
  }),
  addedByUser: one(users, {
    fields: [subscriptionExtensions.addedBy],
    references: [users.id],
  }),
}));

export const insertSubscriptionExtensionSchema = createInsertSchema(subscriptionExtensions).omit({ id: true, createdAt: true });
export type InsertSubscriptionExtension = z.infer<typeof insertSubscriptionExtensionSchema>;
export type SubscriptionExtension = typeof subscriptionExtensions.$inferSelect;

// ============ AUDIT LOGS ============
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============ KNOWLEDGE BASE (for AI) ============
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: jsonb("keywords").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  tenant: one(tenants, {
    fields: [knowledgeBase.tenantId],
    references: [tenants.id],
  }),
}));

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;

// ============ NOTIFICATION LOGS ============
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  type: text("type").notNull(), // subscription_expiring, subscription_expired, handoff, no_ai_answer, complaint, sla_breach, abandoned_cart
  channel: text("channel").notNull(), // whatsapp, telegram, email
  recipient: text("recipient").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  error: text("error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notificationLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

// ============ CART (session-based) ============
export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sessionId: text("session_id").notNull(),
  customerPhone: text("customer_phone"),
  items: jsonb("items").$type<Array<{ productId: string; quantity: number }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cartsRelations = relations(carts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [carts.tenantId],
    references: [tenants.id],
  }),
}));

export const insertCartSchema = createInsertSchema(carts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof carts.$inferSelect;

// ============ FORM VALIDATION SCHEMAS ============
export const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export const registerSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  storeName: z.string().min(2, "Название магазина должно содержать минимум 2 символа"),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2, "Введите ваше имя"),
  customerPhone: z.string().min(10, "Введите корректный номер телефона"),
  customerEmail: z.string().email("Введите корректный email").optional().or(z.literal("")),
  deliveryAddress: z.string().optional(),
  comment: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
