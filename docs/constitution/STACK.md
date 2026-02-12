# STACK.md — Technology Stack Constitution

> **Project:** SaaS PMS Multi-Tenant  
> **Version:** 1.0  
> **Last Updated:** 2026-02-12  
> **Status:** IMMUTABLE — Changes require CTO approval and migration plan

---

## 1. Core Principles

- **Convention over Configuration:** Every technology choice must reduce decision fatigue for agents.
- **Type Safety End-to-End:** From database schema to UI component props, everything is typed.
- **Server-First:** Default to server rendering and server logic. Client interactivity only when necessary.
- **Multi-Tenancy by Design:** Tenant isolation is not an afterthought — it's baked into every layer.

---

## 2. Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | **Next.js** | 16.x (App Router) | SSR, RSC, Server Actions, Middleware |
| Language | **TypeScript** | 5.x (strict mode) | Type safety across the entire codebase |
| Styling | **Tailwind CSS** | 4.x | Utility-first CSS with design tokens |
| Component Library | **Shadcn/UI** | Latest | Accessible, composable, ownable components |
| Forms | **React Hook Form** + **Zod** | Latest | Declarative forms with schema validation |
| State (Client) | **Zustand** | Latest | Lightweight client state when RSC is insufficient |
| Date Handling | **date-fns** | Latest | Immutable, tree-shakeable date utilities |
| Tables | **TanStack Table** | Latest | Headless, sortable, filterable data grids |
| Charts | **Recharts** | Latest | Occupancy dashboards, revenue analytics |
| Internationalization | **next-intl** | Latest | Multi-language support (ES, EN, FR, DE, IT, PT minimum) |

### 2.1 Frontend Rules

- **React Server Components (RSC)** are the default. Use `"use client"` only when the component requires browser APIs, event handlers, or client-side state.
- **Server Actions** replace API routes for all mutations (create, update, delete). API routes are reserved exclusively for webhooks and external integrations.
- **No `useEffect` for data fetching.** Data is fetched in server components or via Server Actions.
- **Streaming & Suspense:** Use `<Suspense>` boundaries with skeleton loaders for all async server components.

---

## 3. Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | **Node.js** | 22.x LTS | Server runtime |
| ORM | **Drizzle ORM** | Latest | Type-safe SQL, schema-based multi-tenancy |
| Database | **PostgreSQL** | 16.x | Primary relational database |
| Cache | **Redis** (Upstash) | Latest | Session cache, rate limiting, real-time state |
| Background Jobs | **Trigger.dev** | v3 | Scheduled tasks, async processing, retries |
| Email | **React Email** + **Resend** | Latest | Transactional emails (confirmations, invoices) |
| File Storage | **AWS S3** / **Cloudflare R2** | — | Guest documents, invoice PDFs, photos |
| Search | **PostgreSQL Full-Text** | — | Guest and reservation search (pg_trgm) |

### 3.1 Backend Rules

- **No raw SQL.** All queries go through Drizzle ORM with the typed query builder.
- **Every Drizzle query MUST include a `.where(eq(table.organizationId, ctx.organizationId))` filter.** No exceptions. This is enforced at the helper/repository layer.
- **Server Actions** must always: (1) authenticate the session, (2) validate input with Zod, (3) authorize the role, (4) execute the operation, (5) revalidate the cache.

---

## 4. Multi-Tenancy Architecture

### Strategy: Schema-Level Isolation via `organization_id`

```
┌─────────────────────────────────────────────┐
│              PostgreSQL Instance             │
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  public      │  │  shared      │          │
│  │  (migrations)│  │  (tenants,   │          │
│  │              │  │   plans,     │          │
│  │              │  │   billing)   │          │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  All tenant data lives in the same schema    │
│  isolated by organization_id (UUID) on       │
│  every table. RLS policies as second layer.  │
└─────────────────────────────────────────────┘
```

- **Primary Isolation:** `organization_id` column (UUID) on every tenant-scoped table. Enforced via Drizzle helper that wraps all queries.
- **Secondary Isolation:** PostgreSQL Row-Level Security (RLS) policies as a defense-in-depth layer.
- **Tenant Resolution:** Resolved via subdomain (`{slug}.pmshub.com`) in Next.js Middleware → stored in request context.
- **Connection Pooling:** Use **Neon** serverless driver or **PgBouncer** for connection management.

---

## 5. Authentication & Authorization

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Auth Provider | **Auth.js** (v5) | Session management, OAuth, Credentials |
| Session Strategy | **JWT** (short-lived) + **Database sessions** | Stateless auth with DB fallback |
| RBAC | Custom middleware | Role-based access control |

### 5.1 Role Hierarchy

```
SuperAdmin (platform-level)
  └── Admin (organization owner)
        └── Manager (property-level full access)
              └── FrontDesk (reservations, check-in/out, folios)
                    └── Housekeeping (room status only)
```

### 5.2 Permission Matrix

