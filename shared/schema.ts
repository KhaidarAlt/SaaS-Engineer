import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb, uniqueIndex, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

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
  domainVerified: boolean("domain_verified").notNull().default(false),
  // Catalog settings
  catalogUsp: text("catalog_usp"), // УТП в шапке (макс 120 символов)
  showProductSpecs: boolean("show_product_specs").notNull().default(true),
  showProductStock: boolean("show_product_stock").notNull().default(true),
  showPaymentMethods: boolean("show_payment_methods").notNull().default(true),
  showWhatsAppButton: boolean("show_whatsapp_button").notNull().default(true),
  showQuickView: boolean("show_quick_view").notNull().default(true),
  showFavorites: boolean("show_favorites").notNull().default(true),
  showCrossSell: boolean("show_cross_sell").notNull().default(true),
  showFilters: boolean("show_filters").notNull().default(true),
  showFloatingWhatsApp: boolean("show_floating_whatsapp").notNull().default(true),
  showAiConsultant: boolean("show_ai_consultant").notNull().default(true),
  catalogTemplate: text("catalog_template").notNull().default("universal"), // universal, fashion, food
  commissionRates: jsonb("commission_rates").$type<Record<string, number>>(),
  aiRopEnabled: boolean("ai_rop_enabled").notNull().default(false),
  smartCatalogEnabled: boolean("smart_catalog_enabled").notNull().default(false),
  importSource: text("import_source"),
  magicImportSessionId: varchar("magic_import_session_id"),
  catalogProductLimit: integer("catalog_product_limit").notNull().default(200),
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
  hideStockDisplay: boolean("hide_stock_display").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  mainImageUrl: text("main_image_url"),
  galleryUrls: jsonb("gallery_urls").$type<string[]>(),
  gender: text("gender"),
  sizes: jsonb("sizes").$type<{size: string; qty: number}[]>(),
  colors: jsonb("colors").$type<{name: string; hex: string}[]>(),
  sizeColorStock: jsonb("size_color_stock").$type<{size: string; colorHex: string; qty: number}[]>(),
  tags: text("tags").array().default(sql`'{}'::text[]`), // Теги: hit, new, best_price, sale, delivery_today, in_stock, low_stock
  // Universal template fields
  brand: text("brand"),
  unitOfMeasure: text("unit_of_measure"), // шт, кг, г, м, см, пог.м, м², л
  specs: jsonb("specs").$type<{name: string; value: string}[]>(),
  // Food template fields
  ingredients: text("ingredients"),
  modifiers: jsonb("modifiers").$type<{name: string; options: {label: string; price: number}[]}[]>(),
  portionSize: text("portion_size"),
  cookingTime: integer("cooking_time"), // minutes
  weight: text("weight"),
  calories: integer("calories"),
  allergens: text("allergens").array(),
  videoUrl: text("video_url"),
  videoFormat: text("video_format"), // "16:9", "9:16", "1:1"
  videoPosterUrl: text("video_poster_url"),
  videoPrimary: boolean("video_primary").default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  embedding: vector("embedding"),
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

// ============ PROMO BLOCKS ============
export const promoBlocks = pgTable("promo_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  imageUrl: text("image_url").notNull(),
  mediaType: text("media_type").notNull().default("image"), // image | video
  title: text("title"),
  description: text("description"), // до 300 символов
  buttonText: text("button_text").notNull().default("Купить"),
  linkType: text("link_type").notNull().default("whatsapp"), // whatsapp, crm
  linkUrl: text("link_url"), // для CRM ссылки
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  bannerClicks: integer("banner_clicks").notNull().default(0),
  ctaClicks: integer("cta_clicks").notNull().default(0),
  aiDescription: text("ai_description"), // описание акции для AI ассистента
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promoBlocksRelations = relations(promoBlocks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [promoBlocks.tenantId],
    references: [tenants.id],
  }),
}));

export const insertPromoBlockSchema = createInsertSchema(promoBlocks).omit({ id: true, createdAt: true, updatedAt: true, bannerClicks: true, ctaClicks: true });
export type InsertPromoBlock = z.infer<typeof insertPromoBlockSchema>;
export type PromoBlock = typeof promoBlocks.$inferSelect;

// ============ ORDERS ============
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  clientId: varchar("client_id"),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deliveryAddress: text("delivery_address"),
  comment: text("comment"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("new"), // new, confirmed, assembling, delivering, completed, cancelled
  paymentStatus: text("payment_status").default("pending"), // pending, prepayment, paid, installment, credit, kaspi_red
  prepaymentPercentage: integer("prepayment_percentage"),
  paymentId: text("payment_id"),
  paymentProvider: text("payment_provider"), // kaspi, manual, etc
  paidAt: timestamp("paid_at"),
  paymentSource: text("payment_source"), // auto, manual
  templateType: text("template_type"), // universal, fashion, food
  whatsappSent: boolean("whatsapp_sent").notNull().default(false),
  whatsappSentAt: timestamp("whatsapp_sent_at"),
  whatsappError: text("whatsapp_error"),
  assignedManagerId: varchar("assigned_manager_id").references(() => users.id),
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

// ============ CRM CLIENTS ============
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  lastOrderAt: timestamp("last_order_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
}));

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ============ ORDER TAGS ============
export const orderTags = pgTable("order_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderTagsRelations = relations(orderTags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orderTags.tenantId],
    references: [tenants.id],
  }),
}));

export const insertOrderTagSchema = createInsertSchema(orderTags).omit({ id: true, createdAt: true });
export type InsertOrderTag = z.infer<typeof insertOrderTagSchema>;
export type OrderTag = typeof orderTags.$inferSelect;

// ============ ORDER TAG ASSIGNMENTS ============
export const orderTagAssignments = pgTable("order_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  tagId: varchar("tag_id").notNull().references(() => orderTags.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderTagAssignmentsRelations = relations(orderTagAssignments, ({ one }) => ({
  order: one(orders, {
    fields: [orderTagAssignments.orderId],
    references: [orders.id],
  }),
  tag: one(orderTags, {
    fields: [orderTagAssignments.tagId],
    references: [orderTags.id],
  }),
}));

export const insertOrderTagAssignmentSchema = createInsertSchema(orderTagAssignments).omit({ id: true, createdAt: true });
export type InsertOrderTagAssignment = z.infer<typeof insertOrderTagAssignmentSchema>;
export type OrderTagAssignment = typeof orderTagAssignments.$inferSelect;

// ============ ORDER NOTES ============
export const orderNotes = pgTable("order_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  userId: varchar("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, {
    fields: [orderNotes.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [orderNotes.userId],
    references: [users.id],
  }),
}));

export const insertOrderNoteSchema = createInsertSchema(orderNotes).omit({ id: true, createdAt: true });
export type InsertOrderNote = z.infer<typeof insertOrderNoteSchema>;
export type OrderNote = typeof orderNotes.$inferSelect;

// ============ ORDER TIMELINE EVENTS ============
export const orderTimelineEvents = pgTable("order_timeline_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  eventType: text("event_type").notNull(), // created, status_changed, payment_status_changed, whatsapp_sent, payment_link_sent, note_added, tag_added, ai_analysis
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderTimelineEventsRelations = relations(orderTimelineEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderTimelineEvents.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [orderTimelineEvents.userId],
    references: [users.id],
  }),
}));

export const insertOrderTimelineEventSchema = createInsertSchema(orderTimelineEvents).omit({ id: true, createdAt: true });
export type InsertOrderTimelineEvent = z.infer<typeof insertOrderTimelineEventSchema>;
export type OrderTimelineEvent = typeof orderTimelineEvents.$inferSelect;

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
  goal: text("goal").notNull().default("CLOSE_DEAL"),
  temperature: decimal("temperature").default("0.7"),
  typingDelay: integer("typing_delay").default(1500),
  versionNumber: integer("version_number").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  objectionsJson: jsonb("objections_json").$type<string[]>().default([]),
  salesBoostersJson: jsonb("sales_boosters_json").$type<{upsell: boolean; cheaperAlternative: boolean; scarcity: boolean; autoPromo: boolean}>(),
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

// ============ AI BUSINESS PROFILE ============
export const aiBusinessProfile = pgTable("ai_business_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  isOfficialRepresentative: boolean("is_official_representative").notNull().default(false),
  representedBrands: text("represented_brands").array().default(sql`'{}'::text[]`),
  hasOwnBrand: boolean("has_own_brand").notNull().default(false),
  ownBrands: text("own_brands").array().default(sql`'{}'::text[]`),
  uspPoints: text("usp_points").array().default(sql`'{}'::text[]`),
  uspFreeText: text("usp_free_text"),
  installmentEnabled: boolean("installment_enabled").notNull().default(false),
  installmentBanks: text("installment_banks").array().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiBusinessProfileRelations = relations(aiBusinessProfile, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiBusinessProfile.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiBusinessProfileSchema = createInsertSchema(aiBusinessProfile).omit({ id: true, updatedAt: true });
export type InsertAiBusinessProfile = z.infer<typeof insertAiBusinessProfileSchema>;
export type AiBusinessProfile = typeof aiBusinessProfile.$inferSelect;

// ============ BANK PRODUCTS ============
export const bankProducts = pgTable("bank_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  bankName: text("bank_name").notNull(),
  productName: text("product_name").notNull(),
  description: text("description"),
  conditions: text("conditions"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bankProductsRelations = relations(bankProducts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [bankProducts.tenantId],
    references: [tenants.id],
  }),
}));

