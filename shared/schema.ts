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
  hasAiAccess: boolean("has_ai_access").notNull().default(false),
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
  gisLink: text("gis_link"),
  workingHours: text("working_hours"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImageUrl: text("og_image_url"),
  status: text("status").notNull().default("active"), // active, suspended, banned
  wahaBaseUrl: text("waha_base_url"),
  wahaInstanceName: text("waha_instance_name"),
  wahaStatus: text("waha_status").default("disconnected"),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  notificationPhone: text("notification_phone"),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  aiLanguages: text("ai_languages").array().default(sql`ARRAY['ru']::text[]`),
  aiSystemPrompt: text("ai_system_prompt"),
  aiTypingDelay: integer("ai_typing_delay").default(0),
  customDomain: text("custom_domain"),
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
  planPopupShown: boolean("plan_popup_shown").notNull().default(false),
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

// ============ PASSWORD RESET TOKENS ============
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ============ SUBSCRIPTIONS ============
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  planId: varchar("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull().default("active"), // active, expired, cancelled
  requestedPlanId: varchar("requested_plan_id").references(() => plans.id), // Plan user requested (pending admin approval)
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
  gender: text("gender"),
  sizes: jsonb("sizes").$type<{size: string; qty: number}[]>(),
  colors: jsonb("colors").$type<{name: string; hex: string}[]>(),
  sizeColorStock: jsonb("size_color_stock").$type<{size: string; colorHex: string; qty: number}[]>(),
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

// ============ PRODUCT IMAGES ============
export const productImages = pgTable("product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  url: text("url").notNull(),
  isMain: boolean("is_main").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  tenant: one(tenants, {
    fields: [productImages.tenantId],
    references: [tenants.id],
  }),
}));

export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true });
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImages.$inferSelect;

// ============ PRODUCT VARIANTS ============
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sku: text("sku"),
  option1Name: text("option1_name"),
  option1Value: text("option1_value"),
  option2Name: text("option2_name"),
  option2Value: text("option2_value"),
  price: decimal("price", { precision: 12, scale: 2 }),
  stockQty: integer("stock_qty").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  tenant: one(tenants, {
    fields: [productVariants.tenantId],
    references: [tenants.id],
  }),
}));

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({ id: true, createdAt: true });
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;

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
  status: text("status").notNull().default("new"), // new, awaiting_payment, paid, in_progress, completed, cancelled
  paymentStatus: text("payment_status").default("pending"), // pending, paid, failed, expired, manual
  paymentId: text("payment_id"),
  paymentProvider: text("payment_provider"), // kaspi, manual, etc
  paidAt: timestamp("paid_at"),
  paymentSource: text("payment_source"), // auto, manual
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

// ============ ORDER STATUS LOGS ============
export const orderStatusLogs = pgTable("order_status_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  oldPaymentStatus: text("old_payment_status"),
  newPaymentStatus: text("new_payment_status"),
  changedBy: text("changed_by").notNull(), // system, user
  userId: varchar("user_id").references(() => users.id),
  source: text("source"), // auto, manual
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusLogs.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [orderStatusLogs.userId],
    references: [users.id],
  }),
}));

export const insertOrderStatusLogSchema = createInsertSchema(orderStatusLogs).omit({ id: true, createdAt: true });
export type InsertOrderStatusLog = z.infer<typeof insertOrderStatusLogSchema>;
export type OrderStatusLog = typeof orderStatusLogs.$inferSelect;

// ============ ANALYTICS EVENTS ============
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(), // catalog_view, product_view, add_to_cart, remove_from_cart, cart_view, checkout_start, order_created, whatsapp_open_clicked, copy_order_text_clicked, promo_view, search
  sessionId: text("session_id"),
  visitorId: text("visitor_id"),
  pagePath: text("page_path"),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  objectType: text("object_type"), // product, order, category, promotion
  objectId: varchar("object_id"),
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

// ============ CART SESSIONS (for abandoned cart tracking) ============
export const cartSessions = pgTable("cart_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sessionId: text("session_id").notNull(),
  visitorId: text("visitor_id"),
  status: text("status").notNull().default("active"), // active, converted, abandoned, expired
  cartJson: jsonb("cart_json").$type<Array<{productId: string; variantId?: string; name: string; qty: number; price: number}>>(),
  totalEstimated: decimal("total_estimated", { precision: 12, scale: 2 }),
  checkoutPhone: text("checkout_phone"),
  lastStep: text("last_step"), // cart, checkout
  orderId: varchar("order_id"),
  note: text("note"),
  processedStatus: text("processed_status").default("new"), // new, in_progress, processed
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cartSessionsRelations = relations(cartSessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [cartSessions.tenantId],
    references: [tenants.id],
  }),
}));

export const insertCartSessionSchema = createInsertSchema(cartSessions).omit({ id: true, createdAt: true });
export type InsertCartSession = z.infer<typeof insertCartSessionSchema>;
export type CartSession = typeof cartSessions.$inferSelect;

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

