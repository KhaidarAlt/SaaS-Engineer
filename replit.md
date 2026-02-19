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
- **Custom Domains & Subdomains**: A flexible system allowing tenants to use branded subdomains (`*.botfactory.kz`) and self-service custom domains with automated DNS verification and SSL provisioning via Caddy.
- **CRM System**: An internal CRM dashboard featuring Kanban and table views for deals, integrated with AI for analysis and message generation, and enhanced order detail pages.

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

## External Dependencies
- **Database**: PostgreSQL
- **Messaging Integrations**:
    - WAHA (Self-hosted WhatsApp API)
    - Meta WhatsApp Cloud API (full integration with OAuth, template management, warm-up logic, webhook verification, broadcast support)
    - Instagram Direct (full integration with OAuth, Facebook Page linking, webhook handling)
- **AI Services**:
    - OpenAI API
    - Google Generative AI
- **File Storage**: Replit Object Storage (Google Cloud Storage)
- **Payment Processing**:
    - Kaspi Business (full integration with 3-step verification, invoice creation, payment status tracking, notifications)
    - Stripe (scaffolded)
