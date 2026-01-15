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

### Public Catalog
- `GET /api/catalog/:slug` - Get public catalog data
- `POST /api/orders` - Create order (public checkout)

### Super Admin
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/tenants` - List all tenants
- `PATCH /api/admin/tenants/:id` - Update tenant
- `GET /api/admin/plans` - List all plans
- `POST /api/admin/subscriptions/extend` - Extend subscription