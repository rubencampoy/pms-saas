# GUIDELINES.md — Development Rules for Agents

> **Project:** SaaS PMS Multi-Tenant  
> **Version:** 1.0  
> **Last Updated:** 2026-02-12  
> **Audience:** Claude Code agents and human developers  
> **Status:** IMMUTABLE — These rules are non-negotiable

---

## 1. The Golden Rules

These rules override all other guidelines. Violation of any golden rule is a **blocking error** that must be fixed before merge.

> ### 🥇 Rule #1: No query to the database can omit `organization_id`
> Every SELECT, UPDATE, DELETE query **must** filter by `organizationId`. This is enforced in the repository layer. There are **zero exceptions**.

> ### 🥈 Rule #2: TypeScript strict mode, zero `any` types
> The project uses `strict: true`. No `any`, no `@ts-ignore`, no `@ts-expect-error` (unless accompanied by a linked issue).

> ### 🥉 Rule #3: Validate every boundary with Zod
> Every Server Action input, every API route body, every form submission **must** be validated with a Zod schema before processing.

---

## 2. Naming Conventions

### 2.1 TypeScript / JavaScript

| Element | Convention | Example |
|---------|-----------|---------|
| Variables & functions | `camelCase` | `totalAmount`, `calculateRate()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_GUESTS`, `DEFAULT_CURRENCY` |
| Types & Interfaces | `PascalCase` | `Reservation`, `GuestProfile` |
| Enums | `PascalCase` (name), `UPPER_SNAKE_CASE` (values) | `ReservationStatus.CHECKED_IN` |
| React Components | `PascalCase` | `ReservationCard`, `GuestForm` |
| React Hooks | `camelCase` with `use` prefix | `useReservation()`, `useAvailability()` |
| Server Actions | `camelCase` with verb prefix | `createReservation()`, `updateGuestProfile()` |
| File names (components) | `kebab-case.tsx` | `reservation-card.tsx`, `guest-form.tsx` |
| File names (utils/lib) | `kebab-case.ts` | `date-utils.ts`, `rate-calculator.ts` |
| File names (schemas) | `kebab-case.ts` | `reservation.ts`, `guest.ts` |

### 2.2 Database (Drizzle Schema)

| Element | Convention | Example |
|---------|-----------|---------|
| Table names | `snake_case` (plural) | `reservations`, `room_types`, `folio_line_items` |
| Column names | `snake_case` | `check_in_date`, `organization_id`, `created_at` |
| Foreign keys | `{referenced_table_singular}_id` | `guest_id`, `property_id` |
| Indexes | `idx_{table}_{columns}` | `idx_reservations_check_in_date` |
| Unique constraints | `unq_{table}_{columns}` | `unq_guests_org_email` |

### 2.3 Drizzle → TypeScript Mapping

Drizzle column names use `snake_case` in the DB but are accessed as `camelCase` in TypeScript via Drizzle's built-in mapping:

```typescript
// Schema definition
export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Usage in code — always camelCase
const reservation = await db.query.reservations.findFirst({
  where: eq(reservations.organizationId, orgId),
});
```

---

## 3. File & Folder Organization Rules

### 3.1 Where Code Lives

| What | Where | Rule |
|------|-------|------|
| Page routes | `src/app/(dashboard)/{feature}/page.tsx` | One page per route segment |
| Server Actions | `src/server/actions/{feature}.ts` | Grouped by domain, not by page |
| DB schemas | `src/server/db/schema/{entity}.ts` | One file per aggregate root |
| Repositories | `src/server/repositories/{entity}.repo.ts` | Data access only, no business logic |
| Services | `src/server/services/{domain}.service.ts` | Business logic, calls repositories |
| Zod validators | `src/lib/validators/{entity}.ts` | Shared between client and server |
| UI Components | `src/components/ui/` | Shadcn primitives only |
| Feature Components | `src/components/{feature}/` | Domain-specific compositions |
| Types | `src/types/{domain}.ts` | Pure type definitions |
| Constants | `src/lib/constants/{domain}.ts` | Enums, status maps, configs |

### 3.2 Import Rules

