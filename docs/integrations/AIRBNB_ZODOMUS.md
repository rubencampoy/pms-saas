# Airbnb Integration via Zodomus — Reference Document

> Source: Documentation provided by Zodomus (info@zodomus.com) on 2025-03-27.
> This document is a technical reference for implementing the Airbnb channel in Chamelio PMS.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Key Differences vs Other OTAs](#2-key-differences-vs-other-otas)
3. [Host Onboarding Flow](#3-host-onboarding-flow)
4. [Listing Model](#4-listing-model)
5. [Calendar & Availability](#5-calendar--availability)
6. [Pricing](#6-pricing)
7. [Reservations](#7-reservations)
8. [Messaging](#8-messaging)
9. [Webhooks & Notifications](#9-webhooks--notifications)
10. [API Rate Limits](#10-api-rate-limits)
11. [API Reference (Complete List)](#11-api-reference-complete-list)
12. [ID Format & Migration](#12-id-format--migration)
13. [Implementation Notes for Chamelio PMS](#13-implementation-notes-for-chamelio-pms)

---

## 1. Architecture Overview

```
┌─────────────┐      ┌───────────┐      ┌─────────┐
│  Chamelio PMS    │─────▶│  Zodomus  │─────▶│  Airbnb  │
│  (our PMS)  │◀─────│  (CH Mgr) │◀─────│  API     │
└─────────────┘      └───────────┘      └─────────┘
     webhook◀────────push notifications
```

- **Zodomus** acts as the channel manager intermediary — Chamelio PMS never calls Airbnb directly.
- All Airbnb API calls go through Zodomus REST endpoints.
- Airbnb uses `channelId = 3` in all Zodomus API calls.
- Authentication is per-Host via a `token` obtained during onboarding.
- Chamelio PMS must expose a **webhook endpoint** to receive push notifications from Zodomus.

---

## 2. Key Differences vs Other OTAs

| Aspect | Booking.com / Expedia | Airbnb (via Zodomus) |
|--------|----------------------|----------------------|
| **Connection model** | Per property | Per Host (one host → many listings) |
| **Authorization** | Property ID/credentials | OAuth2 flow (host must approve) |
| **Notifications** | Pull-based (Booking) | Push-based (webhooks mandatory) |
| **Availability check** | Calendar-based only | Real-time pre-reservation check |
| **Room types** | Native multi-room support | Listing = 1 unit (multi-room via `availableCount`) |
| **Availability counter** | Auto-adjusted on booking | Manual management required for room types |
| **Price model** | Per night / per occupancy | Per day (`priceModelId = 4`) |
| **Calendar updates** | Synchronous | Asynchronous (may have small delay) |
| **Rate plans** | Full support | STANDARD model (rate plans in beta) |
| **API rate limits** | Per-client | Shared across ALL Zodomus clients |

---

## 3. Host Onboarding Flow

### Step 1: Activate Host in Zodomus

```
POST airbnb-host-activation
Body: {} (empty)

Response:
{
  "token": 9851359133,          // Used to identify this host in ALL future calls
  "client_id": "333334cBTr..."  // Used for OAuth2 authorization
}
```

### Step 2: Host OAuth2 Authorization

The host must authorize Zodomus to manage their listings. Build an HTML link that redirects the host:

**Test environment:**
```
URL: https://api.zodomus.com/airbnb-oauth2-tests
  ?client_id={client_id}
  &redirect_uri=https://api.zodomus.com/airbnb-webhook-redirect-test
  &scope=property_management,messages_read,messages_write
  &state={token}
```

**Production environment:**
```
URL: https://www.airbnb.com/oauth2/auth
  ?client_id={client_id}
  &redirect_uri=https://api.zodomus.com/airbnb-webhook-redirect
  &scope=property_management,messages_read,messages_write
  &state={token}
```

> **Note:** Only include `messages_read,messages_write` in scope if implementing messaging.

- In **test**: Authorization is immediate (no real Airbnb account needed).
- In **production**: Host must be logged into Airbnb and manually approve.

### Step 3: Verify Host Status

```
GET airbnb-host-status
Body: { "token": 9851359133 }

Response:
{
  "host": {
    "statusCode": "5",
    "statusMessage": "Host is active"
  }
}
```

### Step 4: Get Host Listings

```
GET airbnb-listings
Body: { "token": 9851359133 }

Response: Array of listing objects with id, name, propertyType, amenities, etc.
Optional params: hasAvailability, excludeActive, excludeCohostedListings, _limit, _cursor
```

### Step 5: Activate Property in Zodomus

```
POST property-activation
Body:
{
  "channelId": 3,
  "propertyId": "12345023",
  "priceModelId": 4,
  "token": 9851359133
}
```

**Derived IDs (automatic):**
- `roomId = propertyId + "01"` (e.g., `"1234502301"`)
- `rateId = propertyId + "0001"` (e.g., `"123450230001"`)

> `rooms-activation` is NOT necessary for Airbnb — `property-activation` handles it.

### Important: Data cleared on API connection

When an existing listing connects to the API:
- iCal imports are unlinked (may open previously blocked dates)
- Listing converts to Instant Book
- Smart Pricing is disabled
- Custom pricing/availability settings are cleared
- Previous Lux pricing is cleared
- Existing listing relationships are cleared

---

## 4. Listing Model

### Single listing (standard)
- Availability = 1 (one unit per listing)
- Airbnb automatically manages availability on reservation confirm/cancel

### Room Type listing (multi-unit)
- `availableCount` > 1 (for Hotels and B&Bs)
- **Airbnb does NOT auto-adjust `availableCount`** on booking — Chamelio PMS must manage this manually
- Max value: 500

### availableCount rules

| `availability` value | Valid `available_count` | Behavior |
|---------------------|----------------------|----------|
| `"available"` | > 0 and <= 500 | Calendar marked as "default" |
| `"unavailable"` | >= 0 | Calendar marked as "unavailable" |
| `"default"` | >= 0 | If 0 → blocked; if > 0 → follows availability rules |

> **Always send both `available_count` AND `availability` together** to avoid discrepancies.

### Listing CRUD

**Create listing (2-step process):**

1. `POST airbnb-listings` — Step 1: Create with name only
2. `POST airbnb-listings` — Step 2: Update with full details (propertyType, address, capacity, price, amenities...)
3. Set `hasAvailability = true` to trigger Airbnb review and go live

**Update listing status:**
- `hasAvailability = true` → list (trigger review)
- `hasAvailability = false` → unlist
- `synchronizationCategory = "sync_all"` → connect to API
- `synchronizationCategory = "none"` → disconnect from API

**Other listing APIs:**
- `POST/GET airbnb-listing-descriptions` — Multi-locale support (locale: "en", "es", "pt"...)
- `POST/GET airbnb-listing-photos` — Base64 upload, 50KB–25MB, auto-cropped
- `POST/GET airbnb-listing-rooms` — Room/bed configuration
- `POST/GET airbnb-listing-permits` — Tourism permits/tax IDs

---

## 5. Calendar & Availability

### Set Calendar

```
POST airbnb-calendar
Body:
{
  "channelId": 3,
  "propertyId": 51224597,
  "operations": [
    {
      "dates": ["2025-07-01:2025-07-31"],
      "dailyPrice": 120,
      "availability": "available",
      "minNights": 2,
      "maxNights": 14,
      "closedToArrival": false,
      "closedToDeparture": false,
      "notes": "",
      "availableCount": 1
    }
  ]
}
```

### Get Calendar

```
GET airbnb-calendar
Body:
{
  "propertyId": 51224597,
  "startDate": "2025-07-01",
  "endDate": "2025-07-31"
}
```

Returns array of day objects with: `availability`, `availabilityType` (e.g., "reservation"), `dailyPrice`, `minNights`, `maxNights`, `closedToArrival`, `closedToDeparture`.

> **Calendar updates are asynchronous** — there may be a small delay between API call and actual update.

---

## 6. Pricing

### Price Model

- Default model: **STANDARD** (`priceModelId = 4`, per day)
- Must be explicitly set after property activation:

```
POST airbnb-pricing-availability
Body:
{
  "channelId": 3,
  "propertyId": "12345000",
  "pricingAvailabilityModelType": "STANDARD",
  "inModelTransition": "false",
  "clearIncompatibleSettings": "false"
}
```

### Pricing Settings

```
POST airbnb-pricing-settings
Body:
{
  "propertyId": 51224597,
  "pnaModel": "STANDARD",
  "listingCurrency": "EUR",
  "defaultDailyPrice": 100,
  "weekendPrice": 120,
  "guestsIncluded": 2,
  "pricePerExtraPerson": 15,
  "standardFees": [...],
  "passThroughTaxes": [...],
  "defaultPricingRules": [
    {
      "ruleType": "STAYED_AT_LEAST_X_DAYS",
      "priceChange": -15.53,
      "priceChangeType": "PERCENT",
      "thresholdOne": 7
    }
  ]
}
```

### Availability Rules

```
POST airbnb-availability-rules
Body:
{
  "propertyId": 51224597,
  "pnaModel": "STANDARD",
  "defaultMinNights": 1,
  "defaultMaxNights": 20,
  "bookingLeadTime": { "hours": 4, "allowRequestToBook": 0 },
  "maxDaysNotice": { "days": 270 },
  "turnoverDays": 2,
  "dayOfWeekCheckIn": [{"dayOfWeek": 0}, ...],
  "dayOfWeekCheckOut": [{"dayOfWeek": 0}, ...],
  "dayOfWeekMinNights": [{"dayOfWeek": 1, "minNights": 2}],
  "seasonalMinNights": {
    "startDate": "2025-07-01",
    "endDate": "2025-08-31",
    "minNights": 3
  }
}
```

### Booking Settings

```
GET airbnb-booking-settings → returns:
- cancellationPolicyCategory: "flexible" | "moderate" | "strict" | ...
- checkInTimeStart / checkInTimeEnd / checkOutTime
- instantBookingAllowedCategory: "everyone" | ...
- guestControls (children, pets, smoking, events)
```

---

## 7. Reservations

### Reservation Flow

There are **two types** of Airbnb reservations:

#### 1. Instant Book (most common)
- Guest books directly → reservation confirmed immediately
- Webhook notification: `notificationType=4, subtype=3` (acceptance confirmation)
- Standard reservation webhook also sent (same as Booking.com)

#### 2. Request to Book
- Guest sends request → host must accept/decline within 24h
- Webhook notification: `notificationType=4, subtype=1` (reservation requested)
- Accept/decline via `POST airbnb-reservations`

### Reservation Lifecycle Notifications

| Subtype | Event | Action Required |
|---------|-------|----------------|
| 1 | Reservation requested | Accept or decline via API |
| 2 | Request voided | No action |
| 3 | Reservation accepted/confirmed | Import reservation |
| 4 | Reservation alteration confirmed | Update reservation |
| 5 | Reservation cancelled | Cancel reservation |
| 6 | Alteration created (by host) | Track alteration |
| 7 | Alteration voided | No action |

### Reservation APIs (via Zodomus standard)

Also available through the standard Zodomus reservation APIs:
- `GET reservations-summary`
- `GET reservation`

### Airbnb-specific Reservation APIs

- `GET airbnb-reservations` — Get reservation details
- `POST airbnb-reservations` — Accept/decline request-to-book
- `GET/POST airbnb-reservation-alterations` — Manage date/price changes
- `GET airbnb-price-quote` — Get pricing for potential booking
- `GET airbnb-failed-requests` — Check failed reservation operations

---

## 8. Messaging

### Prerequisites
- Host must authorize with `messages_read,messages_write` in OAuth2 scope
- Very strict rate limits: **50 POST/min, 400 GET/min** (shared across ALL Zodomus clients)
- **Do NOT poll** — use webhook notifications (`notificationType=7`)

### Get Messages by Thread

```
GET airbnb-messages
Body:
{
  "channelId": 3,
  "token": "5778451234",
  "threadId": "2976236222"
}

Response: Array of messages with: id, message, userId, createdAt, attachmentImages[]
```

### Get Thread Details

```
GET airbnb-threads (by threadId)
Body:
{
  "channelId": 3,
  "token": "5778451234",
  "threadId": "29762364390"
}

Response includes:
- thread.attachment.bookingDetails (checkin, checkout, listing, guests, status)
- thread.roles (owner, guest, cohost userIds)
- thread.messages[]
- thread.users[] (firstName, id, preferredLocale)
- thread.attachment.status: "declined" | "canceled" | "accepted" | ...
- thread.attachment.type: "Inquiry" | "Reservation"
```

### Get All Threads

```
GET airbnb-threads (all)
Body: { "channelId": 3, "token": "5778451234" }
Params: _limit (max 25, default 20), _cursor (pagination)
```

### Send Message

```
POST airbnb-messages
Body:
{
  "channelId": 3,
  "token": "5778459033",
  "threadId": "2140062712",
  "message": "This is my answer"
}

// For images (text OR image, not both):
{
  "channelId": 3,
  "token": "5778459033",
  "threadId": "2140062712",
  "image": "<base64-encoded>",
  "contentType": "jpg"
}
```

### Content Restrictions
- Max text: 65,535 characters
- Supports `\n` for line breaks
- **Without a confirmed reservation**, Airbnb blocks: website links, phone numbers, emails
- Image formats: JPEG, JPG, GIF, PNG (max 5MB)
- Image links expire after 60 minutes

### Mark as Read

```
POST airbnb-messages (update status)
Body:
{
  "channelId": 3,
  "token": "57784590799",
  "messageId": "25134598563",
  "threadId": "2140062789",
  "markAsRead": true
}
```

### Messaging Webhooks

Zodomus forwards two webhook events:
- `notificationType=7, subtype=1` → **Message added** (new message from guest or host)
- `notificationType=7, subtype=2` → **Message updated** (read receipt, content edit, image unsent)

Webhook notification body:
```
webhookKey = your webhook key
channelId = 3
propertyId = <listing_id>
notificationType = 7
notificationSubtype = 1 (added) | 2 (updated)
notificationTypeId = <id for airbnb-webhook-notifications>
```

Get full notification details via:
```
GET airbnb-webhook-notifications
Body: { "typeId": "121121" }
```

---

## 9. Webhooks & Notifications

### Zodomus Webhook Configuration

Must be configured in Zodomus dashboard (Development → Access Type):
- **API Webhook**: `true` (mandatory for Airbnb)
- **API Webhook Availability**: `true` (recommended — enables pre-booking availability checks)

### Webhook Payload Types

The webhook receives **3 different body types**:

#### Type A: Reservation

```json
{
  "webhookKey": "your_key",
  "token": "host_token",
  "channelId": 3,
  "propertyId": "12345",
  "reservationId": "HMXXX",
  "reservationstatus": "confirmed"
}
```

#### Type B: Notification

```json
{
  "webhookKey": "your_key",
  "channelId": 3,
  "propertyId": "12345",
  "notificationType": 4,
  "notificationSubtype": 3,
  "notificationTypeId": "3341"
}
```

#### Type C: Availability Check

```json
{
  "webhookKey": "your_key",
  "channelId": 3,
  "propertyId": "12345",
  "notificationType": 3,
  "startDate": "2025-07-15",
  "nights": 3
}
```

- Respond `200 OK` if dates are available
- Respond `400` if dates are NOT available
- **Timeout = rejection** — keep response time fast
- Too many 400s or timeouts degrades listing quality on Airbnb

### Notification Types Summary

| Type | Description | Subtypes |
|------|-------------|----------|
| **1** | Host status | 1=Inactive, 2=Active, 3=Suspended, 4-7=Suspension/Reactivation variants |
| **2** | Listing status | 1=Approval changed, 2=Sync updated, 3=Sync failure, 4=Unlinked, 5=Auth revoked, 6=Edited, 7-11=Suspensions |
| **3** | Availability check | Pre-reservation verification (respond 200/400) |
| **4** | Reservations | 1=Requested, 2=Request voided, 3=Accepted, 4=Altered, 5=Cancelled, 6=Alteration created, 7=Alteration voided |
| **5** | Payouts | Payout notifications |
| **6** | Reviews | 1=Created, 2=Submitted, 3=Published, 4=Expired, 5=Response submitted |
| **7** | Messaging | 1=Message added, 2=Message updated |
| **8** | Special offers | 1=Created, 2=Voided |

---

## 10. API Rate Limits

### Global Limits (shared across ALL Zodomus clients)

| Metric | Limit |
|--------|-------|
| Max burst (same API) | 100 calls/second |
| Hourly average (same API) | 27 calls/second |
| Daily average (same API) | 23 calls/second |

### Message API Limits

| Method | Limit |
|--------|-------|
| POST messages | 50 calls/minute (< 1/sec) |
| GET messages | 400 calls/minute |

### Chamelio PMS Implementation Requirements

- Max **1 API call per second** per API endpoint
- Ideally less, since limits are shared with other Zodomus clients
- If limit is reached, Airbnb blocks ALL Zodomus clients for 1+ minutes
- **Never poll** for messages — use webhook notifications
- Queue and batch calendar updates where possible

---

## 11. API Reference (Complete List)

### Host APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `airbnb-host-activation` | Request new host token + client_id |
| POST | `airbnb-host-cancellation` | Disconnect host from Zodomus |
| GET | `airbnb-host-status` | Check host activation status |
| GET | `airbnb-host-info` | Get host profile from Airbnb |

### Listing APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `airbnb-listings` | Create or update listing |
| GET | `airbnb-listings` | Get one or all host listings |
| POST | `airbnb-listings-delete` | Delete a listing |
| POST | `airbnb-listing-descriptions` | Update descriptions (per locale) |
| POST | `airbnb-listing-descriptions-delete` | Delete descriptions |
| GET | `airbnb-listing-descriptions` | Get descriptions |
| POST | `airbnb-listing-photos` | Upload photo (base64) |
| POST | `airbnb-listing-photos-delete` | Delete photo |
| GET | `airbnb-listing-photos` | Get all photos |
| POST | `airbnb-listing-rooms` | Update room configuration |
| POST | `airbnb-listing-rooms-delete` | Delete room configuration |
| GET | `airbnb-listing-rooms` | Get room configuration |
| POST | `airbnb-listing-permits` | Update permits |
| GET | `airbnb-listing-permits` | Get permits |

### Rules & Settings APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `airbnb-availability-rules` | Set min/max nights, lead time, check-in days, turnover |
| GET | `airbnb-availability-rules` | Get availability rules |
| POST | `airbnb-pricing-settings` | Set default price, weekend price, fees, taxes, discounts |
| GET | `airbnb-pricing-settings` | Get pricing settings |
| POST | `airbnb-pricing-availability` | Set pricing model (STANDARD/LOS/Rate Plans) |
| POST | `airbnb-booking-settings` | Set cancellation policy, instant book, guest controls |
| GET | `airbnb-booking-settings` | Get booking settings |
| POST | `airbnb-seasonal-rule` | Create/update seasonal rules |
| POST | `airbnb-seasonal-rule-delete` | Delete seasonal rules |
| GET | `airbnb-seasonal-rule` | Get seasonal rules |
| POST | `airbnb-seasonal-rule-timeline` | Set seasonal rule timeline |
| GET | `airbnb-seasonal-rule-timeline` | Get seasonal rule timeline |
| POST | `airbnb-LOS-records` | Create/update length-of-stay records |
| GET | `airbnb-LOS-records` | Get LOS records |

### Calendar APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `airbnb-calendar` | Set prices, availability, restrictions per date range |
| GET | `airbnb-calendar` | Get calendar data for date range |

### Reservation APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `airbnb-failed-requests` | Get failed reservation operations |
| POST | `airbnb-reservations` | Accept/decline request-to-book |
| GET | `airbnb-reservations` | Get reservation details |
| POST | `airbnb-reservation-alterations` | Create reservation alteration |
| GET | `airbnb-reservation-alterations` | Get alteration details |
| GET | `airbnb-price-quote` | Get price quote for dates |

### Messaging APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `airbnb-messages` | Get messages by threadId |
| GET | `airbnb-threads` | Get thread(s) with booking details |
| POST | `airbnb-messages` | Send text or image message |
| POST | `airbnb-messages` (update) | Mark message as read |

### Review APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `airbnb-reviews` | Submit review |
| GET | `airbnb-reviews` | Get reviews |
| GET | `airbnb-reviews-stats` | Get review statistics |

### Payout & Notification APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `airbnb-payout-queue` | Get pending payouts |
| GET | `airbnb-payout` | Get payout details |
| GET | `airbnb-notifications` | Get notifications |
| GET | `airbnb-webhook-notifications` | Get full notification detail by typeId |

### Standard Zodomus APIs (also work with Airbnb)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `room-rates` | Get room/rate mapping |
| GET | `availability` | Get availability |
| POST | `property-activation` | Activate property (with token for Airbnb) |
| POST | `rooms-activation` | Activate rooms (not needed for Airbnb) |
| POST | `property-check` | Check property status |
| POST | `availability` | Set availability (async for Airbnb) |
| GET | `reservations-summary` | Get reservation list |
| GET | `reservation` | Get single reservation |

---

## 12. ID Format & Migration

Airbnb IDs are migrating from 64-bit integers to **128-character URL-safe strings**.

**Affected IDs:**
- `user_id`, `listing_id`, `property_id`, `review_id`, `message_id`
- `roomtype_id`, `thread_id`, `seasonal_rule_set_id`
- `reservation_alteration_id`, `rate_plan_id`

**Chamelio PMS requirement:** All Airbnb-related ID columns must be `VARCHAR(128)` or `TEXT`, never integer.

---

## 13. Implementation Notes for Chamelio PMS

### Database Considerations
- All Airbnb IDs stored as `TEXT` / `VARCHAR(128)` (not integer)
- Store `airbnbHostToken` per organization for API authentication
- Store `airbnbClientId` per organization for OAuth flow
- Track `airbnbListingId` per room unit or property for mapping
- Derived IDs: `roomId = listingId + "01"`, `rateId = listingId + "0001"`

### Webhook Endpoint Requirements
- Must be fast (< 5s response for availability checks)
- Handle 3 payload types: reservation, notification, availability_check
- Return 200/400 appropriately for availability checks
- Process asynchronously where possible (queue notifications)

### Rate Limiting Strategy
- Implement a global rate limiter for Zodomus Airbnb API calls
- Max 1 call/second per endpoint
- Queue and batch calendar updates
- Never poll for messages — webhook only

### Availability Management
- For single-unit listings: Airbnb auto-manages (just like Booking.com)
- For multi-unit listings: Chamelio PMS must send `availableCount` updates on every reservation change
- Always send `availability` + `availableCount` together

### Calendar Sync
- Push-based: Chamelio PMS pushes prices/availability to Airbnb via `POST airbnb-calendar`
- Calendar operations are async — don't assume immediate effect
- Use the standard Zodomus `POST availability` for rates (priceModelId = 4, per day)

### OAuth Flow
- Build a settings page where admin can initiate Airbnb connection
- Store token + client_id securely per organization
- Handle authorization redirect (Zodomus handles the redirect_uri)
- Check host status after authorization

### Messaging Integration
- Only fetch messages on webhook trigger (never poll)
- Store thread_id with reservation for context
- Respect content restrictions (no links/phones/emails without confirmed reservation)
- Images: base64 encode, max 5MB, JPEG/PNG/GIF only
