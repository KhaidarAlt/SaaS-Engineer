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