```typescript
// ✅ CORRECT: Use path aliases
import { createReservation } from '@/server/actions/reservations';
import { ReservationStatus } from '@/lib/constants/reservation';
import { reservationSchema } from '@/lib/validators/reservation';

// ❌ WRONG: Relative imports across boundaries
import { createReservation } from '../../../server/actions/reservations';
```

Path alias configuration in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 3.3 Barrel Exports

- **DO NOT** create `index.ts` barrel files in large directories (they break tree-shaking).
- **DO** use direct imports to the specific file.

---

## 4. Server Action Pattern

Every Server Action must follow this exact structure:

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { createReservationSchema } from '@/lib/validators/reservation';
import { reservationService } from '@/server/services/reservation.service';

// Step 1: Define or import Zod schema
const inputSchema = createReservationSchema;

// Step 2: Define return type
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Step 3: Implement the action
export async function createReservation(
  input: z.infer<typeof inputSchema>
): Promise<ActionResult<{ id: string; confirmationCode: string }>> {
  try {
    // 3a. Authenticate
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // 3b. Authorize
    requireRole(session.user.role, ['admin', 'manager', 'front_desk']);

    // 3c. Validate input
    const validated = inputSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    // 3d. Execute business logic (organizationId comes from session)
    const result = await reservationService.create({
      ...validated.data,
      organizationId: session.user.organizationId,
    });

    // 3e. Revalidate affected paths
    revalidatePath('/reservations');
    revalidatePath('/calendar');

    return { success: true, data: result };
  } catch (error) {
    console.error('createReservation failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

**Agent Rule:** When writing a Server Action, always follow this 5-step pattern: Authenticate → Authorize → Validate → Execute → Revalidate.

---

## 5. Repository Pattern

All database access goes through repository functions. This is where `organizationId` filtering is enforced.

```typescript
// src/server/repositories/reservation.repo.ts
import { db } from '@/server/db';
import { reservations } from '@/server/db/schema/reservation';
import { and, eq, gte, lt } from 'drizzle-orm';

// EVERY function receives organizationId as the FIRST parameter
export const reservationRepo = {
  async findById(organizationId: string, id: string) {
    return db.query.reservations.findFirst({
      where: and(
        eq(reservations.organizationId, organizationId), // ← ALWAYS FIRST
        eq(reservations.id, id),
      ),
    });
  },

  async findByDateRange(
    organizationId: string,
    propertyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return db.query.reservations.findMany({
      where: and(
        eq(reservations.organizationId, organizationId), // ← ALWAYS FIRST
        eq(reservations.propertyId, propertyId),
        lt(reservations.checkInDate, endDate),
        gte(reservations.checkOutDate, startDate),
      ),
    });
  },

  // ❌ FORBIDDEN: Any function without organizationId parameter
  // async findAll() { ... } ← THIS WILL NEVER EXIST
};
```

---

## 6. Error Handling Strategy

### 6.1 Error Types

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message, 'VALIDATION_ERROR', 422);
  }
}
```

### 6.2 Error Handling Rules

| Layer | Strategy |
|-------|----------|
| **Server Actions** | Catch all errors. Return `{ success: false, error: message }`. Never throw to the client. Never leak stack traces. |
| **Services** | Throw typed `AppError` subclasses. Let the Server Action layer catch them. |
| **Repositories** | Throw database errors as-is. The service layer interprets them. |
| **UI Components** | Use `useActionState` or `useTransition` to handle Server Action results. Display user-friendly messages from `error` field. |
| **API Routes (webhooks)** | Return proper HTTP status codes. Log errors with context. |

### 6.3 Logging Standard

```typescript
// Always log with structured context
console.error('reservationService.create failed', {
  organizationId,
  guestId: input.guestId,
  checkInDate: input.checkInDate,
  error: error instanceof Error ? error.message : 'Unknown error',
  stack: error instanceof Error ? error.stack : undefined,
});
```

**Never log:** passwords, tokens, full credit card numbers, personal documents.

---

## 7. Date & Timezone Management

### 7.1 The Rule

> **Database:** ALL timestamps stored in UTC (`timestamp with time zone`).  
> **Business Logic:** ALL date math done in UTC.  
> **UI Display:** Convert to the property's local timezone ONLY at the rendering layer.

### 7.2 Implementation

```typescript
// src/lib/utils/dates.ts
import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Convert a UTC date to the property's local timezone for display.
 * ONLY use this in UI components.
 */
