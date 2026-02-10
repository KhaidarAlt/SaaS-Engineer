# SmartCatalog

## Overview
SmartCatalog is a multi-tenant SaaS platform designed to empower businesses with online product catalog creation, inventory management, and order processing via WhatsApp integration. It features AI-powered customer assistance, a Russian-first UI with internationalization capabilities, tiered subscription plans with usage limits, and comprehensive analytics. The platform aims to transform how businesses engage with customers and manage sales, particularly through messaging apps.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
- **Framework**: React 18 with TypeScript, Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query (server state), React Context (auth/theme/cart)
- **UI Components**: shadcn/ui (Radix UI base)
- **Styling**: Tailwind CSS with custom design tokens (Apple HIG-inspired minimalist design)
- **Animations**: Framer Motion
- **Form Handling**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API Pattern**: RESTful API (`/api` prefix)
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Passport.js (local strategy), bcryptjs for hashing

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Drizzle Kit (`db:push`)

### Multi-Tenancy & Features
- **Data Isolation**: `tenant_id` foreign keys for data separation.
- **Role Hierarchy**: Superadmin, Tenant Owner, Tenant Manager.
- **Subscription Plans**: Tiered plans (Старт, Про, Бизнес) enforce limits on products, categories, promotions, discounts, and managers.
- **Key Data Models**: Plans, Tenants, Users, Products/Categories, Orders/OrderItems, Discounts/Promotions.
- **Build System**: Vite for client, esbuild for server, tsx for development.
- **Smart Import**: CSV/XLSX parsing, auto-column mapping, validation, and multiple import modes (upsert by SKU, create_only, replace catalog). Supports ZIP photo import with SKU matching.
- **Catalog Templates**: Template system with 3 niches — Universal (tech/furniture/general), Fashion (clothing/shoes/accessories), Food (restaurants/delivery). Each template defines product fields, AI role, WAU features. Template selector at /dashboard/templates with AI training window. Dynamic product form adapts fields per template. Schema: tenants.catalogTemplate (universal|fashion|food), template registry in shared/templateRegistry.ts.
  - **Public Catalog Routing**: CatalogRouter.tsx switches between template-specific catalog layouts based on tenant.catalogTemplate. Routes: /c/:slug renders FashionCatalog (9:16 vertical swipe feed), FoodCatalog (horizontal category tabs + dish cards), or CatalogHome (universal grid/list/table).
  - **Universal Catalog**: Sort options (price asc/desc, name, newest), view modes (grid/list/table), brand filter. CatalogHome.tsx.
  - **Fashion Catalog**: Full-screen vertical swipe feed, right-side overlay controls, bottom sheet for size/color selection. FashionCatalog.tsx.
  - **Food Catalog**: Horizontal category tabs with Intersection Observer, dish cards (image right, text left), modifier selection modal, floating cart summary. FoodCatalog.tsx.
  - **AI Positioning**: Template-specific AI roles (AI Консультант, AI Стилист, AI Официант) configured in templateRegistry.ts, used by backend AI chat endpoint and frontend ProductDetailPage.