| Resource | Admin | Manager | FrontDesk | Housekeeping |
|----------|-------|---------|-----------|--------------|
| Organization Settings | ✅ CRUD | ❌ | ❌ | ❌ |
| Properties | ✅ CRUD | ✅ Read | ✅ Read | ✅ Read (own) |
| Room Types & Units | ✅ CRUD | ✅ CRUD | ✅ Read | ✅ Read |
| Reservations | ✅ CRUD | ✅ CRUD | ✅ CRUD | ❌ |
| Check-in / Check-out | ✅ | ✅ | ✅ | ❌ |
| Rate Plans | ✅ CRUD | ✅ CRUD | ✅ Read | ❌ |
| Folios / Invoices | ✅ CRUD | ✅ CRUD | ✅ CRU | ❌ |
| Housekeeping Status | ✅ CRUD | ✅ CRUD | ✅ Read | ✅ Update (own) |
| Reports & Analytics | ✅ Full | ✅ Full | ✅ Limited | ❌ |
| User Management | ✅ CRUD | ✅ Read | ❌ | ❌ |
| Billing / Subscription | ✅ CRUD | ❌ | ❌ | ❌ |

---

## 6. Infrastructure & Deployment

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Hosting | **Vercel** | Edge-optimized Next.js hosting |
| Database Hosting | **Neon** | Serverless PostgreSQL with branching |
| CI/CD | **GitHub Actions** | Automated testing, linting, deployment |
| Monitoring | **Sentry** | Error tracking, performance monitoring |
| Logging | **Axiom** | Structured logging, log aggregation |
| Analytics | **PostHog** | Product analytics, feature flags |
| DNS / CDN | **Cloudflare** | Wildcard DNS for tenant subdomains |

### 6.1 Environment Strategy

```
main branch     → production   (pmshub.com)
staging branch  → staging      (staging.pmshub.com)
feature/*       → preview      (pr-{n}.pmshub.com)
```

---

## 7. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, register, forgot-password)
│   ├── (dashboard)/              # Authenticated tenant pages
│   │   ├── reservations/
│   │   ├── calendar/
│   │   ├── guests/
│   │   ├── housekeeping/
│   │   ├── rates/
│   │   ├── reports/
│   │   └── settings/
│   ├── (marketing)/              # Public marketing site
│   ├── api/                      # Webhooks & external integrations ONLY
│   └── layout.tsx
├── components/
│   ├── ui/                       # Shadcn/UI primitives
│   ├── forms/                    # Form components (reservation-form, guest-form)
│   ├── tables/                   # Data table compositions
│   └── shared/                   # Cross-feature components
├── server/
│   ├── actions/                  # Server Actions (grouped by domain)
│   ├── db/
│   │   ├── schema/               # Drizzle schemas (one file per domain)
│   │   ├── migrations/           # Generated migrations
│   │   ├── seed/                 # Seed data for development
│   │   └── index.ts              # DB client with tenant context
│   ├── services/                 # Business logic (pure functions)
│   └── repositories/             # Data access layer (Drizzle queries)
├── lib/
│   ├── auth/                     # Auth.js config, helpers
│   ├── validators/               # Zod schemas (shared between client & server)
│   ├── constants/                # Enums, status maps, config
│   ├── utils/                    # Generic utilities
│   └── hooks/                    # Custom React hooks (client only)
├── types/                        # Global TypeScript types & interfaces
└── middleware.ts                  # Tenant resolution, auth, rate limiting
```

---

## 8. Key Dependencies (package.json reference)

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "typescript": "^5.7.0",
    "drizzle-orm": "latest",
    "@auth/core": "latest",
    "@auth/drizzle-adapter": "latest",
    "zod": "^3.24.0",
    "zustand": "latest",
    "date-fns": "^4.0.0",
    "date-fns-tz": "latest",
    "@tanstack/react-table": "latest",
    "recharts": "latest",
    "react-hook-form": "latest",
    "@hookform/resolvers": "latest",
    "next-intl": "latest",
    "resend": "latest",
    "@react-email/components": "latest",
    "tailwindcss": "^4.0.0",
    "@radix-ui/react-*": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "vitest": "latest",
    "@testing-library/react": "latest",
    "playwright": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "@types/node": "latest",
    "@types/react": "latest"
  }
}
```

---

## 9. Non-Negotiable Technical Decisions

1. **TypeScript `strict: true`** — No `any` types. No `@ts-ignore`. Ever.
2. **Drizzle ORM only** — No Prisma, no raw SQL, no query builders outside Drizzle.
3. **Server Actions for mutations** — API routes only for external webhooks.
4. **Zod validation on every boundary** — Client forms, Server Actions, API routes.
5. **UTC in database, local in UI** — All timestamps stored as `timestamp with time zone` in UTC.
6. **`organization_id` on every query** — Enforced by the repository layer. No exceptions.
7. **Feature flags via PostHog** — No hardcoded feature toggles in code.
8. **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