// ============ AI SETTINGS ============
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  enabled: boolean("enabled").notNull().default(false),
  language: text("language").notNull().default("ru"),
  tone: text("tone").notNull().default("friendly"), // neutral, friendly, strict
  workingHoursJson: jsonb("working_hours_json").$type<{from: string; to: string; days: number[]}>(),
  fallbackHandoffText: text("fallback_handoff_text").default("К сожалению, я не могу ответить на этот вопрос. Сейчас передам ваш вопрос менеджеру."),
  systemPromptCustom: text("system_prompt_custom"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;

// ============ AI SALES SCRIPT ============
export const aiSalesScripts = pgTable("ai_sales_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  stagesJson: jsonb("stages_json").$type<Array<{
    stage: string;
    goal: string;
    questions: string[];
    transitionCriteria: string[];
  }>>().notNull(),
  forbiddenPhrasesJson: jsonb("forbidden_phrases_json").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiSalesScriptsRelations = relations(aiSalesScripts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiSalesScripts.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiSalesScriptSchema = createInsertSchema(aiSalesScripts).omit({ id: true, createdAt: true });
export type InsertAiSalesScript = z.infer<typeof insertAiSalesScriptSchema>;
export type AiSalesScript = typeof aiSalesScripts.$inferSelect;

// ============ AI TAG RULES ============
export const aiTagRules = pgTable("ai_tag_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  tag: text("tag").notNull(),
  displayName: text("display_name").notNull(),
  keywordsJson: jsonb("keywords_json").$type<string[]>().notNull(),
  priority: integer("priority").notNull().default(0),
  action: text("action").notNull().default("none"), // handoff, notify, send_catalog_link, stop_ai, none
  responseTemplate: text("response_template"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiTagRulesRelations = relations(aiTagRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiTagRules.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiTagRuleSchema = createInsertSchema(aiTagRules).omit({ id: true, createdAt: true });
export type InsertAiTagRule = z.infer<typeof insertAiTagRuleSchema>;
export type AiTagRule = typeof aiTagRules.$inferSelect;

// ============ AI KNOWLEDGE ARTICLES ============
export const aiKnowledgeArticles = pgTable("ai_knowledge_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiKnowledgeArticlesRelations = relations(aiKnowledgeArticles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiKnowledgeArticles.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiKnowledgeArticleSchema = createInsertSchema(aiKnowledgeArticles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiKnowledgeArticle = z.infer<typeof insertAiKnowledgeArticleSchema>;
export type AiKnowledgeArticle = typeof aiKnowledgeArticles.$inferSelect;

// ============ AI FAQ ============
export const aiFaqItems = pgTable("ai_faq_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  isPublished: boolean("is_published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiFaqItemsRelations = relations(aiFaqItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiFaqItems.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiFaqItemSchema = createInsertSchema(aiFaqItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiFaqItem = z.infer<typeof insertAiFaqItemSchema>;
export type AiFaqItem = typeof aiFaqItems.$inferSelect;

// ============ AI POLICIES ============
export const aiPolicies = pgTable("ai_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  answerOnlyFromData: boolean("answer_only_from_data").notNull().default(true),
  offerHandoffIfNoAnswer: boolean("offer_handoff_if_no_answer").notNull().default(true),
  neverInventPrices: boolean("never_invent_prices").notNull().default(true),
  prioritizePromotions: boolean("prioritize_promotions").notNull().default(true),
  followSalesScript: boolean("follow_sales_script").notNull().default(true),
  boundariesText: text("boundaries_text").default("Отвечай только про товары, наличие, акции, доставку и условия. Не обсуждай посторонние темы."),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiPoliciesRelations = relations(aiPolicies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiPolicies.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiPolicySchema = createInsertSchema(aiPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiPolicy = z.infer<typeof insertAiPolicySchema>;
export type AiPolicy = typeof aiPolicies.$inferSelect;

// ============ AI CONVERSATIONS ============
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  channel: text("channel").notNull().default("sandbox"), // sandbox, whatsapp, telegram, web
  visitorId: text("visitor_id"),
  sessionId: text("session_id"),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  status: text("status").notNull().default("open"), // open, handoff, closed
  currentStage: text("current_stage"), // for sales script tracking
  metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiConversations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

// ============ AI MESSAGES ============
export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user, assistant, system, manager
  content: text("content").notNull(),
  tagMatched: text("tag_matched"),
  metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true, createdAt: true });
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;

// ============ AI INTERVENTION EVENTS ============
export const aiInterventionEvents = pgTable("ai_intervention_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  type: text("type").notNull(), // handoff_requested, no_answer, complaint, manual_takeover, tag_triggered
  tag: text("tag"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiInterventionEventsRelations = relations(aiInterventionEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiInterventionEvents.tenantId],
    references: [tenants.id],
  }),
  conversation: one(aiConversations, {
    fields: [aiInterventionEvents.conversationId],
    references: [aiConversations.id],
  }),
}));

export const insertAiInterventionEventSchema = createInsertSchema(aiInterventionEvents).omit({ id: true, createdAt: true });
export type InsertAiInterventionEvent = z.infer<typeof insertAiInterventionEventSchema>;
export type AiInterventionEvent = typeof aiInterventionEvents.$inferSelect;

// ============ AI INBOX TICKETS ============
export const aiInboxTickets = pgTable("ai_inbox_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("new"), // new, in_progress, done
  priority: text("priority").notNull().default("normal"), // low, normal, high
  note: text("note"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiInboxTicketsRelations = relations(aiInboxTickets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiInboxTickets.tenantId],
    references: [tenants.id],
  }),
  conversation: one(aiConversations, {
    fields: [aiInboxTickets.conversationId],
    references: [aiConversations.id],
  }),
  assignedUser: one(users, {
    fields: [aiInboxTickets.assignedUserId],
    references: [users.id],
  }),
}));

export const insertAiInboxTicketSchema = createInsertSchema(aiInboxTickets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiInboxTicket = z.infer<typeof insertAiInboxTicketSchema>;
export type AiInboxTicket = typeof aiInboxTickets.$inferSelect;

// ============ WAHA INSTANCES ============
export const wahaInstances = pgTable("waha_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  instanceName: text("instance_name").notNull().unique(),
  phoneNumber: text("phone_number"),
  status: text("status").notNull().default("created"), // created, starting, running, stopped, failed, scan_qr
  qrCode: text("qr_code"),
  lastConnectedAt: timestamp("last_connected_at"),
  webhookUrl: text("webhook_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const wahaInstancesRelations = relations(wahaInstances, ({ one }) => ({
  tenant: one(tenants, {
    fields: [wahaInstances.tenantId],
    references: [tenants.id],
  }),
}));

export const insertWahaInstanceSchema = createInsertSchema(wahaInstances).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWahaInstance = z.infer<typeof insertWahaInstanceSchema>;
export type WahaInstance = typeof wahaInstances.$inferSelect;

// ============ AI RESPONSE CORRECTIONS ============
export const aiResponseCorrections = pgTable("ai_response_corrections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userMessagePattern: text("user_message_pattern").notNull(),
  originalResponse: text("original_response").notNull(),
  correctedResponse: text("corrected_response").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiResponseCorrectionsRelations = relations(aiResponseCorrections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiResponseCorrections.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiResponseCorrectionSchema = createInsertSchema(aiResponseCorrections).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiResponseCorrection = z.infer<typeof insertAiResponseCorrectionSchema>;
export type AiResponseCorrection = typeof aiResponseCorrections.$inferSelect;

// ============ DEMO LEADS ============
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  source: text("source").notNull().default("demo_catalog"), // demo_catalog, landing, etc.
  status: text("status").notNull().default("new"), // new, contacted, converted, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// ============ TENANT LINKS (Link-in-Bio) ============
export const tenantLinks = pgTable("tenant_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantLinksRelations = relations(tenantLinks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantLinks.tenantId],
    references: [tenants.id],
  }),
}));

export const insertTenantLinkSchema = createInsertSchema(tenantLinks).omit({ id: true, createdAt: true });
export type InsertTenantLink = z.infer<typeof insertTenantLinkSchema>;
export type TenantLink = typeof tenantLinks.$inferSelect;

// ============ CRM INTEGRATIONS ============
export const crmIntegrations = pgTable("crm_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  crmType: text("crm_type").notNull(), // bitrix24, amocrm
  status: text("status").notNull().default("disconnected"), // connected, disconnected, error, pending
  
  // OAuth tokens (encrypted in production)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // CRM-specific data
  crmDomain: text("crm_domain"), // e.g., mycompany.bitrix24.kz
  crmUserId: text("crm_user_id"),
  
  // Integration settings
  pipelineId: text("pipeline_id"),
  pipelineName: text("pipeline_name"),
  stageId: text("stage_id"),
  stageName: text("stage_name"),
  responsibleUserId: text("responsible_user_id"),
  responsibleUserName: text("responsible_user_name"),
  entityType: text("entity_type").default("deal"), // deal, lead
  
  // Field mapping (JSON)
  fieldMapping: jsonb("field_mapping").$type<Record<string, string>>(),
  
  // Status tracking
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  webhookStatus: text("webhook_status").default("inactive"), // active, inactive, error
  webhookSecret: text("webhook_secret"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const crmIntegrationsRelations = relations(crmIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [crmIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertCrmIntegrationSchema = createInsertSchema(crmIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmIntegration = z.infer<typeof insertCrmIntegrationSchema>;
export type CrmIntegration = typeof crmIntegrations.$inferSelect;

// ============ CRM SYNC LOGS ============
export const crmSyncLogs = pgTable("crm_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull().references(() => crmIntegrations.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  orderId: varchar("order_id").references(() => orders.id),
  action: text("action").notNull(), // create_deal, update_deal, webhook_received
  status: text("status").notNull(), // success, error
  crmEntityId: text("crm_entity_id"), // ID of created entity in CRM
  errorMessage: text("error_message"),
  requestData: jsonb("request_data"),
  responseData: jsonb("response_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmSyncLogSchema = createInsertSchema(crmSyncLogs).omit({ id: true, createdAt: true });
export type InsertCrmSyncLog = z.infer<typeof insertCrmSyncLogSchema>;
export type CrmSyncLog = typeof crmSyncLogs.$inferSelect;

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
