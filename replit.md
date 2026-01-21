# SmartCatalog

## Overview

SmartCatalog is a multi-tenant SaaS platform that enables businesses to create beautiful online product catalogs, manage inventory, handle orders via WhatsApp integration, and leverage AI-powered customer assistance. The platform features a Russian-first UI with support for future internationalization, tiered subscription plans with usage limits, and comprehensive analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state, React Context for auth/theme/cart
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens following Apple HIG-inspired minimalist design
- **Animations**: Framer Motion for smooth transitions
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API routes under `/api` prefix
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Authentication**: Passport.js with local strategy, bcryptjs for password hashing

### Database Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with push strategy (`db:push` command)

### Multi-Tenancy Design
- Each business operates as a separate tenant with data isolation via `tenant_id` foreign keys
- Role hierarchy: superadmin (platform owner) → owner (tenant) → manager (tenant staff)
- Subscription plans enforce limits on products, categories, promotions, discounts, and managers

### Key Data Models
- **Plans**: Subscription tiers with pricing and feature limits (Старт, Про, Бизнес)
- **Tenants**: Business entities with branding, contact info, and integration settings
- **Users**: Authentication and role-based access control
- **Products/Categories**: Catalog management with tenant isolation
- **Orders/OrderItems**: Order processing workflow
- **Discounts/Promotions**: Pricing rules and campaigns

### Build System
- **Development**: Vite dev server with HMR, tsx for TypeScript execution
- **Production**: Custom build script using esbuild for server, Vite for client
- **Output**: Server bundled to `dist/index.cjs`, client assets to `dist/public`

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Session persistence with connect-pg-simple

### Messaging Integrations (Prepared)
- **WAHA**: Self-hosted WhatsApp API integration for order notifications
- **Telegram Bot API**: Fallback notification channel
- **Meta WhatsApp Cloud API**: Stub prepared for future implementation

### AI Services (Prepared)
- OpenAI API integration for AI assistant functionality
- Google Generative AI as alternative provider
- Knowledge base system for RAG-style responses

### File Storage
- Local filesystem for development with abstraction layer for S3-compatible storage migration

### Payment Processing (Prepared)
- Stripe integration scaffolded for subscription billing

## Recent Changes

### January 2026
- Implemented complete database storage layer with PostgreSQL
- Added authentication with Passport.js and bcrypt password hashing
- Created all CRUD API endpoints for products, categories, discounts, orders
- Implemented plan limit enforcement (products, categories, discounts) 
- Fixed product creation to handle empty optional fields
- Default pricing plans created on server startup
- Multi-tenant data isolation verified and working
- Added WhatsApp button in orders panel to contact customers directly
- Implemented WhatsApp checkout flow: order saved to DB first, then customer can send order details to store owner via WhatsApp
- Created WhatsAppSendButton component with copy fallback for blocked popups
- Helper functions for KZ phone normalization and order text formatting
- Added product variants management (ProductVariantsSection component)
- Variant options support: option1/option2 name+value pairs (e.g., Size: M, Color: Blue)
- Variant-specific SKU, price override, and stock tracking per variant
- Built Smart Import page: CSV/XLSX parsing with auto-column mapping (RU/EN aliases), preview first 20 rows, validation with errors/warnings
- Added import modes: upsert by SKU (selective field updates), create_only, replace catalog
- Implemented ZIP photo import: JSZip parsing, SKU-based matching, unmatched image detection
- Created API endpoint /api/import/product for upsert/create operations with field selection
- Enhanced ProductFormPage: auto-generate SKU button, clothing/shoe size selector, color picker with presets and custom colors
- Added product size (sizes JSONB) and color (colors JSONB) fields to products table
- Enhanced ProductImagesSection: image preview before upload, automatic compression to 1920px max, file size display
- Sizes and colors displayed in public catalog ProductDetailPage
- Added gender field (male/female/kids) to products with optional selection
- Sizes now include quantity per size (size + qty structure)
- Added children's clothing sizes (56-164) and children's shoe sizes (16-34)
- Catalog shows sizes with availability based on qty
- Added catalog filtering by size, color, and gender in CatalogHome
- Filter UI with badges for gender, dropdown for sizes, badges for colors
- ProductDetailPage displays gender badge and sizes with availability indicator
- Added sizeColorStock field to products table for tracking inventory by size+color combinations
- ProductFormPage shows size x color matrix for quantity input when both sizes and colors are selected
- ProductDetailPage has interactive size/color selection with disabled state for unavailable combinations
- CatalogHome filters updated to work with sizeColorStock for accurate availability filtering
- Dashboard products list now shows uploaded images from product_images table
- Enhanced catalog header: logo, clickable phone, 2GIS-linked address, working hours (desktop)
- Enhanced catalog footer: logo, description (500 char limit), contact info, copyright
- Category filter refactored to use dropdown menus for subcategories instead of flat badges
- Color filter changed from badges to Select dropdown for consistency
- Removed gender filter from catalog UI
- Added tenant schema fields: gisLink, workingHours, ogTitle, ogDescription, ogImageUrl
- Settings page: logo/OG image upload, working hours, 2GIS link, custom slug editing
- QR code generation with download and copy-to-clipboard functionality
- WAHA WhatsApp integration implemented:
  - Server service (server/services/waha.ts) for WAHA API communication
  - waha_instances table for storing tenant WhatsApp connections
  - Full API: create, start, stop, delete instances, get QR codes, status polling
  - Settings page WhatsApp section: connect via QR, status display, disconnect
  - Auto-detect pending instances on page load, auto-refresh status
  - Webhook endpoint for receiving WAHA events
  - Fixed duplicate AI messages by filtering WAHA webhook events (only "message", not "message.any")
