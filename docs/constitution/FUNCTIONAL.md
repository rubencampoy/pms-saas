# FUNCTIONAL.md — Business Logic & Domain Model

> **Project:** SaaS PMS Multi-Tenant  
> **Version:** 1.0  
> **Last Updated:** 2026-02-12  
> **Status:** IMMUTABLE — Changes require Product Owner approval

---

## 1. Domain Overview

This document defines the complete business logic for a professional Property Management System. Every feature described here is scoped to an **Organization** (tenant). The system manages the full guest lifecycle: from inventory setup, through reservation and stay, to billing and checkout.

```
┌──────────────────────────────────────────────────────────┐
│                      ORGANIZATION                        │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐     │
│  │Properties│──▶│Room Types│──▶│  Units (Rooms)    │     │
│  └──────────┘   └──────────┘   └────────┬─────────┘     │
│                                          │               │
│  ┌──────────┐   ┌──────────┐   ┌────────▼─────────┐     │
│  │  Guests  │──▶│Reservat° │──▶│ Room Assignments  │     │
│  └──────────┘   └────┬─────┘   └──────────────────┘     │
│                       │                                   │
│              ┌────────▼─────────┐                        │
│              │   Folio (Billing)│                        │
│              │   ├─ Room Charges│                        │
│              │   ├─ Extras      │                        │
│              │   ├─ Taxes       │                        │
│              │   └─ Payments    │                        │
│              └──────────────────┘                        │
│                                                          │
│  ┌──────────────┐   ┌─────────────┐   ┌────────────┐   │
│  │ Rate Plans   │   │Housekeeping │   │  Reports   │   │
│  │ & Seasons    │   │  Tasks      │   │            │   │
│  └──────────────┘   └─────────────┘   └────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Inventory Model

### 2.1 Entity Hierarchy

```
Organization (1)
  └── Property (N)         — Physical hotel/hostel/apartment building
        └── RoomType (N)   — Category (e.g., "Double Standard", "Suite", "Dorm Bed")
              └── Unit (N) — Physical room/bed (e.g., Room 101, Bed 3A)
