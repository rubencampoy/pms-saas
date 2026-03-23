# CLAUDE.md — Master Instructions for Claude Code

> You are building a SaaS PMS (Property Management System) multi-tenant called **HotelOS**.
> Before writing ANY code, read the constitution files in `/docs/constitution/`.

---

## Project Constitution (READ FIRST)

These files define every decision. Do not deviate from them:

1. **`docs/constitution/STACK.md`** — Technology stack, project structure, dependencies
2. **`docs/constitution/FUNCTIONAL.md`** — Business logic, domain model, state machines
3. **`docs/constitution/GUIDELINES.md`** — Coding rules, patterns, naming conventions
4. **`docs/constitution/DESIGN_GUIDE.md`** — Design system, color tokens, component patterns, dark mode rules

---

## Design System & Stitch MCP Integration

### Stitch MCP Connection

This project uses **Google Stitch** as the design tool, connected via MCP. The Stitch MCP server
provides direct access to all screen designs without needing to copy-paste HTML manually.

**Available Stitch MCP tools:**
- `get_screen_code` — Retrieve the HTML/CSS of any designed screen
- `get_screen_image` — Get a visual screenshot of a screen
- `generate_screen_from_text` — Generate new screen designs from a text prompt
- `list_screens` — List all screens in the Stitch project
- `get_design_context` — Extract design tokens (colors, fonts, spacing) from a screen

### Design-to-Code Workflow

When building ANY UI component or page, follow this workflow:

```
1. Check if a Stitch screen exists for this feature
   → Use list_screens or get_screen_code via MCP

2. If a screen exists:
   → Extract the HTML with get_screen_code
   → Read docs/constitution/DESIGN_GUIDE.md for token reference
   → Translate to React + Tailwind CSS 4 + Shadcn/UI
   → Do NOT copy HTML literally — adapt to our component architecture

3. If no screen exists:
   → Follow DESIGN_GUIDE.md patterns exactly
   → Match existing screens: sidebar, header, cards, tables, badges
   → Use the same color tokens, spacing, and typography

4. For new screens needed:
   → Use generate_screen_from_text with context from existing screens
   → Use get_design_context first to extract "Design DNA" for consistency
```

### Design Reference Screens

These screens are available in Stitch (and as HTML in `docs/designs/screens/`):

| Screen | File | Status |
|--------|------|--------|
| Calendar / Tape Chart | `01-calendar.html` | ✅ Done |
| Booking List | `02-bookings.html` | ✅ Done |
| Folio & Invoice | `03-folio.html` | ✅ Done |
| Settings: Room Types | `04-settings-room-types.html` | ✅ Done |
| Login | `05-login.html` | 🔲 Pending |
| Dashboard | `06-dashboard.html` | 🔲 Pending |
| New Reservation Modal | `07-new-reservation.html` | 🔲 Pending |
| Reservation Detail | `08-reservation-detail.html` | 🔲 Pending |
| Housekeeping Board | `09-housekeeping.html` | 🔲 Pending |
| Guest List | `10-guest-list.html` | 🔲 Pending |
| Rate Management | `11-rates.html` | 🔲 Pending |

### Key Design Tokens (from DESIGN_GUIDE.md)

Quick reference — always verify against the full DESIGN_GUIDE.md:

```
Primary:           #137fec
Sidebar BG:        #0a1118
Content BG Light:  #f6f7f8
Card BG Dark:      #1a2632
Font:              Manrope (Google Fonts)
Icons:             Material Icons (material-icons / material-icons-round)
Border Radius:     Buttons rounded-lg, Cards rounded-xl, Badges rounded-full
```

### Design Rules for Agents

1. **Always read DESIGN_GUIDE.md** before building any UI component
2. **Use Material Icons** — NOT Lucide, NOT Heroicons
3. **Use Manrope font** — imported from Google Fonts
4. **Every component supports dark mode** via `dark:` Tailwind prefix
5. **Sidebar is always dark** (`bg-[#0a1118]`) even in light mode
6. **Match exact patterns** — if a component exists in DESIGN_GUIDE.md, use it as-is
7. **Translate, don't copy** — Stitch HTML is reference; build proper React components
8. **When unsure about a UI pattern**, use `get_screen_code` to check existing Stitch screens

---

## Development Phases

Execute these phases IN ORDER. Do not skip ahead. Complete each phase fully before moving to the next.

### Phase 1: Project Scaffolding ✅
- Initialize Next.js 16 with TypeScript strict mode
- Configure Tailwind CSS 4 + Shadcn/UI
- Set up Drizzle ORM with PostgreSQL connection
- Configure path aliases (`@/`)
- Set up ESLint + Prettier
- Create the folder structure defined in STACK.md §7

