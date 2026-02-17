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