```

### 2.2 Organization

The top-level tenant entity. All data is scoped to an organization.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Organization display name |
| `slug` | string (unique) | Subdomain identifier (`koala-hostel`) |
| `timezone` | string | Default timezone (e.g., `Europe/Madrid`) |
| `defaultCurrency` | string | ISO 4217 currency code (e.g., `EUR`) |
| `locale` | string | Default locale (e.g., `es-ES`) |
| `settings` | JSONB | Feature flags, branding, invoice config |
| `plan` | enum | `free`, `starter`, `professional`, `enterprise` |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 2.3 Property

A physical location managed by the organization. An organization can have multiple properties.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** (required, always filtered) |
| `name` | string | Property name ("Koala Hostel Estación") |
| `code` | string | Short code ("KHE") for internal reference |
| `address` | JSONB | `{ street, city, state, postalCode, country }` |
| `phone` | string | Contact phone |
| `email` | string | Contact email |
| `checkInTime` | time | Default check-in time (e.g., `14:00`) |
| `checkOutTime` | time | Default check-out time (e.g., `11:00`) |
| `timezone` | string | Property-specific timezone override |
| `isActive` | boolean | Soft active/inactive toggle |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 2.4 Room Type

A category of rooms sharing the same amenities and base configuration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `name` | string | "Double Standard", "Suite Deluxe", "8-Bed Dorm" |
| `code` | string | Short code ("DBL", "STE", "DRM8") |
| `description` | text | Public-facing description |
| `baseOccupancy` | integer | Standard number of guests |
| `maxOccupancy` | integer | Maximum allowed guests |
| `amenities` | text[] | Array of amenity tags |
| `sortOrder` | integer | Display ordering |
| `isActive` | boolean | Available for sale |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 2.5 Unit (Physical Room)

The actual physical room or bed that can be assigned to a guest.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `roomTypeId` | UUID | FK → RoomType |
| `name` | string | Room number/name ("101", "3A", "Suite Alhambra") |
| `floor` | string | Floor identifier ("1", "PB", "Ático") |
| `status` | enum | `available`, `maintenance`, `out_of_order` |
| `housekeepingStatus` | enum | `dirty`, `cleaning`, `clean`, `inspected` |
| `isActive` | boolean | In service |
| `sortOrder` | integer | Display ordering |
| `notes` | text | Internal notes |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

**Key Constraint:** A unit can only be assigned to one reservation at a time for any given date range. This is enforced at the database level with an exclusion constraint on `(unit_id, date_range)`.

---

## 3. Reservation Engine

### 3.1 Reservation Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `confirmationCode` | string (unique) | Human-readable code ("KHE-2026-00042") |
| `guestId` | UUID | FK → Guest (primary guest) |
| `roomTypeId` | UUID | FK → RoomType (booked category) |
| `unitId` | UUID (nullable) | FK → Unit (assigned room, null until assignment) |
| `status` | enum | See §3.2 |
| `source` | enum | `direct`, `booking_com`, `expedia`, `airbnb`, `phone`, `walkin`, `website` |
| `checkInDate` | date | Arrival date (date only, no time) |
| `checkOutDate` | date | Departure date (date only, no time) |
| `nights` | integer | Computed: `checkOutDate - checkInDate` |
| `adults` | integer | Number of adult guests |
| `children` | integer | Number of child guests |
| `totalAmount` | decimal(10,2) | Total booking value |
| `currency` | string | ISO 4217 |
| `specialRequests` | text | Guest notes |
| `internalNotes` | text | Staff notes (not visible to guest) |
| `cancelledAt` | timestamp | When the reservation was cancelled |
| `cancellationReason` | text | Reason for cancellation |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 3.2 Reservation Status Machine

```
                    ┌─────────────┐
         ┌─────────│  CONFIRMED  │─────────┐
         │         └──────┬──────┘         │
         │                │                │
         │         ┌──────▼──────┐         │
         │         │  CHECKED_IN │         │
         │         └──────┬──────┘         │
         │                │                │
         │         ┌──────▼──────┐         │
         │         │ CHECKED_OUT │         │
         │         └─────────────┘         │
         │                                 │
         │         ┌─────────────┐         │
         └────────▶│  CANCELLED  │◀────────┘
                   └─────────────┘
                   
         ┌─────────────┐
         │   NO_SHOW   │  (special transition from CONFIRMED
         └─────────────┘   after check-in date has passed)
```

**Valid Transitions:**

| From | To | Trigger | Side Effects |
|------|----|---------|-------------|
| `CONFIRMED` | `CHECKED_IN` | Front desk action | Create folio, update unit status to `occupied`, set housekeeping to `dirty` |
| `CONFIRMED` | `CANCELLED` | Guest/staff cancellation | Release inventory block, calculate cancellation fees |
| `CONFIRMED` | `NO_SHOW` | Automated (next day if not checked in) | Apply no-show charges, release inventory |
| `CHECKED_IN` | `CHECKED_OUT` | Front desk action | Close folio, trigger final invoice, set housekeeping to `dirty` |
| `CHECKED_IN` | `CANCELLED` | Early departure (edge case) | Close folio with partial charges |

**Invalid Transitions (must be rejected):**
- `CHECKED_OUT` → any state
- `CANCELLED` → any state (cancelled is final)
- `NO_SHOW` → any state (no-show is final)
- `CHECKED_IN` → `CONFIRMED` (no rollback)

### 3.3 Inventory Blocking Logic

When a reservation is created with status `CONFIRMED`:

1. **Availability Check:** Query all units of the requested `roomTypeId` for the date range `[checkInDate, checkOutDate)`. A unit is available if no other `CONFIRMED` or `CHECKED_IN` reservation overlaps that range.
2. **Inventory Block:** The reservation locks the `roomTypeId` inventory count. A specific unit may or may not be assigned at this point.
3. **Unit Assignment:** Can happen at booking time or at check-in. Once assigned, the `unitId` is set and the unit is physically blocked.

```sql
-- Availability check pseudocode (Drizzle equivalent required)
SELECT COUNT(*) as available_units
FROM units u
WHERE u.room_type_id = :roomTypeId
  AND u.organization_id = :orgId
  AND u.status = 'available'
  AND u.id NOT IN (
    SELECT r.unit_id FROM reservations r
    WHERE r.room_type_id = :roomTypeId
      AND r.organization_id = :orgId
      AND r.status IN ('confirmed', 'checked_in')
      AND r.unit_id IS NOT NULL
      AND r.check_in_date < :checkOutDate
      AND r.check_out_date > :checkInDate
  )
