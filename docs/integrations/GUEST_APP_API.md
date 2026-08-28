# Guest App API (`/api/v1`)

> Public, read-only integration API. Consumed machine-to-machine by the
> Chamelio guest-app and any future external product.
> **Status:** phases 1–3 shipped — auth, all read endpoints, per-key rate
> limiting, request logging and key management in **Settings → API**.

---

## 1. Security model — read this first

An API key is scoped to **one organization** (optionally narrowed to one
property) and can read **every reservation in that scope**. It is not a
per-guest credential.

> **The key must never ship inside a mobile binary.** It lives on the
> guest-app's own backend. That backend is what authenticates the guest
> (confirmation code + surname, magic link, whatever it chooses) and decides
> which of the data it fetched that guest is allowed to see.

Anything embedded in an app binary is readable — decompilation, or simply
proxying the device's traffic. A leaked key would expose the whole property's
guest list.

If the guest-app ever needs to call the PMS **directly from the device**, this
design does not cover it: the PMS would have to issue short-lived per-reservation
tokens instead. That is a different feature, not a config change.

---

## 2. Authentication

```
Authorization: Bearer cham_live_<secret>
```

Keys are managed in **Settings → API** (owner/admin only): create, see the
prefix and last use, and revoke. Revoking takes effect on the next request.

There is also a CLI, for scripting and seeding:

```bash
npm run api:key -- --org=<slug> --name="Guest app" --scopes=reservations:read
```

Options: `--property=<code>` restricts the key to a single property,
`--expires=YYYY-MM-DD` sets an expiry. Omitting `--scopes` grants every read
scope.

The secret is displayed **once** and is not recoverable — only its SHA-256
digest is stored ([`api_keys.key_hash`](../../src/server/db/schema/api-keys.ts)).
Lost keys are replaced, not recovered.

### Scopes

| Scope | Grants |
|---|---|
| `properties:read` | Properties and their public settings |
| `room_types:read` | Room types and images, and the units of a property |
| `reservations:read` | Reservations |
| `guests:read` | Guest profiles, and the `guest` expansion on reservations |
| `folios:read` | Folios, charges, balances |
| `availability:read` | Availability search |

A request whose key lacks the required scope gets `403 insufficient_scope`.
Grant the narrowest set that works.

---

## 3. Response shape

Success:

```json
{ "data": [ ... ], "meta": { "nextCursor": "eyJ…", "hasMore": true } }
```

`meta` is present only on list endpoints. Error:

```json
{ "error": { "code": "invalid_api_key", "message": "Invalid API key" } }
```

Branch on `code`, never on `message` — messages may be reworded.

| Code | HTTP | Meaning |
|---|---|---|
| `missing_credentials` | 401 | No `Authorization: Bearer` header |
| `invalid_api_key` | 401 | Unknown key |
| `key_revoked` | 401 | Key was revoked |
| `key_expired` | 401 | Key passed its expiry |
| `organization_suspended` | 403 | Organization is not active |
| `insufficient_scope` | 403 | Key lacks the required scope |
| `invalid_request` | 400 | Bad query parameters or cursor (see `details`) |
| `rate_limited` | 429 | Too many requests — see `Retry-After` |
| `not_found` | 404 | No such resource in this scope |
| `internal_error` | 500 | Unexpected failure — retry with backoff |

`invalid_api_key` is returned identically for "no such key" and "wrong key", so
a caller cannot probe for valid key prefixes.

---

## 4. Rate limits

