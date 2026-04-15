# SmartCatalog

## Overview
SmartCatalog is a multi-tenant SaaS platform designed for online product catalog creation, inventory management, and order processing, primarily through WhatsApp. It integrates AI for customer assistance, features a Russian-first UI with internationalization, supports tiered subscriptions, and provides comprehensive analytics. The platform aims to enhance customer engagement and streamline sales within messaging app ecosystems, targeting significant market share in digital commerce.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
SmartCatalog utilizes a modern web stack: React 18, TypeScript, and Vite for the frontend, styled with `shadcn/ui` and Tailwind CSS, following an Apple HIG-inspired minimalist design. TanStack React Query manages server state, and React Context handles global client state. The backend is built with Node.js, Express.js, and TypeScript, exposing a RESTful API. PostgreSQL, managed with Drizzle ORM, serves as the database.

Key architectural decisions include:

-   **Multi-Tenancy**: Implemented using `tenant_id` foreign keys for data isolation and a role-based access control system.
-   **Dynamic Catalog System**: Features templated layouts, AI-driven product field adaptation, advanced product variant management, optimized image/video handling, stock display toggles, and manual drag-and-drop sort ordering for categories and products.
-   **AI Integration**: Incorporates an AI-powered business consultant with five modes (Analyst, Marketer, ROP, Finance, Support), including an AI-РОП (Sales Control Center) for goal-oriented AI assistants, KPI dashboards, knowledge base management, and a comprehensive AI testing suite. AI analytics provide sales funnel analysis, bottleneck detection, and an auto-audit system. An AI Coach analyzes unsuccessful dialogues for knowledge gaps.
-   **Custom Domains & Subdomains**: Supports tenant-branded subdomains and self-service custom domains with automated DNS verification and SSL provisioning via Caddy.
-   **CRM System**: An internal CRM dashboard with Kanban and table views for deals, augmented by AI for analysis and message generation. It uses a split status model for operational and payment statuses. Includes a lead pipeline system that tracks inbound WhatsApp contacts, auto-classifying them based on activity and purchase intent.
-   **AI Sales Optimization**: Provides per-product sales tools like priority recommendations, cross-sell suggestions, upsell mappings, and configurable sales boosters.
-   **AI-РОП Module Structure**: Includes an executive dashboard, AI testing features (Readiness Score, test modes, WhatsApp Simulator), AI analytics (KPI Dashboard, Sales Funnel, Objection Tracking, Auto-Audit System), and a Growth module for multi-channel campaign management (Reactivation, Upsell, Abandoned, Reminders, NPS) with a 4-step campaign builder.
-   **Audience Management**: Auto-syncs contacts via WAHA/Meta with GPT-4o-mini conversation analysis, enriching contacts with order data and classifying `dealStatus`.
-   **Anti-ban Circuit Breaker**: Automatically pauses campaigns if the fail rate exceeds 30%.
-   **Canonical Messaging Layer**: Provides channel-agnostic inbound message normalization, deduplication, dialog resolution, and persistent storage with adapters for Meta WhatsApp Cloud and WAHA. Includes an outbound pipeline with an outbox worker and critical tenant isolation to prevent cross-tenant data leakage.
-   **Analytics Dashboard**: Features 12 stat cards covering visits, products, orders, revenue, and conversion. Includes configurable commission rates, a payment methods donut chart, and a 4-stage sales funnel.
-   **Magic Import**: An onboarding funnel with two source types: (1) Telegram channel scraping (5 pages, ~100 posts) and (2) File upload (Excel/XLSX, PDF, DOCX — up to 20 MB). Both use OpenAI GPT-4o-mini to extract product data, automatically creating a tenant, user, and up to 20 products with a trial period. The `/magic-import` hero page has a tab switcher between sources. Backend uses `multer` for file uploads; `xlsx`, `pdf-parse`, and `mammoth` for parsing. Sessions have `sourceType` ('telegram'|'file') and `sourceFileName` fields. `runFullScrape` is skipped for file-based sessions. Features split-screen onboarding (form + SSE live feed), AI preview cards, and success screen with "Я оплатил" flow. Catalogs show a demo banner for magic-import tenants and a suspended overlay when trial expires. Admin panel includes a Magic Import funnel stats card and per-tenant SmartCatalog/AI-РОП toggle switches with confirm-payment button. AI-РОП section shows a lock screen when `aiRopEnabled=false`.
-   **Pricing & Billing**: Implements a Founder's Edition plan, dialog-based billing with credit rollover, purchasable dialog packages, and a free trial.
-   **Catalog Links**: Always uses the tenant's configured domain for all order notifications and API responses.
-   **WhatsApp Integration**: Floating WhatsApp widget and promo buttons use the `notificationPhone` with fallback to `contactPhone`.
-   **Sales Closer Mode**: AI system prompt enforces every message ending with a question or CTA, bans passive phrases, requires a 3-step out-of-stock handling, and auto-suggests installment calculations for high-value items.
-   **Visual Product Delivery**: AI system prompts display product images using Markdown `![name](url)` with price and catalog links for relevant queries.
-   **Payment Confirmation Flow**: AI is explicitly forbidden from confirming payments; managers handle this via CRM. Payment keyword detection updates order status to `payment_verification`.
-   **WhatsApp Phone Auto-Fill in Checkout**: Appends `?wp=PHONE` to catalog/product URLs, pre-filling and making the phone field read-only in the checkout form.

## External Dependencies
-   **Database**: PostgreSQL (with `pgvector` extension)
-   **Messaging Integrations**:
    -   WAHA (Self-hosted WhatsApp API - NOWEB engine)
    -   Meta WhatsApp Cloud API
    -   Instagram Direct
-   **AI Services**:
    -   OpenAI API (gpt-4o, gpt-4o-mini, text-embedding-3-small)
    -   Google Generative AI
-   **File Storage**: Replit Object Storage (Google Cloud Storage)
-   **Payment Processing**:
    -   Kaspi Business (full integration with 3-step verification, invoice creation, payment status tracking, automated WhatsApp payment flow)
    -   Stripe (scaffolded)