```

### 3.4 Overbooking Protection

- The system must **never** allow more confirmed reservations for a room type than available units on any given date.
- Availability is calculated per-night: `availableUnits = totalActiveUnits - blockedUnits` for each date in the range.
- The check must be atomic — use a database transaction with `SELECT ... FOR UPDATE` to prevent race conditions.

---

## 4. Guest Management

### 4.1 Guest Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `email` | string (nullable) | Email address |
| `phone` | string (nullable) | Phone number |
| `documentType` | enum | `passport`, `national_id`, `driving_license`, `other` |
| `documentNumber` | string (nullable) | ID document number |
| `nationality` | string (nullable) | ISO 3166-1 alpha-2 country code |
| `dateOfBirth` | date (nullable) | Date of birth |
| `address` | JSONB (nullable) | `{ street, city, state, postalCode, country }` |
| `vipStatus` | enum | `none`, `silver`, `gold`, `platinum` |
| `notes` | text | Internal notes about the guest |
| `totalStays` | integer | Computed: total completed reservations |
| `totalRevenue` | decimal | Computed: total revenue from this guest |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 4.2 Guest De-duplication

- Guests are matched by `(organizationId, email)` or `(organizationId, documentType, documentNumber)`.
- On new reservation, the system should suggest existing guest matches before creating a new record.
- Guest profiles persist across properties within the same organization.

---

## 5. Rate Management

### 5.1 Rate Plan

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `name` | string | "Standard Rate", "Non-Refundable", "Early Bird" |
| `code` | string | "STD", "NR", "EB" |
| `description` | text | Description shown to guests |
| `cancellationPolicy` | enum | `free`, `moderate`, `strict`, `non_refundable` |
| `cancellationHours` | integer | Hours before check-in for free cancellation |
| `isActive` | boolean | Currently bookable |
| `priority` | integer | Display/selection priority |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 5.2 Rate (Price per Room Type per Night)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `ratePlanId` | UUID | FK → RatePlan |
| `roomTypeId` | UUID | FK → RoomType |
| `date` | date | Specific date this rate applies to |
| `amount` | decimal(10,2) | Price per night for this room type |
| `currency` | string | ISO 4217 |
| `minStay` | integer | Minimum nights required (default: 1) |
| `maxStay` | integer (nullable) | Maximum nights allowed |
| `closedToArrival` | boolean | No new check-ins on this date |
| `closedToDeparture` | boolean | No check-outs on this date |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 5.3 Season

Seasons provide a way to bulk-set rates across date ranges.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `name` | string | "Summer 2026", "Christmas 2026", "Low Season" |
| `startDate` | date | Season start |
| `endDate` | date | Season end |
| `color` | string | Hex color for calendar display |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 5.4 Supplements & Extras

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `name` | string | "Extra Bed", "Breakfast", "Late Check-out", "Parking" |
| `type` | enum | `per_night`, `per_stay`, `per_person_per_night`, `one_time` |
| `amount` | decimal(10,2) | Price |
| `taxRate` | decimal(5,2) | Tax percentage |
| `isActive` | boolean | Currently available |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 5.5 Rate Calculation Logic

```
For each night in [checkInDate, checkOutDate):
  1. Look up Rate for (ratePlanId, roomTypeId, date)
  2. If no specific rate exists, fall back to the RoomType.baseRate
  3. Apply supplements:
     - per_night: add for each night
     - per_person_per_night: multiply by (adults + children) × nights
     - per_stay: add once
     - one_time: add once
  4. Apply taxes per local regulation