export const insertBankProductSchema = createInsertSchema(bankProducts).omit({ id: true });
export type InsertBankProduct = z.infer<typeof insertBankProductSchema>;
export type BankProduct = typeof bankProducts.$inferSelect;

// ============ CATEGORY AI PRIORITY ============
export const categoryAiPriority = pgTable("category_ai_priority", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("category_ai_priority_tenant_category_idx").on(table.tenantId, table.categoryId),
]);

export const categoryAiPriorityRelations = relations(categoryAiPriority, ({ one }) => ({
  tenant: one(tenants, { fields: [categoryAiPriority.tenantId], references: [tenants.id] }),
  category: one(categories, { fields: [categoryAiPriority.categoryId], references: [categories.id] }),
  product: one(products, { fields: [categoryAiPriority.productId], references: [products.id] }),
}));

export type CategoryAiPriority = typeof categoryAiPriority.$inferSelect;

// ============ PRODUCT CROSS-SELL ============
export const productCrossSell = pgTable("product_cross_sell", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  relatedProductId: varchar("related_product_id").notNull().references(() => products.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("product_cross_sell_unique_idx").on(table.tenantId, table.productId, table.relatedProductId),
]);

export const productCrossSellRelations = relations(productCrossSell, ({ one }) => ({
  tenant: one(tenants, { fields: [productCrossSell.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [productCrossSell.productId], references: [products.id] }),
  relatedProduct: one(products, { fields: [productCrossSell.relatedProductId], references: [products.id] }),
}));

export type ProductCrossSell = typeof productCrossSell.$inferSelect;

// ============ PRODUCT UPSELL ============
export const productUpsell = pgTable("product_upsell", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  upsellProductId: varchar("upsell_product_id").notNull().references(() => products.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("product_upsell_unique_idx").on(table.tenantId, table.productId),
]);

export const productUpsellRelations = relations(productUpsell, ({ one }) => ({
  tenant: one(tenants, { fields: [productUpsell.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [productUpsell.productId], references: [products.id] }),
  upsellProduct: one(products, { fields: [productUpsell.upsellProductId], references: [products.id] }),
}));

export type ProductUpsell = typeof productUpsell.$inferSelect;

// ============ PRODUCT AI TAGS ============
export const productAiTags = pgTable("product_ai_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  tagType: text("tag_type").notNull(), // PRIORITY, FLAGSHIP, NEW, PREMIUM, ENTRY, SLOW
  source: text("source").notNull().default("MANUAL"), // AUTO, RULE, MANUAL
  weight: integer("weight").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productAiTagsRelations = relations(productAiTags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productAiTags.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productAiTags.productId],
    references: [products.id],
  }),
}));

export const insertProductAiTagSchema = createInsertSchema(productAiTags).omit({ id: true, createdAt: true });
export type InsertProductAiTag = z.infer<typeof insertProductAiTagSchema>;
export type ProductAiTag = typeof productAiTags.$inferSelect;

// ============ AI PROMOTION RULES ============
export const aiPromotionRules = pgTable("ai_promotion_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  promoteNew: boolean("promote_new").notNull().default(false),
  promotePremium: boolean("promote_premium").notNull().default(false),
  promoteEntry: boolean("promote_entry").notNull().default(false),
  promoteSlow: boolean("promote_slow").notNull().default(false),
  promotedCategoryIds: text("promoted_category_ids").array().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiPromotionRulesRelations = relations(aiPromotionRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiPromotionRules.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiPromotionRulesSchema = createInsertSchema(aiPromotionRules).omit({ id: true, updatedAt: true });
export type InsertAiPromotionRules = z.infer<typeof insertAiPromotionRulesSchema>;
export type AiPromotionRules = typeof aiPromotionRules.$inferSelect;

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
  stageExit: text("stage_exit"),
  success: boolean("success"),
  dropReason: text("drop_reason"),
  blockerFlag: boolean("blocker_flag").default(false),
  estimatedRevenue: decimal("estimated_revenue"),
  goalAtStart: text("goal_at_start"),
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
  stageLabel: text("stage_label"),
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

// ============ HANDOVER RULES ============
export const handoverRules = pgTable("handover_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  ruleType: text("rule_type").notNull(),
  thresholdValue: text("threshold_value"),
  customRuleText: text("custom_rule_text"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const handoverRulesRelations = relations(handoverRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [handoverRules.tenantId],
    references: [tenants.id],
  }),
}));

export const insertHandoverRuleSchema = createInsertSchema(handoverRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHandoverRule = z.infer<typeof insertHandoverRuleSchema>;
export type HandoverRule = typeof handoverRules.$inferSelect;

// ============ KNOWLEDGE ITEMS ============
export const knowledgeItems = pgTable("knowledge_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").default("USER"), // USER | IMPORT | TRAINING | SYSTEM
  tags: text("tags").array(),
  isActive: boolean("is_active").default(true),
  embedding: vector("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeItemsRelations = relations(knowledgeItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [knowledgeItems.tenantId],
    references: [tenants.id],
  }),
}));

export const insertKnowledgeItemSchema = createInsertSchema(knowledgeItems).omit({ id: true, embedding: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeItem = z.infer<typeof insertKnowledgeItemSchema>;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;

// ============ TRAINING ITEMS ============
export const trainingItems = pgTable("training_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  userMessage: text("user_message").notNull(),
  aiOriginal: text("ai_original").notNull(),
  aiCorrected: text("ai_corrected").notNull(),
  stage: text("stage"),
  source: text("source").default("TEST_CHAT"),
  applied: boolean("applied").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainingItemsRelations = relations(trainingItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trainingItems.tenantId],
    references: [tenants.id],
  }),
  conversation: one(aiConversations, {
    fields: [trainingItems.conversationId],
    references: [aiConversations.id],
  }),
}));

export const insertTrainingItemSchema = createInsertSchema(trainingItems).omit({ id: true, createdAt: true });
export type InsertTrainingItem = z.infer<typeof insertTrainingItemSchema>;
export type TrainingItem = typeof trainingItems.$inferSelect;