### Phase 2: Database Schema & Multi-Tenancy
- Create all Drizzle schemas as defined in FUNCTIONAL.md
- Every table MUST have `organizationId` column (see GUIDELINES.md §1 Rule #1)
- Create the repository layer with mandatory `organizationId` filtering
- Generate initial migration
- Create seed script with demo data for one organization with 2 properties

### Phase 3: Authentication & Authorization
- Set up Auth.js v5 with Drizzle adapter
- Implement JWT + database session strategy
- Create role-based middleware (Admin, Manager, FrontDesk, Housekeeping)
- Build login page, register page, forgot password page
- Implement tenant resolution via subdomain in middleware

### Phase 4: Core PMS Features (in this order)
1. **Property & Room Management** — CRUD for properties, room types, units
2. **Guest Management** — CRUD, search, de-duplication
3. **Reservation Engine** — Create, status transitions, availability check, calendar view
4. **Housekeeping Module** — Status board, task management, automatic task generation
5. **Rate Management** — Rate plans, seasonal pricing, supplements
6. **Folio & Billing** — Charges, payments, invoice generation
7. **Reports & Dashboard** — KPIs, occupancy, revenue charts

### Phase 5: Polish
- Responsive design (mobile-first for housekeeping)
- Loading states with Suspense + skeleton loaders
- Error boundaries
- Internationalization (ES, EN)

---

## How to Work

### Before Every Task
1. Re-read the relevant section of the constitution files
2. **Check Stitch for a design reference** — use MCP tools or look in `docs/designs/screens/`
3. Read `DESIGN_GUIDE.md` for exact component patterns and color tokens
4. Check existing code for patterns to follow
5. Follow the Server Action 5-step pattern (Auth → Authorize → Validate → Execute → Revalidate)

### UI Building Checklist
- [ ] Checked Stitch/DESIGN_GUIDE.md for design reference
- [ ] Using Material Icons (not Lucide/Heroicons)
- [ ] Using Manrope font family
- [ ] Dark mode supported on all elements
- [ ] Sidebar uses `bg-[#0a1118]` (dark even in light mode)
- [ ] Color tokens match DESIGN_GUIDE.md exactly
- [ ] Status badges use the dot + rounded-full pattern
- [ ] Tables follow the thead bg-slate-50 + uppercase tracking-wider pattern
- [ ] Cards use bg-white rounded-xl shadow-sm border border-slate-200

### Code Quality Checklist (run before every commit)
- [ ] `organizationId` in every DB query
- [ ] Zod validation on all inputs
- [ ] No `any` types, no `@ts-ignore`
- [ ] Server Components by default, `'use client'` only when necessary
- [ ] No `useEffect` for data fetching
- [ ] Dates: `timestamp with time zone` for events, `date` for business dates
- [ ] Error handling returns `ActionResult`, never throws to client
- [ ] Files in correct directories per STACK.md §7
- [ ] Imports use `@/` path aliases

### Commands
```bash
# Development
npm run dev              # Start dev server
npm run db:generate      # Generate Drizzle migration
npm run db:migrate       # Run migrations
npm run db:seed          # Seed demo data
npm run db:studio        # Open Drizzle Studio

# Quality
npm run lint             # ESLint
npm run type-check       # TypeScript strict check
npm run test             # Vitest
npm run test:e2e         # Playwright

# Build
npm run build            # Production build
```

---

## MCP Servers Available

### Stitch (Design)
```json
{
  "stitch": {
    "type": "http",
    "url": "https://stitch.googleapis.com/mcp",
    "headers": {
      "X-Goog-Api-Key": "AQ.Ab8RN6ItyPIfm3nVNvSuidph-ZHJQrOuM9EaPgKYbChBWoB5Tg"
    }
  }
}
```

**Use for:** Fetching screen designs, extracting design tokens, generating new screens.

**Key workflow patterns:**
```
# Get design context from an existing screen for consistency
→ get_design_context(screenId)

# Then generate a new screen that matches
→ generate_screen_from_text("Design a [page] for HotelOS using this context...")

# Retrieve the HTML to translate to React
→ get_screen_code(screenId)
```

---

## Golden Rules (NEVER VIOLATE)

1. 🥇 **Every DB query includes `organizationId`** — No exceptions. Ever.
2. 🥈 **TypeScript strict, zero `any`** — If you can't type it, refactor it.
3. 🥉 **Zod validates every boundary** — Client forms, Server Actions, API routes.
4. 🏅 **Server-first** — RSC default, Server Actions for mutations, `'use client'` is the exception.
5. 🏅 **UTC in DB, local in UI** — All timestamps UTC. Convert only at render time.
6. 🎨 **Design fidelity** — Every UI matches DESIGN_GUIDE.md and Stitch references. No improvising visual patterns.
