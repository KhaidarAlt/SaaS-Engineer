# SmartCatalog

## Overview
SmartCatalog is a multi-tenant SaaS platform empowering businesses with online product catalog creation, inventory management, and order processing, primarily via WhatsApp. It includes AI-powered customer assistance, a Russian-first UI with internationalization, tiered subscription plans, and comprehensive analytics. The platform aims to revolutionize customer engagement and sales management through messaging apps.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
SmartCatalog utilizes a modern web stack with React 18, TypeScript, and Vite for the frontend, employing `shadcn/ui` with Tailwind CSS for an Apple HIG-inspired minimalist design. State management is handled by TanStack React Query for server state and React Context for global client state. The backend is built with Node.js, Express.js, and TypeScript, providing a RESTful API. PostgreSQL is the chosen database, managed with Drizzle ORM.

Key architectural decisions include:
- **Multi-Tenancy**: Data isolation using `tenant_id` foreign keys and a robust role hierarchy (Superadmin, Tenant Owner, Tenant Manager).
- **Dynamic Catalog System**: Templated catalog layouts (Universal, Fashion, Food) with AI roles adapting product fields and public view based on tenant configuration. Features include advanced product variant management, robust image/video handling with optimization, and a scoring system for catalog data quality.
- **AI Integration**: AI-powered business consultant with five modes (Analyst, Marketer, ROP, Finance, Support) for insights. A dedicated AI-РОП (Sales Control Center) manages goal-oriented AI assistants, including goal selection, KPI dashboards, handover rules, knowledge base management, and a comprehensive AI testing suite with readiness scores, simulation personas, and stress tests. AI analytics provide KPI dashboards, sales funnel analysis, bottleneck detection, objection tracking, and an auto-audit system.
- **AI Coach (Semi-Auto Learning)**: gpt-4o analyzes unsuccessful dialogs, identifies knowledge gaps, and suggests knowledge base articles. Users approve/edit/reject suggestions on the Training page. Approved items are inserted into both `knowledge_items` and `ai_knowledge_articles` so the bot's context stuffing picks them up immediately. Schema: `ai_learning_suggestions`. API: 5 endpoints under `/api/ai/coach/*` in `server/ai-coach-routes.ts`. Service: `server/services/ai-coach.service.ts`. Frontend: `client/src/features/aiRop/training/components/AiCoachPanel.tsx` (first tab "AI Coach" in Training page).
- **Custom Domains & Subdomains**: A flexible system allowing tenants to use branded subdomains (`*.botfactory.kz`) and self-service custom domains with automated DNS verification and SSL provisioning via Caddy.
- **CRM System**: An internal CRM dashboard featuring Kanban and table views for deals, integrated with AI for analysis and message generation, and enhanced order detail pages.
- **AI Sales Optimization**: Per-product sales tools accessible via "AI продажи" menu in Products table: priority products per category (AI recommends first for generic queries), cross-sell recommendations (up to 3 related products suggested after selection), and upsell mapping (more expensive alternative suggested by AI). Sales boosters (Апселл, Предложить дешевле, Ограниченное предложение, Авто промо-зона) with tooltip descriptions in Strategy panel. Schema: category_ai_priority, product_cross_sell, product_upsell.

## AI-РОП Module Structure
- **Overview Tab** (executive dashboard at /dashboard/ai/rop/overview):
  - ScoreHeroCard: Circular animated progress 0-100, color-coded labels, breakdown bars (completeness/behavior/operations/testing), deep-link CTAs
  - ReadinessCard: READY/WARNING/BLOCKED badge, prioritized blockers list, fix deep links
  - KpiStrip: 5 KPI cards (dialogs, success, handover, abandoned, revenue/avg messages), empty state CTA
  - BottleneckSummaryCard: Main drop-off stage with rate and reasons
  - InsightsCard: Up to 5 auto-generated insights (price dropoff, early handover, low success, compare weak, no triggers, sparse KB, delivery weak)
  - ActionCenter: Smart recommendations based on score + analytics (installment, price trigger, stress test, KB fill)
  - RecentDialogs: Last 8 dialogs with stage/objection preview, clickable to detail modal
  - QuickTestChatMini: Inline chat testing (last 5 messages), auto-creates testing session
  - All components at client/src/features/aiRop/overview/