// ============ AI AUDIT REPORTS ============
export const aiAuditReports = pgTable("ai_audit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  summaryJson: jsonb("summary_json").$type<Record<string, unknown>>(),
  recommendationsJson: jsonb("recommendations_json").$type<Array<{ problem: string; suggestion: string; estimatedImpact: string; type: string }>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiAuditReportsRelations = relations(aiAuditReports, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiAuditReports.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiAuditReportSchema = createInsertSchema(aiAuditReports).omit({ id: true, createdAt: true });
export type InsertAiAuditReport = z.infer<typeof insertAiAuditReportSchema>;
export type AiAuditReport = typeof aiAuditReports.$inferSelect;

// ============ AI SETTINGS HISTORY ============
export const aiSettingsHistory = pgTable("ai_settings_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  versionNumber: integer("version_number").notNull(),
  settingsSnapshot: jsonb("settings_snapshot").$type<Record<string, unknown>>(),
  changedBy: varchar("changed_by"),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiSettingsHistoryRelations = relations(aiSettingsHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiSettingsHistory.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiSettingsHistorySchema = createInsertSchema(aiSettingsHistory).omit({ id: true, createdAt: true });
export type InsertAiSettingsHistory = z.infer<typeof insertAiSettingsHistorySchema>;
export type AiSettingsHistory = typeof aiSettingsHistory.$inferSelect;

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

// ============ KASPI INTEGRATIONS ============
export const kaspiIntegrations = pgTable("kaspi_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  status: text("status").notNull().default("disconnected"), // connected, disconnected

  // Kaspi Pay link (e.g. https://pay.kaspi.kz/pay/9iqtschb)
  kaspiPayLink: text("kaspi_pay_link"),

  // Legacy fields (kept for backward compat, no longer used for new flow)
  iinBin: text("iin_bin"),
  organizationName: text("organization_name"),
  verificationStatus: text("verification_status").default("not_started"),
  verificationRequestedAt: timestamp("verification_requested_at"),
  verifiedAt: timestamp("verified_at"),
  verificationError: text("verification_error"),
  merchantId: text("merchant_id"),
  apiToken: text("api_token"),
  webhookSecret: text("webhook_secret"),
  
  // Settings
  autoGenerateInvoice: boolean("auto_generate_invoice").default(true),
  paymentTimeout: integer("payment_timeout").default(30), // minutes
  sendReminder: boolean("send_reminder").default(true),
  reminderMinutes: integer("reminder_minutes").default(15),
  
  // Actions after payment
  updateOrderStatus: boolean("update_order_status").default(true),
  notifyManager: boolean("notify_manager").default(true),
  syncWithCrm: boolean("sync_with_crm").default(true),
  
  // Status tracking
  lastCheckedAt: timestamp("last_checked_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKaspiIntegrationSchema = createInsertSchema(kaspiIntegrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertKaspiIntegration = z.infer<typeof insertKaspiIntegrationSchema>;
export type KaspiIntegration = typeof kaspiIntegrations.$inferSelect;

// ============ PAYMENTS ============
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  
  // Payment details
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KZT"),
  status: text("status").notNull().default("pending"), // pending, paid, failed, expired, cancelled
  
  // Provider details
  provider: text("provider").notNull().default("kaspi"), // kaspi, manual
  externalId: text("external_id"), // ID from Kaspi
  paymentUrl: text("payment_url"), // Link for customer to pay
  
  // Customer info
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  
  // Tracking
  source: text("source").notNull().default("auto"), // auto, manual
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  
  // Receipt verification (for Kaspi Pay link flow)
  receiptImageUrl: text("receipt_image_url"),
  aiVerified: boolean("ai_verified").default(false),
  aiVerificationData: jsonb("ai_verification_data"),
  confirmedBy: varchar("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),

  // Webhook data
  webhookData: jsonb("webhook_data"),
  webhookReceivedAt: timestamp("webhook_received_at"),
  
  // Notifications
  whatsappNotified: boolean("whatsapp_notified").default(false),
  telegramNotified: boolean("telegram_notified").default(false),
  crmSynced: boolean("crm_synced").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ============ WHATSAPP CLOUD API INTEGRATION ============
export const waCloudIntegrations = pgTable("wa_cloud_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  
  // OAuth credentials (encrypted in production)
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Meta Business Account
  businessId: text("business_id"),
  wabaId: text("waba_id"), // WhatsApp Business Account ID
  
  // Connection status
  status: text("status").notNull().default("disconnected"), // disconnected, connecting, connected, error
  connectionError: text("connection_error"),
  
  // Billing status
  billingStatus: text("billing_status").default("unknown"), // unknown, active, required, suspended
  
  // Webhook configuration
  webhookVerifyToken: text("webhook_verify_token"),
  webhookSecret: text("webhook_secret"),
  webhookActive: boolean("webhook_active").default(false),
  
  // Onboarding state
  onboardingStep: integer("onboarding_step").default(0), // 0-6 wizard steps
  onboardingCompleted: boolean("onboarding_completed").default(false),
  
  // OAuth CSRF protection
  oauthNonce: text("oauth_nonce"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waCloudIntegrationsRelations = relations(waCloudIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertWaCloudIntegrationSchema = createInsertSchema(waCloudIntegrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertWaCloudIntegration = z.infer<typeof insertWaCloudIntegrationSchema>;
export type WaCloudIntegration = typeof waCloudIntegrations.$inferSelect;

// ============ WHATSAPP CLOUD PHONE NUMBERS ============
export const waCloudPhoneNumbers = pgTable("wa_cloud_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationId: varchar("integration_id").notNull().references(() => waCloudIntegrations.id),
  
  // Phone details
  phoneNumber: text("phone_number").notNull(),
  phoneNumberId: text("phone_number_id"), // Meta's phone number ID
  displayPhoneNumber: text("display_phone_number"),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, active, limited, blocked
  verificationStatus: text("verification_status").default("unverified"), // unverified, pending, verified
  
  // Quality and limits
  qualityRating: text("quality_rating").default("unknown"), // unknown, green, yellow, red
  messagingTier: text("messaging_tier").default("tier_1"), // tier_1, tier_2, tier_3, tier_4
  
  // Business verification
  businessStatus: text("business_status").default("unverified"), // unverified, pending, verified
  
  // Channel type for AI router
  channelType: text("channel_type").notNull().default("cloud_api"), // cloud_api, waha
  isDefault: boolean("is_default").default(false),
  
  // Last sync
  lastSyncAt: timestamp("last_sync_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waCloudPhoneNumbersRelations = relations(waCloudPhoneNumbers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudPhoneNumbers.tenantId],
    references: [tenants.id],
  }),
  integration: one(waCloudIntegrations, {
    fields: [waCloudPhoneNumbers.integrationId],
    references: [waCloudIntegrations.id],
  }),
}));

export const insertWaCloudPhoneNumberSchema = createInsertSchema(waCloudPhoneNumbers).omit({ 
  id: true, createdAt: true, updatedAt: true, lastSyncAt: true 
});
export type InsertWaCloudPhoneNumber = z.infer<typeof insertWaCloudPhoneNumberSchema>;
export type WaCloudPhoneNumber = typeof waCloudPhoneNumbers.$inferSelect;

// ============ WHATSAPP MESSAGE TEMPLATES ============
export const waCloudTemplates = pgTable("wa_cloud_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationId: varchar("integration_id").notNull().references(() => waCloudIntegrations.id),
  
  // Template details
  name: text("name").notNull(),
  language: text("language").notNull().default("ru"),
  category: text("category").notNull().default("utility"), // utility, marketing, authentication
  
  // Content
  headerType: text("header_type"), // text, image, video, document
  headerContent: text("header_content"),
  bodyText: text("body_text").notNull(),
  footerText: text("footer_text"),
  buttons: jsonb("buttons").$type<{type: string; text: string; url?: string; phoneNumber?: string}[]>(),
  
  // Variables
  variables: jsonb("variables").$type<{name: string; example: string}[]>(),
  
  // Meta sync
  metaTemplateId: text("meta_template_id"),
  status: text("status").notNull().default("draft"), // draft, pending, approved, rejected
  rejectionReason: text("rejection_reason"),
  
  // Usage stats
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waCloudTemplatesRelations = relations(waCloudTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudTemplates.tenantId],
    references: [tenants.id],
  }),
  integration: one(waCloudIntegrations, {
    fields: [waCloudTemplates.integrationId],
    references: [waCloudIntegrations.id],
  }),
}));

export const insertWaCloudTemplateSchema = createInsertSchema(waCloudTemplates).omit({ 
  id: true, createdAt: true, updatedAt: true, usageCount: true, lastUsedAt: true 
});
export type InsertWaCloudTemplate = z.infer<typeof insertWaCloudTemplateSchema>;
export type WaCloudTemplate = typeof waCloudTemplates.$inferSelect;

// ============ WHATSAPP BROADCAST CAMPAIGNS ============
export const waCloudCampaigns = pgTable("wa_cloud_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationId: varchar("integration_id").notNull().references(() => waCloudIntegrations.id),
  templateId: varchar("template_id").references(() => waCloudTemplates.id),
  
  // Campaign details
  name: text("name").notNull(),
  description: text("description"),
  
  // Targeting
  audienceType: text("audience_type").notNull().default("all"), // all, tags, custom
  audienceTags: text("audience_tags").array(),
  audienceFilters: jsonb("audience_filters").$type<Record<string, any>>(),
  
  // Sending
  phoneNumberIds: text("phone_number_ids").array(), // Which numbers to send from
  
  // Scheduling
  status: text("status").notNull().default("draft"), // draft, scheduled, sending, completed, paused, failed
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Stats
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  repliedCount: integer("replied_count").default(0),
  failedCount: integer("failed_count").default(0),
  
  // Error tracking
  lastError: text("last_error"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waCloudCampaignsRelations = relations(waCloudCampaigns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudCampaigns.tenantId],
    references: [tenants.id],
  }),
  integration: one(waCloudIntegrations, {
    fields: [waCloudCampaigns.integrationId],
    references: [waCloudIntegrations.id],
  }),
  template: one(waCloudTemplates, {
    fields: [waCloudCampaigns.templateId],
    references: [waCloudTemplates.id],
  }),
}));

export const insertWaCloudCampaignSchema = createInsertSchema(waCloudCampaigns).omit({ 
  id: true, createdAt: true, updatedAt: true,
  totalRecipients: true, sentCount: true, deliveredCount: true, 
  readCount: true, repliedCount: true, failedCount: true,
  startedAt: true, completedAt: true
});
export type InsertWaCloudCampaign = z.infer<typeof insertWaCloudCampaignSchema>;
export type WaCloudCampaign = typeof waCloudCampaigns.$inferSelect;

// ============ WHATSAPP ACCOUNT WARMUP STATUS ============
export const waCloudWarmupStatus = pgTable("wa_cloud_warmup_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  integrationId: varchar("integration_id").notNull().references(() => waCloudIntegrations.id),
  
  // Warmup progress
  startedAt: timestamp("started_at").notNull().defaultNow(),
  currentDay: integer("current_day").default(1), // Day 1-7+
  stage: text("stage").notNull().default("initial"), // initial, utility_only, limited_marketing, full
  
  // Daily limits
  dailyMessageLimit: integer("daily_message_limit").default(50),
  dailyMessagesSent: integer("daily_messages_sent").default(0),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
  
  // Restrictions
  marketingEnabled: boolean("marketing_enabled").default(false),
  broadcastEnabled: boolean("broadcast_enabled").default(false),
  
  // Recommendations
  recommendations: jsonb("recommendations").$type<string[]>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waCloudWarmupStatusRelations = relations(waCloudWarmupStatus, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudWarmupStatus.tenantId],
    references: [tenants.id],
  }),
  integration: one(waCloudIntegrations, {
    fields: [waCloudWarmupStatus.integrationId],
    references: [waCloudIntegrations.id],
  }),
}));