Every response carries the current budget:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1787854440      # unix seconds when the window resets
```

A `429` adds `Retry-After` in seconds. Requests that get 429'd still count
against the window, so ignoring the limit does not buy a free retry.

Two independent budgets, each a fixed one-minute window:

| Bucket | Limit | Applies to |
|---|---|---|
| `default` | per key, 120/min by default | every endpoint except lookup |
| `lookup` | **10/min, fixed** | `/reservations/lookup` only |

Separating them means a burst of ordinary reads cannot exhaust the allowance
that protects guest identification, and a brute-force loop against `lookup`
cannot starve the rest of the integration.

Two caveats worth knowing:

- It is a **fixed** window, not sliding, so up to 2× the limit can pass across
  a window boundary. This exists to stop runaway clients and brute-force loops,
  not to meter billing.
- If the counter itself fails, the API **fails open** — a broken limiter must
  not take the whole API down.

Unauthenticated requests are not rate limited: there is no key to attribute
them to, and guessing a 256-bit key is not a viable attack.

## 5. Pagination and polling

List endpoints walk `(updatedAt, id)` **ascending** and return an opaque
`nextCursor`. Pass it back to get the next page; stop when `hasMore` is false.

To poll for changes, store the `updatedAt` of the last row you processed and
send it as `updatedSince` on the next run:

```
GET /api/v1/reservations?updatedSince=2026-08-27T11:35:18.562Z&limit=200
```

`updatedSince` is **inclusive**, so the boundary row may come back again —
de-duplicate by `id`. Cursors are opaque: do not parse, construct, or persist
them beyond the walk they belong to. A cursor from a different filter set is
meaningless; restart the walk when filters change.

---

## 6. Endpoints

All endpoints are `GET`. A key restricted to one property is confined to it
everywhere: passing a different `propertyId` is rejected with `invalid_request`,
and fetching a resource by id from outside the scope returns **404, not 403** —
a 403 would confirm the resource exists.

### `GET /reservations` — `reservations:read`

Keyset-paginated list. The only paginated endpoint.

| Parameter | Type | Notes |
|---|---|---|
| `propertyId` | uuid | Rejected if the key is restricted to another property |
| `status` | csv | `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show` |
| `updatedSince` | RFC 3339 | Inclusive lower bound on `updatedAt` |
| `checkInFrom` / `checkInTo` | `YYYY-MM-DD` | Inclusive range on `checkInDate` |
| `cursor` | opaque | From a previous `meta.nextCursor` |
| `limit` | int | 1–200, default 50 |
| `include` | csv | `guest`, `unit` — expand related resources on every row |

`include=guest` additionally requires **`guests:read`**; `include=unit` needs
nothing beyond `reservations:read`. Each expansion costs **one batched query
for the whole page**, not one per row, so a 200-row page with both is three
queries. `folio` is rejected here on purpose (`invalid_request`): one folio per
reservation across a full page is a query storm, and nothing needs balances in
bulk — fetch the single reservation for that.

A reservation with no room assigned yet returns `"unit": null`. The field is
absent entirely when the expansion was not requested — `null` means unassigned,
missing means unasked.

```bash
curl -H "Authorization: Bearer $CHAMELIO_API_KEY" \
  "https://<host>/api/v1/reservations?updatedSince=2026-08-27T00:00:00Z&include=guest,unit&limit=200"
```

Unit expansion is what lets an integration act on the room: the reservation
already carries `unitId`, but a UUID cannot be matched against a door lock or
printed on a key card. `unit` exposes `id`, `name` and `floor` — never
housekeeping state, staff notes or inventory flags.

```bash
curl -H "Authorization: Bearer $CHAMELIO_API_KEY" \
  "https://<host>/api/v1/reservations?status=confirmed&limit=200"