- **AI Testing Tab** (fully implemented at /dashboard/ai/rop/testing):
  - AI Readiness Score: 4-category scoring model (Completeness 0-30, Behavior 0-30, Operations 0-20, Testing 0-20)
  - 3 test modes: Free Chat, Client Simulation (6 personas), Stress Test (10 scenarios)
  - WhatsApp Simulator: Phone-frame UI with chat bubbles, typing indicator, micro-evaluation per AI response
  - Schema: ai_testing_sessions, ai_testing_messages, ai_score_snapshots, ai_stress_test_runs
  - API: 10 endpoints under /api/ai/testing/* in server/ai-testing-routes.ts
  - Frontend: Feature module at client/src/features/aiRop/testing/

- **AI Analytics Tab** (fully implemented at /dashboard/ai/rop/analytics):
  - KPI Dashboard, Sales Funnel, Bottleneck Detection, Objection Tracking, Handover Analysis
  - Training Impact, Trigger Effectiveness, Dialogs List with detail modal
  - Auto-Audit System with severity-ranked findings and deep-link CTAs
  - Schema: ai_dialogs, ai_dialog_events, ai_analytics_audit_runs, ai_audit_findings
  - API: ~10 endpoints under /api/ai/analytics/* in server/ai-analytics-routes.ts
  - Frontend: Feature module at client/src/features/aiRop/analytics/

- **Growth Tab ("Рост")** (fully implemented at /dashboard/ai/rop/growth):
  - Multi-channel campaign engine: Reactivation, Upsell, Abandoned, Reminders, NPS
  - Channel-agnostic messaging via unified messagingProvider.ts (WAHA, Meta WhatsApp, Telegram, Instagram)
  - 4-step Campaign Builder: Goal/Channel → Audience (with live estimate) → Message (AI-assisted, variables) → Preview (safety badges, recipient table, WAHA warning)
  - Background queue worker (10s interval, daily caps, quiet hours, opt-out respect)
  - Schema: growth_contacts, growth_campaigns, growth_queue, growth_events
  - API: ~14 endpoints under /api/ai-rop/growth/* in server/ai-rop-growth-routes.ts
  - Frontend: Feature module at client/src/features/aiRop/growth/
  - Note: "Умный контакт" (Smart Contact) was merged into this Growth tab; old route redirects to growth

- **Audience Tab** (at /dashboard/ai/rop/growth/audience):
  - Auto-sync audience via WAHA (chat history) or Meta (messaging_messages aggregation)
  - Sync runs tracked in growth_sync_runs table (PENDING → RUNNING → SUCCESS/FAILED)
  - Contact list with filters: All, Inactive 30+d, Abandoned dialogs, Active 7d, Has inbound
  - Segment management: save filtered audience as named segments with estimated size
  - Provider detection: auto-detects WAHA or Meta provider for sync
  - Schema: growth_sync_runs, growth_segments (extended growth_contacts with source, stats, lastChannelProvider)
  - API: /api/ai-rop/growth/sync, /api/ai-rop/growth/audience, /api/ai-rop/growth/segments, /api/ai-rop/growth/provider-info
  - Frontend: client/src/features/aiRop/growth/pages/AudiencePage.tsx

- **Scenarios Tab** (at /dashboard/ai/rop/growth/scenarios):
  - 20 pre-seeded scenario templates across 4 niches (electronics, fashion, food, general)
  - 5 scenario types per niche: reactivation, upsell, abandoned_dialog, price_availability, nps
  - Template cards with message preview, placeholders, copy-to-clipboard, "Use" navigation
  - Niche filter selector
  - Schema: growth_scenario_templates
  - API: /api/ai-rop/growth/scenario-templates
  - Frontend: client/src/features/aiRop/growth/pages/ScenariosPage.tsx

- **Anti-ban Circuit Breaker**:
  - Growth worker auto-pauses campaigns if fail rate > 30% with >= 5 processed messages
  - Campaign health endpoint: /api/ai-rop/growth/campaigns/:id/health
  - AUTO_PAUSED event logged with fail rate reason

## Canonical Messaging Layer
- **Purpose**: Channel-agnostic inbound message normalization, deduplication, dialog resolution, and persistent storage
- **Schema**: messaging_messages (uuid PK, tenantId, dialogId FK→ai_dialogs, direction, channel, provider, fromAddress, toAddress, messageType, content jsonb, providerMessageId, status, meta jsonb), messaging_dedup (sha256 dedupKey unique, messageId FK)
- **Shared Types**: server/messaging/types.ts — NormalizedInboundMessage, NormalizedStatusUpdate, NormalizedOutbound, ProviderSendResult, SendOutboundFn (channel-agnostic contracts)
- **Adapter A (Meta)**: server/messaging/providers/metaWhatsAppAdapter.ts — normalizes Meta WhatsApp Cloud webhook payloads into NormalizedInboundMessage; channel="whatsapp_cloud", provider="meta"
- **Adapter B (WAHA)**: server/messaging/providers/wahaWhatsAppAdapter.ts — normalizes WAHA webhook payloads into NormalizedInboundMessage; channel="whatsapp", provider="waha"; sendOutbound() wraps WAHA REST API (sendText, sendImage)
- **Provider Registry**: server/messaging/providers/registry.ts — maps (channel,provider) to sendOutbound functions; dispatchOutbound() routes outbox worker to correct adapter
- **Core**: server/messaging/core.ts — resolveDialog(), storeMessageAtomic() with dedup, acceptInboundMetaWebhook(), acceptInboundWahaWebhook(), acceptInboundNormalized() (generic), sendMessage() with policy gate (opt-out, quiet hours) + outbox enqueue
- **Integration**: meta.service.ts calls acceptInboundMetaWebhook(); WAHA webhook handler calls acceptInboundWahaWebhook(); both push through same canonical pipeline
- **Outbound Pipeline**: message_outbox (job queue with status/retry/backoff) + messaging_deliveries (attempt log with provider response)
- **Outbound Adapter (Meta)**: server/messaging/providers/metaWhatsAppOutbound.ts — sendOutbound() wraps Meta Cloud API send, classifies errors as retryable/non-retryable
- **Outbox Worker**: server/messaging/worker.ts — 3s setInterval, picks PENDING/RETRY batches of 10 via FOR UPDATE SKIP LOCKED, exponential backoff (1m→5m→15m→60m→6h), uses dispatchOutbound() from registry
- **Retry policy**: retryable (timeouts, 5xx, network errors); non-retryable (OPT_OUT, TEMPLATE_REQUIRED, INVALID_RECIPIENT, POLICY_BLOCKED, BLOCKED_BY_USER)
- **Growth Integration**: messagingProvider.sendMessage() routes both META and WAHA WhatsApp through canonical sendMessage() → outbox pipeline; Telegram/Instagram remain direct-send
- **Thread key convention**: externalThreadId = "whatsapp_cloud:{fromPhone}" for Meta Cloud, "whatsapp:{fromPhone}" for WAHA

## Pricing & Billing
- **4-tier plan structure**: Free (0₸), Start (4,990₸), Business (19,990₸), Scale (29,990₸)
- **Dialog-based billing**: Each plan includes a monthly dialog limit (0/100/300/700). Overage at 50₸/dialog.
- **Trial period**: 2-day free trial on registration (status="trial")
- **Plan request flow**: User selects plan → POST /api/request-plan → Free plan auto-activates; paid plans require admin approval
- **Landing page**: 3-card pricing section (Start/Business/Scale) with psychological triggers (anchor pricing, scarcity badge, ROI calculator) + 10-item FAQ accordion
- **BillingPage**: Shows current plan, usage bars (products, categories, dialogs), overage cost display, all available plans
- **PlanSelectionPopup**: 3 main plan cards (Start/Business/Scale) + free plan option at bottom
- **Database plan IDs**: Free=c360ccb1, Start=8f1b3a2e, Business=12f05fab, Scale=5b057f3f

## External Dependencies
- **Database**: PostgreSQL
- **Messaging Integrations**:
    - WAHA (Self-hosted WhatsApp API)
    - Meta WhatsApp Cloud API (full integration with OAuth, template management, warm-up logic, webhook verification, broadcast support)
    - Instagram Direct (full integration with OAuth, Facebook Page linking, webhook handling)
- **AI Services**:
    - OpenAI API (gpt-4o, gpt-4o-mini for chat; text-embedding-3-small for vector embeddings)
    - Google Generative AI
- **Vector Search**: pgvector extension enabled in PostgreSQL. `knowledge_items` table has `embedding vector(1536)` column. `products` table also has `embedding vector(1536)` column. Semantic similarity search (`embedding <=> query`) replaces static context stuffing when embeddings are available. Utility: `server/services/embeddings.ts` (generateEmbedding, searchKnowledgeBySimilarity, searchProductsBySimilarity, embedKnowledgeItem, embedProduct, backfillEmbeddings, backfillProductEmbeddings). Backfill APIs: `POST /api/ai/knowledge/backfill-embeddings`, `POST /api/ai/products/backfill-embeddings`. New knowledge items and products auto-embed on creation (fire-and-forget).
- **Visual Product Delivery**: AI system prompt instructs the bot to display product images using Markdown format `![name](url)` with price and catalog link when a specific product matches the user's query.
- **Typing Simulation**: `getTypingDelay(message)` calculates delay based on message length (50ms/char, capped at 4s) with ±20% random variance. WAHA adapter sends `startTyping`/`stopTyping` status before delivering the AI response.
- **File Storage**: Replit Object Storage (Google Cloud Storage)
- **Payment Processing**:
    - Kaspi Business (full integration with 3-step verification, invoice creation, payment status tracking, notifications)
    - Stripe (scaffolded)