- **Product Management**: Detailed product variant management with SKU, price, and stock tracking per variant; robust image handling (compression, preview); template-specific fields (Universal: brand, unitOfMeasure, specs; Fashion: gender, sizes, colors, sizeColorStock; Food: ingredients, modifiers, portionSize, cookingTime, weight, calories, allergens).
- **WhatsApp Integration**: WAHA (self-hosted WhatsApp API) integration for order notifications, QR code login, status monitoring, and webhook events. AI-assistant integrates with WAHA for customer support.
- **Catalog Health QA**: Scoring system for product data quality (images, descriptions, prices) with actionable recommendations.
- **Admin Panel**: Superadmin features for user and tenant management, plan configuration, subscription extension/changes, and lead tracking.
- **Plan Selection**: Popup system to guide users through plan selection with feature comparisons and restrictions based on chosen plan.
- **Navigation**: Grouped collapsible menu with 5 sections (Основные, Настройка каталога, Маркетинг, Настройки AI, Дополнительные настройки). Single-expanded group behavior with localStorage persistence per user.
- **Subdomain System**: Primary catalog access via subdomains: `{slug}.botfactory.kz` (e.g., megashop.botfactory.kz). Requires wildcard DNS `*.botfactory.kz` pointing to platform. Server middleware `extractSubdomain()` parses host header, matches subdomain to tenant slug via `getTenantBySlug()`, and rewrites URL to `/c/{slug}`. Cloudflare handles wildcard SSL automatically. All catalog URLs (QR codes, copy links, AI assistant, sidebar, OG meta) use subdomain format. Settings page shows subdomain with copy button. Custom first-level domains (e.g., myshop.kz) are marked as "coming soon" in settings UI — planned via Cloudflare for SaaS or dedicated server approach. Legacy custom domain middleware still works for any tenant with `customDomain` field set. Schema fields: customDomain, domainVerified. Client-side uses `useCatalogSlug` hook (client/src/hooks/useCatalogSlug.ts) and `basePath` prop pattern for clean URLs on custom domains.
- **Business Consultant**: AI-powered business consultant with 5 modes (Analyst, Marketer, ROP, Finance, Support) for data-driven insights and platform guidance.

## Platform Admin Setup (one-time)
- **Wildcard DNS**: Add CNAME record in Cloudflare for `botfactory.kz`: Name=`*`, Target=`saa-s-engineer--m528dpa.replit.app`, Proxy=ON. This enables all tenant subdomains (`*.botfactory.kz`) to resolve and get SSL automatically. This is a one-time setup by the platform owner — tenant users do not need to configure anything.

## External Dependencies
### Database
- PostgreSQL

### Messaging Integrations
- WAHA (WhatsApp API)
- Telegram Bot API (prepared)
- **Meta WhatsApp Cloud API** (fully integrated): OAuth flow with CSRF protection (HMAC-signed state, nonce validation), phone number management, template system with Meta approval workflow, warmup logic (50 msg/day → full features over 7 days), AI risk monitoring, webhook signature verification (raw body + timingSafeEqual), broadcast campaigns support
- **Instagram Direct** (fully integrated): OAuth flow with CSRF protection (HMAC-signed state, nonce validation, 5-minute expiry), Instagram Business Account linking via Facebook Page, webhook message handling with signature verification, automatic AI-powered message responses
  - API: GET/DELETE /api/instagram/integration, POST /api/instagram/onboarding/start, GET /api/instagram/oauth/callback, GET /api/instagram/messages, GET/POST /api/instagram/webhook
  - Uses existing META_APP_ID/META_APP_SECRET credentials
  - Schema: instagramIntegrations (OAuth tokens, account info), instagramMessages (message history)

### AI Services
- OpenAI API
- Google Generative AI (alternative)
- Internal knowledge base system for RAG

### File Storage
- Replit Object Storage (Google Cloud Storage) for persistent files, with presigned URL uploads.

### Payment Processing
- **Kaspi Business** (fully integrated): 
  - 3-step verification flow (add SmartCatalog as employee → confirm in app → enter API key)
  - Invoice creation via kaspi-business.service.ts
  - Payment status tracking with auto-polling
  - Post-payment notifications (Telegram + WhatsApp)
  - WhatsApp payment link delivery to customers via WAHA
  - API: POST /api/kaspi/request-verification, /api/kaspi/confirm-verification, /api/payments/kaspi-business/create
- Stripe (scaffolded)

### CRM System (Internal)
- **CRM Dashboard**: Dual-view interface with Kanban board and Table view at `/dashboard/crm`
- **Deal Stages**: 6 statuses (new, in_progress, awaiting_payment, paid, completed, cancelled)
- **Payment Statuses**: 3 statuses (pending, paid, cancelled)
- **AI Integration**:
  - POST /api/crm/deals/:id/ai-analyze - AI analysis with recommendations
  - POST /api/crm/deals/:id/generate-message - AI message generation (4 templates: payment_reminder, delivery_confirmation, cart_followup, thank_you)
- **Order Detail Page**: Enhanced with AI analysis panel, message generator, WhatsApp integration
- **Stats Dashboard**: Real-time deal counts by status

### CRM Integrations (External)
- Bitrix24
- amoCRM