Total = Σ(nightly_rate) + Σ(supplements) + Σ(taxes)
```

---

## 6. Housekeeping Module

### 6.1 Room Housekeeping Status

Each Unit has a `housekeepingStatus` field with the following states:

```
┌─────────┐    Checkout/     ┌──────────┐   Staff    ┌─────────┐   Manager   ┌───────────┐
│  DIRTY  │───────────────▶ │ CLEANING │──────────▶ │  CLEAN  │──────────▶ │ INSPECTED │
└─────────┘  Night Audit     └──────────┘  Completes  └─────────┘  Approves   └───────────┘
     ▲                                                                             │
     │                          Guest checks in                                    │
     └─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Housekeeping Task

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `propertyId` | UUID | FK → Property |
| `unitId` | UUID | FK → Unit |
| `type` | enum | `checkout_clean`, `stay_over`, `deep_clean`, `inspection` |
| `status` | enum | `pending`, `in_progress`, `completed`, `skipped` |
| `priority` | enum | `low`, `normal`, `high`, `urgent` |
| `assignedTo` | UUID (nullable) | FK → User (housekeeper) |
| `scheduledDate` | date | When the task should be done |
| `startedAt` | timestamp (nullable) | When cleaning started |
| `completedAt` | timestamp (nullable) | When cleaning finished |
| `notes` | text | Special instructions or issues found |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 6.3 Automatic Task Generation Rules

| Event | Task Created | Priority |
|-------|-------------|----------|
| Reservation status → `CHECKED_OUT` | `checkout_clean` | `high` |
| Daily at 06:00 for `CHECKED_IN` reservations | `stay_over` | `normal` |
| Manual request by manager | `deep_clean` | varies |
| After `checkout_clean` or `deep_clean` complete | `inspection` | `normal` |

### 6.4 Housekeeping Dashboard Data

The housekeeping dashboard must show a real-time grid of all units grouped by floor:

```
Floor 3: [101 🔴 Dirty] [102 🟡 Cleaning] [103 🟢 Clean] [104 ✅ Inspected]
Floor 2: [201 🔴 Dirty] [202 ✅ Inspected] [203 🟢 Clean] [204 🔴 Dirty]
Floor 1: [301 🟡 Cleaning] [302 ✅ Inspected] [303 🔴 Dirty] [304 🟢 Clean]
```

Color codes: 🔴 Red = Dirty, 🟡 Yellow = Cleaning, 🟢 Green = Clean, ✅ Blue = Inspected

---

## 7. Folio & Billing

### 7.1 Folio (Invoice Container)

A folio is the billing record associated with a reservation. It collects all charges and payments.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `reservationId` | UUID | FK → Reservation |
| `guestId` | UUID | FK → Guest |
| `folioNumber` | string (unique) | Sequential invoice number ("F-2026-00001") |
| `status` | enum | `open`, `closed`, `void` |
| `subtotal` | decimal(10,2) | Sum of all charges before tax |
| `taxTotal` | decimal(10,2) | Sum of all tax amounts |
| `total` | decimal(10,2) | subtotal + taxTotal |
| `paidAmount` | decimal(10,2) | Sum of all payments |
| `balance` | decimal(10,2) | total - paidAmount (must be 0 at checkout) |
| `currency` | string | ISO 4217 |
| `notes` | text | Invoice notes |
| `closedAt` | timestamp (nullable) | When the folio was settled |
| `createdAt` | timestamp | UTC |
| `updatedAt` | timestamp | UTC |

### 7.2 Folio Line Items (Charges)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `folioId` | UUID | FK → Folio |
| `type` | enum | `room_charge`, `supplement`, `minibar`, `restaurant`, `damage`, `tax`, `discount`, `adjustment` |
| `description` | string | Human-readable description |
| `date` | date | Date the charge applies to |
| `quantity` | integer | Number of items |
| `unitPrice` | decimal(10,2) | Price per unit |
| `amount` | decimal(10,2) | quantity × unitPrice |
| `taxRate` | decimal(5,2) | Tax percentage applied |
| `taxAmount` | decimal(10,2) | Calculated tax |
| `createdBy` | UUID | FK → User who created the charge |
| `createdAt` | timestamp | UTC |