export function toLocalDisplay(
  utcDate: Date | string,
  timezone: string,
  formatStr: string = 'dd/MM/yyyy HH:mm',
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr);
}

/**
 * Convert a local date input from the UI to UTC for storage.
 * ONLY use this in Server Actions when processing form inputs.
 */
export function toUTC(localDate: Date | string, timezone: string): Date {
  const date = typeof localDate === 'string' ? parseISO(localDate) : localDate;
  return fromZonedTime(date, timezone);
}

/**
 * For date-only fields (checkInDate, checkOutDate), store as DATE type.
 * These do NOT have timezone ambiguity — a check-in date of 2026-02-15
 * means February 15th at the property, regardless of timezone.
 */
```

### 7.3 Date Type Guidelines

| Field Type | DB Type | Example | Timezone? |
|-----------|---------|---------|-----------|
| Event timestamps | `timestamp with time zone` | `createdAt`, `checkedInAt` | Stored UTC, display local |
| Business dates | `date` | `checkInDate`, `checkOutDate` | No timezone — date is absolute |
| Times | `time` | `checkInTime` (14:00) | Local to property |

### 7.4 Agent Rule for Dates

When an agent creates a Drizzle schema:
- Use `timestamp('column_name', { withTimezone: true })` for event times.
- Use `date('column_name')` for business dates.
- Never use `timestamp` without `withTimezone: true`.

---

## 8. Zod Validation Schemas

### 8.1 Schema Location & Naming

```
src/lib/validators/
├── reservation.ts     → createReservationSchema, updateReservationSchema
├── guest.ts           → createGuestSchema, updateGuestSchema
├── rate.ts            → createRateSchema, bulkUpdateRatesSchema
├── housekeeping.ts    → updateHousekeepingSchema
├── folio.ts           → addChargeSchema, addPaymentSchema
└── common.ts          → paginationSchema, dateRangeSchema, uuidSchema
```

### 8.2 Schema Conventions

```typescript
// src/lib/validators/reservation.ts
import { z } from 'zod';
import { ReservationSource, ReservationStatus } from '@/lib/constants/reservation';

// Base schema (shared fields)
const reservationBase = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  roomTypeId: z.string().uuid('Invalid room type ID'),
  guestId: z.string().uuid('Invalid guest ID'),
  checkInDate: z.string().date('Invalid check-in date (expected YYYY-MM-DD)'),
  checkOutDate: z.string().date('Invalid check-out date (expected YYYY-MM-DD)'),
  adults: z.number().int().min(1, 'At least 1 adult required').max(20),
  children: z.number().int().min(0).max(20).default(0),
  source: z.nativeEnum(ReservationSource),
  specialRequests: z.string().max(1000).optional(),
}).refine(
  (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
  { message: 'Check-out date must be after check-in date', path: ['checkOutDate'] },
);

// Create schema — no id, no organizationId (injected by server)
export const createReservationSchema = reservationBase;

// Update schema — partial, with id
export const updateReservationSchema = reservationBase
  .partial()
  .extend({ id: z.string().uuid() });

// Status change schema
export const changeReservationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(ReservationStatus),
  reason: z.string().max(500).optional(),
});

// Type exports for use in components and actions
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
```

### 8.3 Validation Rules

- **Never trust client input.** Even if the form has client-side validation, the Server Action must re-validate with the same Zod schema.
- **`organizationId` is NEVER part of the input schema.** It is always injected from the authenticated session.
- **Zod schemas are shared** between client (form validation) and server (action validation) by importing from `@/lib/validators/`.
- **Custom error messages** are required for user-facing validations (`'At least 1 adult required'`, not the default Zod message).

---

## 9. Component Patterns

### 9.1 Server Component (Default)

```typescript
// src/app/(dashboard)/reservations/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReservationTable } from '@/components/reservations/reservation-table';
import { ReservationTableSkeleton } from '@/components/reservations/reservation-table-skeleton';

