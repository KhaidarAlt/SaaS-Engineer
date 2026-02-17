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