```

```json
{
  "id": "000821dd-fdf8-49c2-b3ac-9e684bf954d6",
  "confirmationCode": "HGU-26-00027",
  "propertyId": "a5eba281-…", "guestId": "301adc9d-…",
  "roomTypeId": "f35f4d6a-…", "unitId": "967b3c0b-…",
  "status": "checked_out", "source": "booking_com",
  "checkInDate": "2026-07-16", "checkOutDate": "2026-07-20", "nights": 4,
  "adults": 2, "children": 0,
  "totalAmount": "411.84", "currency": "EUR",
  "specialRequests": "Preferimos apartamento tranquilo.",
  "cancelledAt": null,
  "createdAt": "2026-08-27T11:35:18.562Z",
  "updatedAt": "2026-08-27T11:35:18.562Z"
}
```

**Never returned:** `organizationId`, `internalNotes`, `cancellationReason`.
On an expanded `unit`: `status`, `housekeepingStatus`, `notes`, `isActive`,
`sortOrder`.

### `GET /reservations/{id}` — `reservations:read`

`?include=guest,unit,folio` expands related resources. **`guest` additionally
requires `guests:read`, `folio` requires `folios:read`** — a key without them
gets `403 insufficient_scope` rather than a silently trimmed response. `unit`
requires no extra scope.

`folio` and `unit` are `null` when the reservation has no folio / no room
assigned yet; the field is absent entirely when not requested.

### `GET /reservations/lookup` — `reservations:read` **and** `guests:read`

The guest-identification endpoint. Both factors are required and both must
match; the surname is compared case-insensitively (not accent-folded).

```
GET /api/v1/reservations/lookup?confirmationCode=HGU-26-00027&lastName=Goossens
```

Returns the reservation with `guest` embedded. Every failure — unknown code,
wrong surname, other property, other organization — returns the **same 404**,
so the endpoint cannot confirm whether a confirmation code exists.

> Confirmation codes are sequential per property. Two factors, a uniform 404
> and a dedicated 10/min bucket are what stop this endpoint from being an
> enumeration oracle. The calling backend should still throttle its own users,
> since the bucket is per API key, not per end user.

### `GET /properties` and `GET /properties/{id}` — `properties:read`

Bounded list, not paginated.

```json
{
  "id": "a5eba281-…", "name": "Apartamentos Hotel Guardamar", "code": "HGU",
  "address": { "street": "Av. de Europa 45", "city": "Guardamar del Segura",
               "state": "Alicante", "postalCode": "03140", "country": "ES" },
  "phone": "+34 966 728 100", "email": "reservas@example.com",
  "checkInTime": "16:00:00", "checkOutTime": "11:00:00",
  "timezone": "Europe/Madrid", "isActive": true
}
```

**Never returned:** `organizationId`, `plan`, `maxUnits`,
`ipRestrictionEnabled`, `allowedIps`. The last two describe the PMS's own
access controls and are withheld deliberately.

### `GET /room-types` — `room_types:read`

`?propertyId` filters. `images` merges the managed `room_type_images` rows
(cover first, then sort order) with the legacy URL array, de-duplicated.

### `GET /units` — `room_types:read`

The physical rooms/apartments. `?propertyId` filters. Bounded list, not
paginated, in the PMS's own display order.

```json
{
  "id": "967b3c0b-…", "propertyId": "a5eba281-…", "roomTypeId": "f35f4d6a-…",
  "name": "403", "floor": "4", "isActive": true
}
```

It exists so an integration can **mirror the inventory instead of having
someone retype it**: door locks are configured per unit, and a name typed by
hand into two systems drifts. Store the `id` alongside your own room and match
on it — matching on `name` breaks the day a unit is renamed here.

`isActive` is exposed on purpose: an importer needs to know which units are
retired, or it recreates them on every run.

**Never returned:** `organizationId`, `status`, `housekeepingStatus`, `notes`,
`sortOrder`.

### `GET /folios/{id}` — `folios:read`

The folio with `lineItems` and `payments`.

**Never returned:** `organizationId`, folio `notes`, payment `notes`, and the
staff user behind each line (`createdBy` / `processedBy`).

### `GET /availability` — `availability:read`

`?propertyId` (required unless the key is restricted to one), `checkIn`,
`checkOut`, `adults`, `children`.

Runs the same search as the public booking engine, so prices and stay
restrictions match what the booking site shows. Amounts are normalised to
fixed-2-decimal strings here — the engine works in floats internally and would
otherwise emit values like `335.28000000000003`.

### A note on money and dates

Monetary fields are **decimal strings** (`"411.84"`) across the whole API,
mirroring the `numeric` columns — never parse them as floats for arithmetic.
`checkInDate` / `checkOutDate` / line-item `date` are business dates without a
timezone; `createdAt`, `updatedAt`, `cancelledAt`, `processedAt` are UTC
instants.

The exposed field list of every DTO is pinned by
[`dto-contract.test.ts`](../../src/server/api/v1/dto/dto-contract.test.ts) and
[`reservation.dto.test.ts`](../../src/server/api/v1/dto/reservation.dto.test.ts),
which fail if a mapper ever drifts.

## 7. Observability and retention

Every authenticated request is logged to `api_request_logs` — method, path,
status, error code, duration — and the last 25 are shown in Settings → API,
alongside a 24-hour request/error count per key.

**Query strings are never stored.** `/reservations/lookup` carries a guest's
surname in one, and a log table is the wrong place for that.

The table grows without bound and nothing prunes it on the request path. Run
this on a schedule:

```bash
npm run api:prune -- --days=30
```

Add `--dry-run` to see what would go. Rate-limit counters (`api_key_usage`)
need no maintenance — a key prunes its own stale windows when it opens a new
one.

## 8. Not built yet

| | |
|---|---|
| Outbound webhooks | Not planned; polling only |
| Any write operation | Not planned; this API is read-only by design |
| Per-end-user throttling on lookup | The bucket is per key; the calling backend owns its own users |
| Editing a key's scopes or limit after creation | Revoke and issue a new one |

---

## 9. How it fits together

| Piece | File |
|---|---|
| Table | [`api-keys.ts`](../../src/server/db/schema/api-keys.ts) |
| Key generation / hashing | [`api-key.ts`](../../src/lib/utils/api-key.ts) |
| Auth wrapper + scopes | [`with-api-key.ts`](../../src/server/api/with-api-key.ts) |
| Response envelope | [`response.ts`](../../src/server/api/response.ts) |
| Cursors | [`cursor.ts`](../../src/server/api/cursor.ts) |
| Query validation | [`api-v1.ts`](../../src/lib/validators/api-v1.ts) |
| Property scoping | [`scope.ts`](../../src/server/api/scope.ts) |
| DTOs | [`v1/dto/`](../../src/server/api/v1/dto/) |
| Routes | [`api/v1/`](../../src/app/api/v1/) |
| Rate limiter | [`rate-limit.ts`](../../src/server/api/rate-limit.ts) |
| Request logging | [`request-log.ts`](../../src/server/api/request-log.ts) |
| Settings screen | [`api-keys-client.tsx`](../../src/components/settings/api-keys-client.tsx) |
| Key management actions | [`api-keys.ts`](../../src/server/actions/api-keys.ts) |

`withApiKey` resolves the key to an `ApiContext` and every handler threads
`context.organizationId` into the repository layer, so Golden Rule #1 holds
across this surface exactly as it does for Server Actions. `/api/v1` is
excluded from the Auth.js matcher in [`middleware.ts`](../../src/middleware.ts)
so failures return JSON 401s instead of an HTML redirect to `/login`.