export default async function ReservationsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reservations</h1>
      <Suspense fallback={<ReservationTableSkeleton />}>
        <ReservationTable
          organizationId={session.user.organizationId}
          propertyId={session.user.activePropertyId}
        />
      </Suspense>
    </div>
  );
}
```

### 9.2 Client Component (Only When Needed)

```typescript
// src/components/reservations/reservation-status-badge.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { ReservationStatus } from '@/lib/constants/reservation';

const statusConfig: Record<ReservationStatus, { label: string; variant: string }> = {
  [ReservationStatus.CONFIRMED]: { label: 'Confirmed', variant: 'default' },
  [ReservationStatus.CHECKED_IN]: { label: 'Checked In', variant: 'success' },
  [ReservationStatus.CHECKED_OUT]: { label: 'Checked Out', variant: 'secondary' },
  [ReservationStatus.CANCELLED]: { label: 'Cancelled', variant: 'destructive' },
  [ReservationStatus.NO_SHOW]: { label: 'No Show', variant: 'warning' },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

---

## 10. Testing Strategy

### 10.1 Test Pyramid

| Layer | Tool | Coverage Target | What to Test |
|-------|------|----------------|-------------|
| Unit | Vitest | 80% | Services, utilities, validators, rate calculations |
| Integration | Vitest + Test DB | Key flows | Repository queries, Server Actions with real DB |
| E2E | Playwright | Critical paths | Reservation flow, check-in/out, payment |

### 10.2 Test File Naming

```
src/server/services/reservation.service.ts
src/server/services/__tests__/reservation.service.test.ts

src/lib/utils/rate-calculator.ts
src/lib/utils/__tests__/rate-calculator.test.ts
```

### 10.3 Test Rules

- Every service function that involves money calculation **must** have unit tests.
- Every state transition in the reservation engine **must** have integration tests.
- Tests **must** use a separate test database schema with seed data.
- Tests **must** include the `organizationId` filter — even in tests, we simulate multi-tenancy.

---

## 11. Git & Commit Conventions

### 11.1 Conventional Commits

```
feat(reservations): add check-in flow with folio creation
fix(housekeeping): correct status transition from cleaning to clean
chore(deps): update drizzle-orm to latest
docs(api): document webhook payload for channel manager
refactor(rates): extract rate calculation to dedicated service
test(folio): add integration tests for charge posting
```

### 11.2 Branch Naming

```
feature/RES-001-reservation-creation
fix/HK-042-housekeeping-status-not-updating
chore/INFRA-010-add-sentry-monitoring
```

### 11.3 PR Rules

- Every PR must reference a task/issue ID.
- Every PR must pass CI (lint, type-check, tests).
- Every PR that touches DB schemas must include a migration.
- Every PR that adds a new table must include `organizationId` column — CI lint will check this.

---

## 12. Agent-Specific Instructions

### 12.1 Before Writing Any Code

1. Read `STACK.md` to confirm the technology to use.
2. Read `FUNCTIONAL.md` to understand the business rule.
3. Read this file (`GUIDELINES.md`) for implementation standards.
4. Check existing code in the target directory for patterns to follow.

### 12.2 Code Generation Checklist

Before submitting code, verify:

- [ ] `organizationId` is present in every DB query
- [ ] Zod validation is applied to all inputs
- [ ] Server Action follows the 5-step pattern (Auth → Authorize → Validate → Execute → Revalidate)
- [ ] No `any` types
- [ ] No `useEffect` for data fetching
- [ ] Dates use the correct type (`date` vs `timestamp with time zone`)
- [ ] Error handling returns `ActionResult`, never throws to client
- [ ] File is in the correct directory per §3.1
- [ ] Naming follows §2 conventions
- [ ] Component is Server Component by default (has `'use client'` only if needed)
- [ ] Imports use `@/` path alias

### 12.3 When Unsure

If the guidelines don't cover a specific case:
1. Look at how an existing similar feature was implemented.
2. Default to the most secure, most typed, most server-side approach.
3. Add a `// TODO: Review — no guideline for this pattern` comment.
4. Never silently skip validation or tenant isolation.