### 7.3 Payments

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | **FK → Organization** |
| `folioId` | UUID | FK → Folio |
| `method` | enum | `cash`, `credit_card`, `debit_card`, `bank_transfer`, `online`, `other` |
| `amount` | decimal(10,2) | Payment amount |
| `reference` | string (nullable) | Transaction reference, card last 4 digits |
| `notes` | text | Payment notes |
| `processedAt` | timestamp | When the payment was processed |
| `processedBy` | UUID | FK → User who processed |
| `createdAt` | timestamp | UTC |

### 7.4 Folio Lifecycle

```
1. CHECK-IN
   └── Folio created (status: open)
   └── Room charges auto-posted for entire stay

2. DURING STAY
   └── Additional charges added (minibar, extras, supplements)
   └── Partial payments accepted

3. CHECK-OUT
   └── Final balance calculated
   └── Payment collected for remaining balance
   └── Folio closed (status: closed)
   └── Invoice PDF generated

4. POST-CHECKOUT
   └── Folio is immutable once closed
   └── Corrections require void + new folio
```

### 7.5 Night Audit

A critical daily process (typically run at 23:59 or 00:00) that:

1. **Posts room charges** for all `CHECKED_IN` reservations for the current date.
2. **Marks no-shows** for `CONFIRMED` reservations where `checkInDate` has passed.
3. **Generates housekeeping tasks** for the next day (stay-over cleans).
4. **Updates occupancy statistics** for the reporting module.
5. **Advances the business date** for the property.

---

## 8. Reporting & Analytics

### 8.1 Key Performance Indicators (KPIs)

| Metric | Formula | Update Frequency |
|--------|---------|-----------------|
| **Occupancy Rate** | `(Occupied Rooms / Total Available Rooms) × 100` | Daily |
| **ADR** (Average Daily Rate) | `Total Room Revenue / Rooms Sold` | Daily |
| **RevPAR** (Revenue Per Available Room) | `Total Room Revenue / Total Available Rooms` | Daily |
| **ALOS** (Average Length of Stay) | `Total Room Nights / Number of Reservations` | Weekly |
| **Cancellation Rate** | `Cancelled Reservations / Total Reservations × 100` | Weekly |

### 8.2 Required Reports

1. **Daily Revenue Report** — Breakdown of revenue by source and room type.
2. **Occupancy Forecast** — 30/60/90 day forward-looking occupancy by property.
3. **Guest Nationality Report** — Required by many local tourism authorities.
4. **Housekeeping Productivity** — Tasks completed per housekeeper per day.
5. **Cancellation Analysis** — Cancellation rates by source, room type, and lead time.
6. **Revenue by Channel** — Direct vs. OTA revenue comparison.

---

## 9. Calendar View

### 9.1 Requirements

The visual calendar (availability grid) is the core operational tool for front desk staff:

```
              Feb 12  Feb 13  Feb 14  Feb 15  Feb 16  Feb 17
Room 101    [═══ García (Checked-in) ═══][ ── López (Confirmed) ──]
Room 102    [free  ][═══ Smith (Checked-in) ════════════════════]
Room 103    [═ Chen ][free  ][free  ][══ Müller (Confirmed) ════]
Room 201    [═══════════ Fernández (Checked-in) ═══════════════]
```

- Color-coded by reservation status (confirmed=blue, checked-in=green, checked-out=gray, cancelled=red).
- Drag-and-drop to reassign rooms.
- Click to open reservation details.
- Shows housekeeping status as an icon overlay per unit.
- Must support horizontal scrolling for 30+ day views.

---

## 10. Integration Points (Future)

| Integration | Protocol | Priority | Purpose |
|------------|----------|----------|---------|
| Channel Manager | REST API / Webhooks | P1 | Sync availability with OTAs |
| Payment Gateway | Stripe / Redsys | P1 | Online payments, PCI compliance |
| Guest Communication | Email + WhatsApp API | P2 | Pre-arrival, during stay, post-stay |
| Electronic Invoicing | SII / TicketBAI (Spain) | P2 | Legal invoicing compliance |
| Smart Locks | TTLock / Nuki API | P3 | Keyless entry, code generation |
| Accounting | Export to A3 / Sage | P3 | Financial data export |
| Police Reporting | SES/Policía Nacional API | P1 | Guest registration (Spain legal req.) |