export const insertWaCloudWarmupStatusSchema = createInsertSchema(waCloudWarmupStatus).omit({ 
  id: true, createdAt: true, updatedAt: true, dailyMessagesSent: true, lastResetAt: true 
});
export type InsertWaCloudWarmupStatus = z.infer<typeof insertWaCloudWarmupStatusSchema>;
export type WaCloudWarmupStatus = typeof waCloudWarmupStatus.$inferSelect;

// ============ WHATSAPP ANALYTICS EVENTS ============
export const waCloudAnalytics = pgTable("wa_cloud_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  phoneNumberId: varchar("phone_number_id").references(() => waCloudPhoneNumbers.id),
  campaignId: varchar("campaign_id").references(() => waCloudCampaigns.id),
  
  // Date for aggregation
  date: timestamp("date").notNull(),
  
  // Message stats
  messagesSent: integer("messages_sent").default(0),
  messagesDelivered: integer("messages_delivered").default(0),
  messagesRead: integer("messages_read").default(0),
  messagesReplied: integer("messages_replied").default(0),
  messagesFailed: integer("messages_failed").default(0),
  
  // Business outcomes
  ordersCreated: integer("orders_created").default(0),
  paymentsReceived: integer("payments_received").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const waCloudAnalyticsRelations = relations(waCloudAnalytics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudAnalytics.tenantId],
    references: [tenants.id],
  }),
  phoneNumber: one(waCloudPhoneNumbers, {
    fields: [waCloudAnalytics.phoneNumberId],
    references: [waCloudPhoneNumbers.id],
  }),
  campaign: one(waCloudCampaigns, {
    fields: [waCloudAnalytics.campaignId],
    references: [waCloudCampaigns.id],
  }),
}));

export const insertWaCloudAnalyticsSchema = createInsertSchema(waCloudAnalytics).omit({ 
  id: true, createdAt: true 
});
export type InsertWaCloudAnalytics = z.infer<typeof insertWaCloudAnalyticsSchema>;
export type WaCloudAnalytics = typeof waCloudAnalytics.$inferSelect;

// ============ WHATSAPP RISK EVENTS ============
export const waCloudRiskEvents = pgTable("wa_cloud_risk_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  phoneNumberId: varchar("phone_number_id").references(() => waCloudPhoneNumbers.id),
  
  // Risk details
  severity: text("severity").notNull().default("low"), // low, medium, high, critical
  type: text("type").notNull(), // quality_drop, tier_decrease, billing_issue, verification_required, rate_limit
  message: text("message").notNull(),
  recommendation: text("recommendation"),
  
  // Resolution
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const waCloudRiskEventsRelations = relations(waCloudRiskEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [waCloudRiskEvents.tenantId],
    references: [tenants.id],
  }),
  phoneNumber: one(waCloudPhoneNumbers, {
    fields: [waCloudRiskEvents.phoneNumberId],
    references: [waCloudPhoneNumbers.id],
  }),
}));

export const insertWaCloudRiskEventSchema = createInsertSchema(waCloudRiskEvents).omit({ 
  id: true, createdAt: true, resolved: true, resolvedAt: true 
});
export type InsertWaCloudRiskEvent = z.infer<typeof insertWaCloudRiskEventSchema>;
export type WaCloudRiskEvent = typeof waCloudRiskEvents.$inferSelect;

// ============ SMART CONTACT (SAFE BULK MESSAGING) ============
export const smartContacts = pgTable("smart_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  phone: text("phone").notNull(),
  name: text("name"),
  
  // Dialog flags
  hasDialogHistory: boolean("has_dialog_history").notNull().default(false),
  doNotDisturb: boolean("do_not_disturb").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  
  // Interaction tracking
  lastClientReplyAt: timestamp("last_client_reply_at"),
  lastMessageSentAt: timestamp("last_message_sent_at"),
  totalMessagesSent: integer("total_messages_sent").notNull().default(0),
  totalRepliesReceived: integer("total_replies_received").notNull().default(0),
  interactionScore: integer("interaction_score").notNull().default(50), // 0-100
  
  // Context for AI
  lastOrderId: varchar("last_order_id"),
  lastProductViewed: text("last_product_viewed"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const smartContactsRelations = relations(smartContacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smartContacts.tenantId],
    references: [tenants.id],
  }),
}));

export const insertSmartContactSchema = createInsertSchema(smartContacts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertSmartContact = z.infer<typeof insertSmartContactSchema>;
export type SmartContact = typeof smartContacts.$inferSelect;

// Smart Messages - Individual message tracking
export const smartMessages = pgTable("smart_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => smartContacts.id),
  
  // Message details
  triggerType: text("trigger_type").notNull(), // abandoned_cart, unpaid_order, reactivation, inactivity, manual
  messageText: text("message_text").notNull(),
  wahaMessageId: text("waha_message_id"),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, queued, sent, delivered, read, failed, cancelled
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  
  // Response tracking
  replyReceived: boolean("reply_received").notNull().default(false),
  replyAt: timestamp("reply_at"),
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smartMessagesRelations = relations(smartMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smartMessages.tenantId],
    references: [tenants.id],
  }),
  contact: one(smartContacts, {
    fields: [smartMessages.contactId],
    references: [smartContacts.id],
  }),
}));

export const insertSmartMessageSchema = createInsertSchema(smartMessages).omit({ 
  id: true, createdAt: true 
});
export type InsertSmartMessage = z.infer<typeof insertSmartMessageSchema>;
export type SmartMessage = typeof smartMessages.$inferSelect;

// Rate Metrics - Daily rate tracking for dynamic limits
export const smartRateMetrics = pgTable("smart_rate_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  date: timestamp("date").notNull(),
  
  // Counts
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  ignoreCount: integer("ignore_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  
  // Calculated rates (%)
  replyRate: integer("reply_rate").default(0),
  deliveryRate: integer("delivery_rate").default(0),
  
  // Calculated limit for next period
  calculatedLimit: integer("calculated_limit").notNull().default(100),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smartRateMetricsRelations = relations(smartRateMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smartRateMetrics.tenantId],
    references: [tenants.id],
  }),
}));

export const insertSmartRateMetricSchema = createInsertSchema(smartRateMetrics).omit({ 
  id: true, createdAt: true 
});
export type InsertSmartRateMetric = z.infer<typeof insertSmartRateMetricSchema>;
export type SmartRateMetric = typeof smartRateMetrics.$inferSelect;

