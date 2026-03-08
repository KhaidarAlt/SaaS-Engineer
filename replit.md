# SmartCatalog

## Overview
SmartCatalog is a multi-tenant SaaS platform designed to empower businesses with online product catalog creation, inventory management, and order processing, primarily through WhatsApp. It integrates AI for customer assistance, features a Russian-first UI with internationalization capabilities, supports tiered subscription models, and provides comprehensive analytics. The platform's core purpose is to enhance customer engagement and streamline sales management within messaging app ecosystems, aiming to capture significant market share by offering innovative tools for digital commerce.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
SmartCatalog uses a modern web stack: React 18, TypeScript, and Vite for the frontend, styled with `shadcn/ui` and Tailwind CSS, following an Apple HIG-inspired minimalist design. TanStack React Query manages server state, and React Context handles global client state. The backend is built with Node.js, Express.js, and TypeScript, exposing a RESTful API. PostgreSQL, managed with Drizzle ORM, serves as the database.

Key architectural decisions include:

-   **Multi-Tenancy**: Achieved through `tenant_id` foreign keys for data isolation and a role-based access control system (Superadmin, Tenant Owner, Tenant Manager).
-   **Dynamic Catalog System**: Features templated layouts (Universal, Fashion, Food), AI-driven product field adaptation, advanced product variant management, optimized image/video handling, and a catalog data quality scoring system.
-   **AI Integration**: Incorporates an AI-powered business consultant with five modes (Analyst, Marketer, ROP, Finance, Support). A dedicated AI-РОП (Sales Control Center) manages goal-oriented AI assistants, including KPI dashboards, knowledge base management, and a comprehensive AI testing suite (readiness scores, simulation personas, stress tests). AI analytics provide KPI dashboards, sales funnel analysis, bottleneck detection, objection tracking, and an auto-audit system. An AI Coach analyzes unsuccessful dialogs to identify knowledge gaps and suggest knowledge base articles, which users can approve to update the bot's context.
-   **Custom Domains & Subdomains**: Supports tenant-branded subdomains (`*.botfactory.kz`) and self-service custom domains with automated DNS verification and SSL provisioning via Caddy.
-   **CRM System**: An internal CRM dashboard with Kanban and table views for deals, augmented by AI for analysis and message generation, and enhanced order detail pages.
-   **AI Sales Optimization**: Provides per-product sales tools like priority product recommendations, cross-sell suggestions (up to 3 related products), and upsell mappings (more expensive alternatives). Sales boosters (Upsell, Offer cheaper, Limited offer, Auto promo-zone) are configurable in the Strategy panel.
-   **AI-РОП Module Structure**:
    -   **Overview**: Executive dashboard with ScoreHeroCard, ReadinessCard, KpiStrip, BottleneckSummaryCard, InsightsCard, ActionCenter, RecentDialogs, and an inline QuickTestChatMini.
    -   **AI Testing**: Features a 4-category AI Readiness Score (Completeness, Behavior, Operations, Testing), three test modes (Free Chat, Client Simulation, Stress Test), and a WhatsApp Simulator for evaluating AI responses.
    -   **AI Analytics**: Offers a KPI Dashboard, Sales Funnel, Bottleneck Detection, Objection Tracking, Handover Analysis, Training Impact, Trigger Effectiveness, Dialogs List, and an Auto-Audit System.
    -   **Growth**: A multi-channel campaign engine (Reactivation, Upsell, Abandoned, Reminders, NPS) with a 4-step campaign builder for goal/channel selection, audience targeting, AI-assisted message creation, and preview. It uses a background queue worker for message delivery.
    -   **Audience**: Manages auto-syncing contacts via WAHA/Meta, provides contact filtering, and allows segment management.
    -   **Scenarios**: Offers 20 pre-seeded scenario templates across various niches and types for campaign creation.
    -   **Anti-ban Circuit Breaker**: Automatically pauses campaigns if the fail rate exceeds 30%.
-   **Canonical Messaging Layer**: Provides channel-agnostic inbound message normalization, deduplication, dialog resolution, and persistent storage. It includes adapters for Meta WhatsApp Cloud and WAHA, a provider registry, and a core system for processing and sending messages with policy gates. An outbound pipeline with an outbox worker handles message delivery with exponential backoff and retry policies.
-   **Pricing & Billing**: Implements a Founder's Edition plan, dialog-based billing with credit rollover, purchasable dialog packages, a 14-day refund policy, and a 2-day free trial.
-   **Visual Product Delivery**: AI system prompts are configured to display product images using Markdown format `![name](url)` with price and catalog links for relevant queries.
-   **Typing Simulation**: Simulates human-like typing delays based on message length, with `startTyping`/`stopTyping` statuses sent via the WAHA adapter.

## External Dependencies
-   **Database**: PostgreSQL (with `pgvector` extension for semantic search)
-   **Messaging Integrations**:
    -   WAHA (Self-hosted WhatsApp API) — NOWEB engine. Webhooks (`message`, `message.any`) are the primary message intake — instant response to all incoming messages. A lightweight `WahaMessagePoller` runs every 10s as fallback, polling only known/active chats (registered via `addWatchedChatId` from webhooks or DB conversations). No contact scanning. Manual watch: `GET /api/waha/watch-phone/:phone`.
    -   Meta WhatsApp Cloud API (full integration including OAuth, template management, warm-up logic, webhook verification, broadcast support).
    -   Instagram Direct (full integration including OAuth, Facebook Page linking, webhook handling).
-   **AI Services**:
    -   OpenAI API (gpt-4o, gpt-4o-mini, text-embedding-3-small).
    -   Google Generative AI.
-   **File Storage**: Replit Object Storage (Google Cloud Storage).
-   **Payment Processing**:
    -   Kaspi Business (full integration with 3-step verification, invoice creation, payment status tracking, automated WhatsApp payment flow).
        -   Kaspi payment link is sent via WhatsApp when the customer sends their order notification message (via wa.me link). The WAHA handler extracts the order number from the message, looks up the order and payment link, and replies with the Kaspi link in the same chat. This avoids the "No LID for user" WAHA error that occurs when trying to proactively message unknown contacts.
        -   Detects payment confirmation keywords ("оплатил", "оплатила", etc.) in WhatsApp messages before AI processing; updates order to `payment_verification` status and sends Telegram notification to manager.
        -   Sends WhatsApp thank-you message when manager marks order as paid in CRM; auto-advances order to `in_progress`.
        -   AI system prompt updated to defer to automated payment flow instead of manually sending links.
    -   Stripe (scaffolded).