- AI Settings extended:
  - aiLanguage: Language selection (ru/kz/en) for AI responses
  - aiSystemPrompt: Custom instructions from store owner added to AI system prompt
  - aiTypingDelay: Simulated typing delay (0-10 sec) before sending WhatsApp response
  - Settings UI: Language Select, Typing Delay Slider, System Prompt Textarea in SettingsPage
- Catalog Health QA scoring (CatalogHealthPage):
  - Weighted scoring algorithm: images 30%, descriptions 20%, zero prices 25%, inactive products 15%, empty categories 10%
  - Issue detection for products without images/descriptions/prices, empty categories
  - Actionable recommendations displayed with affected item counts
- Cart UX improvements:
  - Floating cart button on mobile with pulse animation and item count badge
  - Toast notification with direct link to checkout after adding item
- Landing page updated:
  - Headline: "Преврати WhatsApp в интернет-магазин"
  - Demo button: "Посмотреть пример магазина" linking to /c/demo
- Demo catalog for testing:
  - Demo tenant with slug="demo" created with sample products
  - Demo banners on catalog, cart, and checkout pages
  - After demo order, customer can send order to their own WhatsApp
  - CTA to create their own catalog after successful demo order

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user and tenant
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Tenant Dashboard
- `GET /api/products` - List tenant products
- `POST /api/products` - Create product (plan limits enforced)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/:productId/variants` - List product variants
- `POST /api/products/:productId/variants` - Create variant
- `PUT /api/products/:productId/variants/:variantId` - Update variant
- `DELETE /api/products/:productId/variants/:variantId` - Delete variant
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (plan limits enforced)
- `GET /api/discounts` - List discounts
- `POST /api/discounts` - Create discount (plan limits enforced)
- `GET /api/orders` - List orders
- `PATCH /api/orders/:id` - Update order status
- `GET /api/analytics` - Get analytics data
- `GET /api/billing` - Get subscription and usage info
- `POST /api/import/product` - Smart import product (upsert/create mode)

### Public Catalog
- `GET /api/catalog/:slug` - Get public catalog data
- `POST /api/orders` - Create order (public checkout)

### Super Admin
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/tenants` - List all tenants
- `PATCH /api/admin/tenants/:id` - Update tenant
- `GET /api/admin/plans` - List all plans
- `POST /api/admin/subscriptions/extend` - Extend subscription

### WAHA WhatsApp Integration
- `GET /api/waha/health` - Check WAHA server status
- `GET /api/waha/instances` - List tenant WhatsApp instances
- `POST /api/waha/instances` - Create new WhatsApp instance
- `GET /api/waha/instances/:id/qr` - Get QR code for scanning
- `GET /api/waha/instances/:id/status` - Get instance live status
- `POST /api/waha/instances/:id/start` - Start stopped instance
- `POST /api/waha/instances/:id/stop` - Stop running instance
- `DELETE /api/waha/instances/:id` - Delete instance
- `POST /api/waha/webhook` - WAHA webhook endpoint