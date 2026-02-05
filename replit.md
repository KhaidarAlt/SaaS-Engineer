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
- **Product Management**: Detailed product variant management with SKU, price, and stock tracking per variant; robust image handling (compression, preview); gender, size, and color attributes with availability-based filtering.
- **WhatsApp Integration**: WAHA (self-hosted WhatsApp API) integration for order notifications, QR code login, status monitoring, and webhook events. AI-assistant integrates with WAHA for customer support.
- **Catalog Health QA**: Scoring system for product data quality (images, descriptions, prices) with actionable recommendations.
- **Admin Panel**: Superadmin features for user and tenant management, plan configuration, subscription extension/changes, and lead tracking.
- **Plan Selection**: Popup system to guide users through plan selection with feature comparisons and restrictions based on chosen plan.
- **Navigation**: Grouped collapsible menu with 5 sections (Основные, Настройка каталога, Маркетинг, Настройки AI, Дополнительные настройки). Single-expanded group behavior with localStorage persistence per user.
- **Business Consultant**: AI-powered business consultant with 5 modes (Analyst, Marketer, ROP, Finance, Support) for data-driven insights and platform guidance.

## External Dependencies
### Database
- PostgreSQL

### Messaging Integrations
- WAHA (WhatsApp API)
- Telegram Bot API (prepared)
- **Meta WhatsApp Cloud API** (fully integrated): OAuth flow with CSRF protection (HMAC-signed state, nonce validation), phone number management, template system with Meta approval workflow, warmup logic (50 msg/day → full features over 7 days), AI risk monitoring, webhook signature verification (raw body + timingSafeEqual), broadcast campaigns support

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

### CRM Integrations
- Bitrix24
- amoCRM