// Smart Contact Settings - Tenant-level configuration
export const smartContactSettings = pgTable("smart_contact_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  
  // Module status
  enabled: boolean("enabled").notNull().default(false),
  
  // Quiet hours
  quietHoursStart: integer("quiet_hours_start").notNull().default(22), // 22:00
  quietHoursEnd: integer("quiet_hours_end").notNull().default(9), // 09:00
  
  // Limits
  maxFollowUpsPerClient: integer("max_follow_ups_per_client").notNull().default(3),
  minHoursBetweenMessages: integer("min_hours_between_messages").notNull().default(24),
  dailyMessageLimit: integer("daily_message_limit").notNull().default(100),
  
  // Safety
  autoStopOnNegativeSignals: boolean("auto_stop_on_negative_signals").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const smartContactSettingsRelations = relations(smartContactSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smartContactSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const insertSmartContactSettingsSchema = createInsertSchema(smartContactSettings).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertSmartContactSettings = z.infer<typeof insertSmartContactSettingsSchema>;
export type SmartContactSettings = typeof smartContactSettings.$inferSelect;

// ============ INSTAGRAM DIRECT INTEGRATION ============
export const instagramIntegrations = pgTable("instagram_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  
  // OAuth credentials
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Instagram account details
  instagramAccountId: text("instagram_account_id"), // Instagram Business Account ID
  instagramUsername: text("instagram_username"),
  instagramProfilePic: text("instagram_profile_pic"),
  
  // Connected Facebook Page
  pageId: text("page_id"), // Facebook Page ID (required for Instagram)
  pageName: text("page_name"),
  pageAccessToken: text("page_access_token"),
  
  // Connection status
  status: text("status").notNull().default("disconnected"), // disconnected, connecting, connected, error
  connectionError: text("connection_error"),
  
  // Webhook configuration
  webhookVerifyToken: text("webhook_verify_token"),
  webhookActive: boolean("webhook_active").default(false),
  
  // AI Integration
  aiEnabled: boolean("ai_enabled").default(true),
  autoReply: boolean("auto_reply").default(true),
  
  // OAuth CSRF protection
  oauthNonce: text("oauth_nonce"),
  
  // Stats
  messagesReceived: integer("messages_received").default(0),
  messagesSent: integer("messages_sent").default(0),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const instagramIntegrationsRelations = relations(instagramIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [instagramIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertInstagramIntegrationSchema = createInsertSchema(instagramIntegrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertInstagramIntegration = z.infer<typeof insertInstagramIntegrationSchema>;
export type InstagramIntegration = typeof instagramIntegrations.$inferSelect;

// ============ INSTAGRAM MESSAGES LOG ============
export const instagramMessages = pgTable("instagram_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationId: varchar("integration_id").notNull().references(() => instagramIntegrations.id),
  
  // Message details
  messageId: text("message_id").notNull(), // Instagram message ID
  senderId: text("sender_id").notNull(), // Instagram user ID
  senderUsername: text("sender_username"),
  
  // Message content
  messageText: text("message_text"),
  messageType: text("message_type").notNull().default("text"), // text, image, story_mention, story_reply
  mediaUrl: text("media_url"),
  
  // Direction
  direction: text("direction").notNull(), // inbound, outbound
  
  // AI response tracking
  aiProcessed: boolean("ai_processed").default(false),
  aiResponseId: text("ai_response_id"),
  
  // Timestamps
  instagramTimestamp: timestamp("instagram_timestamp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const instagramMessagesRelations = relations(instagramMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [instagramMessages.tenantId],
    references: [tenants.id],
  }),
  integration: one(instagramIntegrations, {
    fields: [instagramMessages.integrationId],
    references: [instagramIntegrations.id],
  }),
}));

export const insertInstagramMessageSchema = createInsertSchema(instagramMessages).omit({ 
  id: true, createdAt: true 
});
export type InsertInstagramMessage = z.infer<typeof insertInstagramMessageSchema>;
export type InstagramMessage = typeof instagramMessages.$inferSelect;

// ============ TELEGRAM INTEGRATIONS ============
export const telegramIntegrations = pgTable("telegram_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  botToken: text("bot_token").notNull(),
  botUsername: text("bot_username"),
  botId: text("bot_id"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const telegramIntegrationsRelations = relations(telegramIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [telegramIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertTelegramIntegrationSchema = createInsertSchema(telegramIntegrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertTelegramIntegration = z.infer<typeof insertTelegramIntegrationSchema>;
export type TelegramIntegration = typeof telegramIntegrations.$inferSelect;

// ============ TELEGRAM MESSAGES ============
export const telegramMessages = pgTable("telegram_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  integrationId: varchar("integration_id").notNull().references(() => telegramIntegrations.id),
  chatId: text("chat_id").notNull(),
  messageId: text("message_id"),
  senderName: text("sender_name"),
  senderUsername: text("sender_username"),
  messageText: text("message_text"),
  direction: text("direction").notNull().default("inbound"),
  status: text("status").notNull().default("received"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const telegramMessagesRelations = relations(telegramMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [telegramMessages.tenantId],
    references: [tenants.id],
  }),
  integration: one(telegramIntegrations, {
    fields: [telegramMessages.integrationId],
    references: [telegramIntegrations.id],
  }),
}));

export const insertTelegramMessageSchema = createInsertSchema(telegramMessages).omit({ 
  id: true, createdAt: true 
});
export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;
export type TelegramMessage = typeof telegramMessages.$inferSelect;

// ============ WIDGET INTEGRATIONS ============
export const widgetIntegrations = pgTable("widget_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  widgetKey: text("widget_key").notNull().unique(),
  name: text("name").notNull().default("Виджет чата"),
  primaryColor: text("primary_color").notNull().default("#0ea5e9"),
  position: text("position").notNull().default("bottom-right"),
  welcomeMessage: text("welcome_message").default("Здравствуйте! Чем могу помочь?"),
  placeholder: text("placeholder").default("Введите сообщение..."),
  allowedDomains: text("allowed_domains").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const widgetIntegrationsRelations = relations(widgetIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [widgetIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const insertWidgetIntegrationSchema = createInsertSchema(widgetIntegrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertWidgetIntegration = z.infer<typeof insertWidgetIntegrationSchema>;
export type WidgetIntegration = typeof widgetIntegrations.$inferSelect;

// ============ WIDGET CONVERSATIONS ============
export const widgetConversations = pgTable("widget_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  widgetId: varchar("widget_id").notNull().references(() => widgetIntegrations.id),
  sessionId: text("session_id").notNull(),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  status: text("status").notNull().default("active"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const widgetConversationsRelations = relations(widgetConversations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [widgetConversations.tenantId],
    references: [tenants.id],
  }),
  widget: one(widgetIntegrations, {
    fields: [widgetConversations.widgetId],
    references: [widgetIntegrations.id],
  }),
}));

export const insertWidgetConversationSchema = createInsertSchema(widgetConversations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type InsertWidgetConversation = z.infer<typeof insertWidgetConversationSchema>;
export type WidgetConversation = typeof widgetConversations.$inferSelect;

// ============ WIDGET MESSAGES ============
export const widgetMessages = pgTable("widget_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  conversationId: varchar("conversation_id").notNull().references(() => widgetConversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const widgetMessagesRelations = relations(widgetMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [widgetMessages.tenantId],
    references: [tenants.id],
  }),
  conversation: one(widgetConversations, {
    fields: [widgetMessages.conversationId],
    references: [widgetConversations.id],
  }),
}));

export const insertWidgetMessageSchema = createInsertSchema(widgetMessages).omit({ 
  id: true, createdAt: true 
});
export type InsertWidgetMessage = z.infer<typeof insertWidgetMessageSchema>;
export type WidgetMessage = typeof widgetMessages.$inferSelect;

// ============ DOMAINS ============
export const domains = pgTable("domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  domain: text("domain").notNull().unique(),
  type: text("type").notNull().default("custom"),
  status: text("status").notNull().default("pending_txt"),
  verificationToken: text("verification_token").notNull(),
  requiredTxtName: text("required_txt_name").notNull(),
  requiredTxtValue: text("required_txt_value").notNull(),
  dnsTxtOk: boolean("dns_txt_ok").notNull().default(false),
  dnsAOk: boolean("dns_a_ok").notNull().default(false),
  sslStatus: text("ssl_status").notNull().default("unknown"),
  sslLastCheckAt: timestamp("ssl_last_check_at"),
  sslErrorReason: text("ssl_error_reason"),
  lastCheckAt: timestamp("last_check_at"),
  nextCheckAt: timestamp("next_check_at"),
  attempts: integer("attempts").notNull().default(0),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const domainsRelations = relations(domains, ({ one }) => ({
  tenant: one(tenants, {
    fields: [domains.tenantId],
    references: [tenants.id],
  }),
}));

export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true, createdAt: true, updatedAt: true, dnsTxtOk: true, dnsAOk: true,
  sslStatus: true, sslLastCheckAt: true, sslErrorReason: true,
  lastCheckAt: true, nextCheckAt: true, attempts: true, errorReason: true,
});
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

// ============ AI TESTING SESSIONS ============
export const aiTestingSessions = pgTable("ai_testing_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  mode: text("mode").notNull(), // FREE_CHAT | SIMULATION | STRESS_TEST
  personaKey: text("persona_key"),
  status: text("status").notNull().default("active"), // active | completed | aborted
  summaryJson: jsonb("summary_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiTestingSessionsRelations = relations(aiTestingSessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiTestingSessions.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiTestingSessionSchema = createInsertSchema(aiTestingSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiTestingSession = z.infer<typeof insertAiTestingSessionSchema>;
export type AiTestingSession = typeof aiTestingSessions.$inferSelect;

// ============ AI TESTING MESSAGES ============
export const aiTestingMessages = pgTable("ai_testing_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  sessionId: varchar("session_id").notNull().references(() => aiTestingSessions.id),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiTestingMessagesRelations = relations(aiTestingMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiTestingMessages.tenantId],
    references: [tenants.id],
  }),
  session: one(aiTestingSessions, {
    fields: [aiTestingMessages.sessionId],
    references: [aiTestingSessions.id],
  }),
}));

export const insertAiTestingMessageSchema = createInsertSchema(aiTestingMessages).omit({ id: true, createdAt: true });
export type InsertAiTestingMessage = z.infer<typeof insertAiTestingMessageSchema>;
export type AiTestingMessage = typeof aiTestingMessages.$inferSelect;

// ============ AI SCORE SNAPSHOTS ============
export const aiScoreSnapshots = pgTable("ai_score_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  scoreTotal: integer("score_total").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, unknown>>().notNull(),
  computedFrom: jsonb("computed_from").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiScoreSnapshotsRelations = relations(aiScoreSnapshots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiScoreSnapshots.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiScoreSnapshotSchema = createInsertSchema(aiScoreSnapshots).omit({ id: true, createdAt: true });
export type InsertAiScoreSnapshot = z.infer<typeof insertAiScoreSnapshotSchema>;
export type AiScoreSnapshot = typeof aiScoreSnapshots.$inferSelect;

// ============ AI STRESS TEST RUNS ============
export const aiStressTestRuns = pgTable("ai_stress_test_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  scenarios: jsonb("scenarios").$type<Array<Record<string, unknown>>>(),
  overallScore: integer("overall_score"),
  summary: text("summary"),
  status: text("status").notNull().default("running"), // running | completed | failed
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiStressTestRunsRelations = relations(aiStressTestRuns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiStressTestRuns.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiStressTestRunSchema = createInsertSchema(aiStressTestRuns).omit({ id: true, createdAt: true });
export type InsertAiStressTestRun = z.infer<typeof insertAiStressTestRunSchema>;
export type AiStressTestRun = typeof aiStressTestRuns.$inferSelect;

// ============ AI TRIGGERS ============
export const aiTriggers = pgTable("ai_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  isEnabled: boolean("is_enabled").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  matchType: text("match_type").notNull(), // KEYWORD | REGEX | INTENT
  matchValue: text("match_value").notNull(),
  conditions: jsonb("conditions").$type<Record<string, unknown> | null>(),
  actionType: text("action_type").notNull(), // ADD_LINE_TO_REPLY | FORCE_HANDOVER | OFFER_INSTALLMENT | OFFER_CHEAPER | UPSELL | APPLY_PROMO | ASK_CLARIFYING_QUESTION | USE_SCRIPT_SNIPPET
  actionPayload: jsonb("action_payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiTriggersRelations = relations(aiTriggers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiTriggers.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiTriggerSchema = createInsertSchema(aiTriggers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiTrigger = z.infer<typeof insertAiTriggerSchema>;
export type AiTrigger = typeof aiTriggers.$inferSelect;

// ============ AI ANTI-PATTERNS ============
export const aiAntiPatterns = pgTable("ai_anti_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  patternType: text("pattern_type").notNull(), // KEYWORD | REGEX | CLAIM
  patternValue: text("pattern_value").notNull(),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiAntiPatternsRelations = relations(aiAntiPatterns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiAntiPatterns.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiAntiPatternSchema = createInsertSchema(aiAntiPatterns).omit({ id: true, createdAt: true });
export type InsertAiAntiPattern = z.infer<typeof insertAiAntiPatternSchema>;
export type AiAntiPattern = typeof aiAntiPatterns.$inferSelect;

// ============ AI TRAINING EVENTS ============
export const aiTrainingEvents = pgTable("ai_training_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(), // EDIT_REPLY | TRAIN_APPROVED | KB_ADDED | TRIGGER_CREATED | TRIGGER_UPDATED | ANTI_PATTERN_ADDED | IGNORE_SUGGESTION
  refId: varchar("ref_id"),
  context: jsonb("context").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiTrainingEventsRelations = relations(aiTrainingEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiTrainingEvents.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiTrainingEventSchema = createInsertSchema(aiTrainingEvents).omit({ id: true, createdAt: true });
export type InsertAiTrainingEvent = z.infer<typeof insertAiTrainingEventSchema>;
export type AiTrainingEvent = typeof aiTrainingEvents.$inferSelect;

// ============ AI ANALYTICS: DIALOGS ============
export const aiDialogs = pgTable("ai_dialogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  source: text("source").notNull().default("TESTING"),
  channel: text("channel").notNull().default("INTERNAL"),
  externalThreadId: text("external_thread_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").notNull().default(0),
  goal: text("goal").notNull().default("CLOSE_DEAL"),
  status: text("status").notNull().default("OPEN"),
  outcome: text("outcome").notNull().default("UNKNOWN"),
  successReason: text("success_reason"),
  dropoffStage: text("dropoff_stage"),
  dropoffReason: text("dropoff_reason"),
  handoverReason: text("handover_reason"),
  leadCaptured: boolean("lead_captured").notNull().default(false),
  leadPayload: jsonb("lead_payload").$type<Record<string, unknown>>(),
  revenueAmount: decimal("revenue_amount"),
  currency: text("currency").notNull().default("KZT"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiDialogsRelations = relations(aiDialogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiDialogs.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiDialogSchema = createInsertSchema(aiDialogs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiDialog = z.infer<typeof insertAiDialogSchema>;
export type AiDialog = typeof aiDialogs.$inferSelect;

// ============ AI ANALYTICS: DIALOG EVENTS ============
export const aiDialogEvents = pgTable("ai_dialog_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  dialogId: varchar("dialog_id").notNull().references(() => aiDialogs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventValue: text("event_value"),
  ts: timestamp("ts").notNull().defaultNow(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
});

export const aiDialogEventsRelations = relations(aiDialogEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiDialogEvents.tenantId],
    references: [tenants.id],
  }),
  dialog: one(aiDialogs, {
    fields: [aiDialogEvents.dialogId],
    references: [aiDialogs.id],
  }),
}));

export const insertAiDialogEventSchema = createInsertSchema(aiDialogEvents).omit({ id: true });
export type InsertAiDialogEvent = z.infer<typeof insertAiDialogEventSchema>;
export type AiDialogEvent = typeof aiDialogEvents.$inferSelect;

// ============ AI ANALYTICS: AUDIT RUNS ============
export const aiAnalyticsAuditRuns = pgTable("ai_analytics_audit_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  sourceFilter: text("source_filter").notNull().default("ALL"),
  status: text("status").notNull().default("RUNNING"),
  dialogsAnalyzed: integer("dialogs_analyzed").notNull().default(0),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  recommendations: jsonb("recommendations").$type<Record<string, unknown>[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const aiAnalyticsAuditRunsRelations = relations(aiAnalyticsAuditRuns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiAnalyticsAuditRuns.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiAnalyticsAuditRunSchema = createInsertSchema(aiAnalyticsAuditRuns).omit({ id: true, createdAt: true });
export type InsertAiAnalyticsAuditRun = z.infer<typeof insertAiAnalyticsAuditRunSchema>;
export type AiAnalyticsAuditRun = typeof aiAnalyticsAuditRuns.$inferSelect;

// ============ AI ANALYTICS: AUDIT FINDINGS ============
export const aiAuditFindings = pgTable("ai_audit_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  auditRunId: varchar("audit_run_id").notNull().references(() => aiAnalyticsAuditRuns.id, { onDelete: "cascade" }),
  severity: text("severity").notNull().default("MEDIUM"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  details: text("details").notNull(),
  suggestedFix: jsonb("suggested_fix").$type<Record<string, unknown>>(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiAuditFindingsRelations = relations(aiAuditFindings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiAuditFindings.tenantId],
    references: [tenants.id],
  }),
  auditRun: one(aiAnalyticsAuditRuns, {
    fields: [aiAuditFindings.auditRunId],
    references: [aiAnalyticsAuditRuns.id],
  }),
}));

export const insertAiAuditFindingSchema = createInsertSchema(aiAuditFindings).omit({ id: true, createdAt: true });
export type InsertAiAuditFinding = z.infer<typeof insertAiAuditFindingSchema>;
export type AiAuditFinding = typeof aiAuditFindings.$inferSelect;

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

// ============ KASPI BUSINESS SCHEMAS ============
export const kaspiBusinessCreateInvoiceSchema = z.object({
  orderId: z.string().min(1, "orderId обязателен"),
  sendWhatsApp: z.boolean().optional().default(true),
});

export type KaspiBusinessCreateInvoiceInput = z.infer<typeof kaspiBusinessCreateInvoiceSchema>;

// ============ AI-ROP CHANNEL CONNECTIONS ============
export const aiRopChannels = pgTable("ai_rop_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  channelType: text("channel_type").notNull(), // WHATSAPP_META | WHATSAPP_WAHA | INSTAGRAM | TELEGRAM
  status: text("status").notNull().default("NOT_CONNECTED"), // NOT_CONNECTED | CONNECTING | CONNECTED | ERROR | NEEDS_ACTION
  isAiEnabled: boolean("is_ai_enabled").notNull().default(false),
  displayName: text("display_name"),
  config: jsonb("config").$type<Record<string, any>>(),
  lastError: text("last_error"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiRopChannelsRelations = relations(aiRopChannels, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiRopChannels.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiRopChannelSchema = createInsertSchema(aiRopChannels).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiRopChannel = z.infer<typeof insertAiRopChannelSchema>;
export type AiRopChannel = typeof aiRopChannels.$inferSelect;

// ============ AI-ROP CHANNEL EVENTS ============
export const aiRopChannelEvents = pgTable("ai_rop_channel_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  channelId: varchar("channel_id").references(() => aiRopChannels.id),
  channelType: text("channel_type").notNull(),
  eventType: text("event_type").notNull(), // CONNECTED | DISCONNECTED | ERROR | HEALTH_CHECK | DISCLAIMER_ACCEPTED | TEST_SENT
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiRopChannelEventsRelations = relations(aiRopChannelEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiRopChannelEvents.tenantId],
    references: [tenants.id],
  }),
  channel: one(aiRopChannels, {
    fields: [aiRopChannelEvents.channelId],
    references: [aiRopChannels.id],
  }),
}));

export const insertAiRopChannelEventSchema = createInsertSchema(aiRopChannelEvents).omit({ id: true, createdAt: true });
export type InsertAiRopChannelEvent = z.infer<typeof insertAiRopChannelEventSchema>;
export type AiRopChannelEvent = typeof aiRopChannelEvents.$inferSelect;

// ============ GROWTH: CONTACTS (multi-channel) ============
export const growthContacts = pgTable("growth_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name"),
  phone: text("phone"),
  instagramId: text("instagram_id"),
  telegramId: text("telegram_id"),
  widgetUserId: text("widget_user_id"),
  lastChannel: text("last_channel"),
  primaryChannel: text("primary_channel"),
  source: text("source"), // waha_sync | meta_warm | csv_import | crm_import | organic
  firstSeenAt: timestamp("first_seen_at"),
  lastInboundAt: timestamp("last_inbound_at"),
  lastOutboundAt: timestamp("last_outbound_at"),
  lastDialogId: varchar("last_dialog_id"),
  inboundCount: integer("inbound_count").notNull().default(0),
  outboundCount: integer("outbound_count").notNull().default(0),
  lastMessagePreview: text("last_message_preview"),
  lastChannelProvider: text("last_channel_provider"), // whatsapp_cloud:meta | whatsapp:waha
  optOut: boolean("opt_out").notNull().default(false),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const growthContactsRelations = relations(growthContacts, ({ one }) => ({
  tenant: one(tenants, { fields: [growthContacts.tenantId], references: [tenants.id] }),
}));

export const insertGrowthContactSchema = createInsertSchema(growthContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGrowthContact = z.infer<typeof insertGrowthContactSchema>;
export type GrowthContact = typeof growthContacts.$inferSelect;

// ============ GROWTH: CAMPAIGNS ============
export const growthCampaigns = pgTable("growth_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("DRAFT"),
  name: text("name").notNull(),
  channelPolicy: text("channel_policy").notNull().default("AUTO"),
  segmentId: varchar("segment_id"),
  scenarioTemplateId: varchar("scenario_template_id"),
  audienceRules: jsonb("audience_rules").$type<Record<string, unknown>>(),
  messageRules: jsonb("message_rules").$type<Record<string, unknown>>(),
  scheduleRules: jsonb("schedule_rules").$type<Record<string, unknown>>(),
  safetyRules: jsonb("safety_rules").$type<Record<string, unknown>>(),
  createdBy: varchar("created_by").references(() => users.id),
  totalQueued: integer("total_queued").notNull().default(0),
  totalSent: integer("total_sent").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  totalReplied: integer("total_replied").notNull().default(0),
  totalSkipped: integer("total_skipped").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const growthCampaignsRelations = relations(growthCampaigns, ({ one }) => ({
  tenant: one(tenants, { fields: [growthCampaigns.tenantId], references: [tenants.id] }),
  creator: one(users, { fields: [growthCampaigns.createdBy], references: [users.id] }),
}));

export const insertGrowthCampaignSchema = createInsertSchema(growthCampaigns).omit({ id: true, createdAt: true, updatedAt: true, totalQueued: true, totalSent: true, totalFailed: true, totalReplied: true, totalSkipped: true });
export type InsertGrowthCampaign = z.infer<typeof insertGrowthCampaignSchema>;
export type GrowthCampaign = typeof growthCampaigns.$inferSelect;

// ============ GROWTH: QUEUE ============
export const growthQueue = pgTable("growth_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  campaignId: varchar("campaign_id").notNull().references(() => growthCampaigns.id),
  contactId: varchar("contact_id").notNull().references(() => growthContacts.id),
  resolvedChannel: text("resolved_channel"),
  status: text("status").notNull().default("PENDING"),
  plannedAt: timestamp("planned_at").notNull(),
  sentAt: timestamp("sent_at"),
  error: text("error"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const growthQueueRelations = relations(growthQueue, ({ one }) => ({
  tenant: one(tenants, { fields: [growthQueue.tenantId], references: [tenants.id] }),
  campaign: one(growthCampaigns, { fields: [growthQueue.campaignId], references: [growthCampaigns.id] }),
  contact: one(growthContacts, { fields: [growthQueue.contactId], references: [growthContacts.id] }),
}));

export const insertGrowthQueueSchema = createInsertSchema(growthQueue).omit({ id: true, createdAt: true });
export type InsertGrowthQueueItem = z.infer<typeof insertGrowthQueueSchema>;
export type GrowthQueueItem = typeof growthQueue.$inferSelect;

// ============ GROWTH: EVENTS ============
export const growthEvents = pgTable("growth_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  campaignId: varchar("campaign_id").notNull().references(() => growthCampaigns.id),
  contactId: varchar("contact_id"),
  eventType: text("event_type").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const growthEventsRelations = relations(growthEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [growthEvents.tenantId], references: [tenants.id] }),
  campaign: one(growthCampaigns, { fields: [growthEvents.campaignId], references: [growthCampaigns.id] }),
}));

export const insertGrowthEventSchema = createInsertSchema(growthEvents).omit({ id: true, createdAt: true });
export type InsertGrowthEvent = z.infer<typeof insertGrowthEventSchema>;
export type GrowthEvent = typeof growthEvents.$inferSelect;

// ============ GROWTH: SYNC RUNS ============
export const growthSyncRuns = pgTable("growth_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  provider: text("provider").notNull(), // waha_whatsapp | meta_whatsapp
  status: text("status").notNull().default("PENDING"), // PENDING | RUNNING | SUCCESS | FAILED
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  statsJson: jsonb("stats_json").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const growthSyncRunsRelations = relations(growthSyncRuns, ({ one }) => ({
  tenant: one(tenants, { fields: [growthSyncRuns.tenantId], references: [tenants.id] }),
}));

export const insertGrowthSyncRunSchema = createInsertSchema(growthSyncRuns).omit({ id: true, createdAt: true });
export type InsertGrowthSyncRun = z.infer<typeof insertGrowthSyncRunSchema>;
export type GrowthSyncRun = typeof growthSyncRuns.$inferSelect;

// ============ GROWTH: SEGMENTS ============
export const growthSegments = pgTable("growth_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  rulesJson: jsonb("rules_json").$type<Record<string, unknown>>().notNull(),
  estimatedSize: integer("estimated_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const growthSegmentsRelations = relations(growthSegments, ({ one }) => ({
  tenant: one(tenants, { fields: [growthSegments.tenantId], references: [tenants.id] }),
}));

export const insertGrowthSegmentSchema = createInsertSchema(growthSegments).omit({ id: true, createdAt: true });
export type InsertGrowthSegment = z.infer<typeof insertGrowthSegmentSchema>;
export type GrowthSegment = typeof growthSegments.$inferSelect;

// ============ GROWTH: SCENARIO TEMPLATES ============
export const growthScenarioTemplates = pgTable("growth_scenario_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  niche: text("niche").notNull(), // electronics | fashion | food | general
  key: text("key").notNull(), // reactivation | abandoned_dialog | upsell_post_order | price_availability | nps
  title: text("title").notNull(),
  description: text("description"),
  messageBlueprintJson: jsonb("message_blueprint_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGrowthScenarioTemplateSchema = createInsertSchema(growthScenarioTemplates).omit({ id: true, createdAt: true });
export type InsertGrowthScenarioTemplate = z.infer<typeof insertGrowthScenarioTemplateSchema>;
export type GrowthScenarioTemplate = typeof growthScenarioTemplates.$inferSelect;

// ============ WAHA DISCLAIMER ACCEPTANCE ============
export const wahaDisclaimerAcceptance = pgTable("waha_disclaimer_acceptance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  accepted: boolean("accepted").notNull().default(false),
  acceptedAt: timestamp("accepted_at"),
  version: text("version").notNull().default("v1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wahaDisclaimerAcceptanceRelations = relations(wahaDisclaimerAcceptance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [wahaDisclaimerAcceptance.tenantId],
    references: [tenants.id],
  }),
}));

export const insertWahaDisclaimerSchema = createInsertSchema(wahaDisclaimerAcceptance).omit({ id: true, createdAt: true });
export type InsertWahaDisclaimer = z.infer<typeof insertWahaDisclaimerSchema>;
export type WahaDisclaimerAcceptance = typeof wahaDisclaimerAcceptance.$inferSelect;

// ============ CANONICAL MESSAGING: MESSAGES ============
export const messagingMessages = pgTable("messaging_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  dialogId: varchar("dialog_id").references(() => aiDialogs.id, { onDelete: "set null" }),
  direction: text("direction").notNull(), // inbound | outbound
  channel: text("channel").notNull(), // whatsapp_cloud | whatsapp_waha | telegram | instagram
  provider: text("provider").notNull(), // meta | waha | telegram | instagram
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  messageType: text("message_type").notNull().default("text"), // text | image | video | audio | document | location | contacts | interactive | reaction | sticker
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  providerMessageId: text("provider_message_id"),
  providerTimestamp: timestamp("provider_timestamp"),
  status: text("status").notNull().default("received"), // received | processing | processed | failed
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagingMessagesRelations = relations(messagingMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messagingMessages.tenantId],
    references: [tenants.id],
  }),
  dialog: one(aiDialogs, {
    fields: [messagingMessages.dialogId],
    references: [aiDialogs.id],
  }),
}));

export const insertMessagingMessageSchema = createInsertSchema(messagingMessages).omit({ id: true, createdAt: true });
export type InsertMessagingMessage = z.infer<typeof insertMessagingMessageSchema>;
export type MessagingMessage = typeof messagingMessages.$inferSelect;

// ============ CANONICAL MESSAGING: DEDUPLICATION ============
export const messagingDedup = pgTable("messaging_dedup", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dedupKey: varchar("dedup_key").notNull().unique(),
  messageId: varchar("message_id").notNull().references(() => messagingMessages.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagingDedupRelations = relations(messagingDedup, ({ one }) => ({
  message: one(messagingMessages, {
    fields: [messagingDedup.messageId],
    references: [messagingMessages.id],
  }),
}));

export const insertMessagingDedupSchema = createInsertSchema(messagingDedup).omit({ id: true, createdAt: true });
export type InsertMessagingDedup = z.infer<typeof insertMessagingDedupSchema>;
export type MessagingDedup = typeof messagingDedup.$inferSelect;

// ============ CANONICAL MESSAGING: OUTBOX ============
export const messageOutbox = pgTable("message_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messagingMessages.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  status: text("status").notNull().default("PENDING"), // PENDING | PROCESSING | SENT | FAILED | RETRY
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(6),
  nextRetryAt: timestamp("next_retry_at"),
  failReason: text("fail_reason"),
  failCode: text("fail_code"),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messageOutboxRelations = relations(messageOutbox, ({ one }) => ({
  message: one(messagingMessages, {
    fields: [messageOutbox.messageId],
    references: [messagingMessages.id],
  }),
  tenant: one(tenants, {
    fields: [messageOutbox.tenantId],
    references: [tenants.id],
  }),
}));

export const insertMessageOutboxSchema = createInsertSchema(messageOutbox).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessageOutbox = z.infer<typeof insertMessageOutboxSchema>;
export type MessageOutbox = typeof messageOutbox.$inferSelect;

// ============ CANONICAL MESSAGING: DELIVERIES ============
export const messagingDeliveries = pgTable("messaging_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outboxId: varchar("outbox_id").notNull().references(() => messageOutbox.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").notNull().references(() => messagingMessages.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  attemptNumber: integer("attempt_number").notNull(),
  providerMessageId: text("provider_message_id"),
  providerStatus: text("provider_status"),
  providerError: text("provider_error"),
  providerResponse: jsonb("provider_response").$type<Record<string, unknown>>(),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagingDeliveriesRelations = relations(messagingDeliveries, ({ one }) => ({
  outbox: one(messageOutbox, {
    fields: [messagingDeliveries.outboxId],
    references: [messageOutbox.id],
  }),
  message: one(messagingMessages, {
    fields: [messagingDeliveries.messageId],
    references: [messagingMessages.id],
  }),
  tenant: one(tenants, {
    fields: [messagingDeliveries.tenantId],
    references: [tenants.id],
  }),
}));

export const insertMessagingDeliverySchema = createInsertSchema(messagingDeliveries).omit({ id: true, createdAt: true });
export type InsertMessagingDelivery = z.infer<typeof insertMessagingDeliverySchema>;
export type MessagingDelivery = typeof messagingDeliveries.$inferSelect;

// ============ AI LEARNING SUGGESTIONS ============
export const aiLearningSuggestions = pgTable("ai_learning_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  topic: text("topic").notNull(),
  problemSummary: text("problem_summary").notNull(),
  suggestedContent: text("suggested_content").notNull(),
  status: text("status").notNull().default("pending"),
  sourceDialogIds: text("source_dialog_ids").array(),
  potentialRevenueImpact: integer("potential_revenue_impact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiLearningSuggestionsRelations = relations(aiLearningSuggestions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiLearningSuggestions.tenantId],
    references: [tenants.id],
  }),
}));

export const insertAiLearningSuggestionSchema = createInsertSchema(aiLearningSuggestions).omit({ id: true, createdAt: true });
export type InsertAiLearningSuggestion = z.infer<typeof insertAiLearningSuggestionSchema>;
export type AiLearningSuggestion = typeof aiLearningSuggestions.$inferSelect;

// ============ CRM LEADS ============
export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  phone: text("phone").notNull(),
  name: text("name"),
  channel: text("channel").notNull().default("whatsapp"),
  status: text("status").notNull().default("new"),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  firstMessageAt: timestamp("first_message_at"),
  lastMessageAt: timestamp("last_message_at"),
  qualifiedAt: timestamp("qualified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("crm_leads_tenant_phone_idx").on(table.tenantId, table.phone),
]);

export const crmLeadsRelations = relations(crmLeads, ({ one }) => ({
  tenant: one(tenants, {
    fields: [crmLeads.tenantId],
    references: [tenants.id],
  }),
}));

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;

// ============ MAGIC IMPORT SESSIONS ============
export const magicImportSessions = pgTable("magic_import_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull().default("telegram"),
  telegramChannel: text("telegram_channel"),
  channelUrl: text("channel_url"),
  channelUsername: text("channel_username"),
  sourceFileName: text("source_file_name"),
  email: text("email"),
  storeName: text("store_name"),
  status: text("status").notNull().default("scraping"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  scrapedPosts: integer("scraped_posts").default(0),
  extractedProducts: integer("extracted_products").default(0),
  extractedProductsData: jsonb("extracted_products_data").$type<Array<{ name: string; description: string; price: number; category: string; sku: string; imageUrl?: string }>>(),
  progressPct: integer("progress_pct").default(0),
  progressMessage: text("progress_message"),
  errorMessage: text("error_message"),
  trialExpiresAt: timestamp("trial_expires_at"),
  mediaDeletedAt: timestamp("media_deleted_at"),
  paidClickedAt: timestamp("paid_clicked_at"),
  activatedAt: timestamp("activated_at"),
  scrapeDepthMonths: integer("scrape_depth_months").default(3),
  fullScrapeTriggeredAt: timestamp("full_scrape_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const magicImportSessionsRelations = relations(magicImportSessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [magicImportSessions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [magicImportSessions.userId],
    references: [users.id],
  }),
}));

export const insertMagicImportSessionSchema = createInsertSchema(magicImportSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMagicImportSession = z.infer<typeof insertMagicImportSessionSchema>;
export type MagicImportSession = typeof magicImportSessions.$inferSelect;

// ============ SCRAPE PACKAGES ============
export const scrapePackages = pgTable("scrape_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  packageType: text("package_type").notNull(), // '1000' | '5000'
  priceKzt: integer("price_kzt").notNull(), // 6990 | 12990
  productsAdded: integer("products_added").notNull(), // 1000 | 5000
  status: text("status").notNull().default("pending"), // 'pending' | 'paid'
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: varchar("confirmed_by").references(() => users.id),
});

export const scrapePackagesRelations = relations(scrapePackages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [scrapePackages.tenantId],
    references: [tenants.id],
  }),
  confirmedByUser: one(users, {
    fields: [scrapePackages.confirmedBy],
    references: [users.id],
  }),
}));

export const insertScrapePackageSchema = createInsertSchema(scrapePackages).omit({ id: true, requestedAt: true });
export type InsertScrapePackage = z.infer<typeof insertScrapePackageSchema>;
export type ScrapePackage = typeof scrapePackages.$inferSelect;
