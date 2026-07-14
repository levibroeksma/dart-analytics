<!--
status: canonical
scope: frontend/integration
read-when: frontend API integration and state ownership
updated: 2026-07-14
-->

# Frontend Overview

> **Version:** 0.3.0
>
> This document defines how the Astro frontend in `app/` integrates with the Worker API layer.
>
> It covers state ownership, API client patterns, and hydration behaviour.
>
> API contract details remain in `../06-API/00-Overview.md`.

---

# Purpose

The frontend exists to provide user interaction, rendering, and temporary gameplay state.

It must not become the primary source of business logic or the owner of persistent domain data.

This document defines how the presentation layer communicates with the API boundary defined in `06-API/`.

---

# Layer Ownership

| Responsibility | Owner |
| -------------- | ----- |
| User interaction and UX | Frontend |
| Game engine and scoring logic (in-session) | Frontend |
| Temporary gameplay state during active session | Frontend |
| Persistent domain data | PostgreSQL (via API) |
| Identity verification | Worker middleware |
| Domain authorization and transactions | Worker service layer |
| Authentication (login, token refresh) | Neon Auth (external) |

The frontend never communicates directly with PostgreSQL.

---

# State Model

## Temporary state (frontend-owned)

During an active session, the frontend owns:

- current score and turn progression
- UI interaction state
- in-progress dart entry before batch upload
- Alpine.js component state

Temporary state is held in Alpine stores using the `$persist` plugin (localStorage), so it survives page refreshes and browser restarts on the same device. Recovery is client-local: on load, the client checks `GET /api/sessions/active` for an orphaned active session and offers **resume** (rehydrating from the persisted store) or **abandon** (`PATCH` → `ABANDONED`). The server holds no mid-session gameplay; losing the device (or clearing storage) loses the in-progress session. <!-- 2026-07-13 -->

### Two persisted stores

Temporary state is split across two Alpine stores with different lifecycles, because they change at different rates:

| Store | Holds | Shape driven by | Volatility |
| ----- | ----- | --------------- | ---------- |
| `session` (draft) | current ACTIVE game: `sessionId`, `participantRef`, `idempotencyKey`, capture/input modes, in-progress stages/turns/darts | **UI** — evolves with the engine and screens | High |
| `outbox` | array of completed-but-unsent batches: `{ sessionId, idempotencyKey, payload, attempts, lastError }` | **frozen `EventsBatchRequest`** (`../06-API/04-Endpoint-Contracts.md`) | Low |

The `session` draft is UI-shaped and churns as the engine and screens evolve; the `outbox` payload **is** the frozen API contract and does not. Keeping them separate means UI change never touches the durability path. <!-- 2026-07-14 -->

### Idempotency-key lifecycle

The batch `Idempotency-Key` is generated **once at session start**, stored on the `session` draft, carried into the `outbox` entry at completion, and **reused on every upload retry** — never regenerated per attempt. This makes the "server persisted the batch but the client never received the ack" case self-healing: retry with the same key + same payload hash returns the server's stored result (`../06-API/00-Overview.md` idempotency contract), and the client dequeues. <!-- 2026-07-14 -->

### Completed-but-unsent outbox

On session completion the assembled batch moves `session` → `outbox`; upload is attempted with a small number of backoff retries. On persistent failure the entry stays in the outbox, a passive **"unsaved — will retry"** indicator is shown, and auto-retry fires on next app load and on the browser `online` event. The entry is removed **only on confirmed success** (the server's same-key/same-hash stored-result response counts as success). No user action is required in the normal case. <!-- 2026-07-14 -->

### Per-store versioning

Each persisted store carries a `_v` integer with a **per-store version constant**, because the two stores warrant different discard policies:

- **`session` draft** — on `_v` mismatch, **discard** (`reset()`). An in-progress draft the current code cannot parse is unrecoverable anyway; abandon-and-restart is consistent with the accepted "device loss = data loss" tradeoff.
- **`outbox`** — its payload is the frozen `EventsBatchRequest`, so it is version-stable by construction. Policy is **attempt-upload-then-discard**, never blind discard. Silently dropping finished-but-unsent games is the one client-side data loss we actively prevent. <!-- 2026-07-14 -->

### Recovery is a precondition, not a convenience

`GET /api/sessions/active` reconciliation (resume/abandon) is a **precondition** for starting a new game: `uq_sessions_single_active` rejects a second ACTIVE session server-side, so a new game cannot be created while an orphaned ACTIVE session exists — the client must resume or abandon first. <!-- 2026-07-14 -->

## Persistent state (API-owned)

After session completion, persistent state is written via the API:

- activities, exercise sessions, stages, turns, darts
- configuration snapshots
- session status transitions

The frontend sends gameplay-derived payloads. It does not send persistence UUIDs. The Worker generates UUIDv7 for runtime entities.

---

# Data Flow

## Write flow

```
User interaction
    │
    ▼
Game engine (frontend)
    │
    ▼
Temporary client state
    │
    ▼
Session complete
    │
    ▼
POST /api/sessions/:sessionId/events/batch
    │  Authorization: Bearer <JWT>
    │  Idempotency-Key: <uuid>
    ▼
Worker service layer → PostgreSQL
```

Rules:

- batch upload at session boundary — not per-dart API calls
- include `Idempotency-Key` on every batch write for safe retries
- frontend payload contains gameplay ordering and dart facts, not persistence UUIDs

## Read flow

```
Page load (skeleton)
    │
    ▼
Client-side fetch to /api/*
    │  Authorization: Bearer <JWT>
    ▼
Worker → v_* views → JSON envelope
    │
    ▼
Hydrate UI (Alpine / DOM update)
```

---

# Boundary Rules & Performance

Two hard boundary rules keep the model consistent as new games, rulesets, player types, and eventually online play arrive:

1. **Client state is never a source of truth.** Persisted stores hold *intent pending confirmation* and nothing else; the instant the server confirms, the authoritative copy is the database. This is the client-side application of the Single Source of Truth value (`../01-Principles.md`).
2. **The outbox is the single durability seam, with an explicit acceptance contract.** Exactly one queue carries client → permanent data, and only ruleset-valid, fully-formed, frozen-shape `EventsBatchRequest` batches may enter it. Every future delivery path (including online sync) reuses this seam and the idempotency contract.

## Performance constraints (Neon + Cloudflare)

| Rule | Rationale |
| ---- | --------- |
| One transaction per session (batch at boundary); never per-dart server writes | Neon bills compute; CF Workers cap CPU/subrequests per request. Per-dart writes multiply latency and cost; the outbox bounds the DB to one write burst per session. |
| Reads view-backed, player-scoped, skeleton-first | Keeps first paint off the DB critical path; a small view-backed query set maps onto future Neon read replicas + edge caching. |
| Bound the batch payload size | A CF Worker has a finite CPU/transaction budget; a documented max-payload guard prevents a pathological session from exceeding it. |
| HTTP driver for reads; WebSocket/transaction driver only for the batch write | The existing `db/client.ts` factory split — the HTTP one-shot path is cheapest for view reads. |

## Deliberately not built now

- **No multi-device / server-authoritative mid-session state.** Online/live play arrives later as an **additive** capture mode with per-*turn* (never per-dart) server sync, reusing the idempotency contract; the offline-tolerant local-first path stays valid for solo play. Building sync now would force-unfreeze the recovery model and the API contract.
- **localStorage is the v1 persistence backend.** If offline queuing ever deepens, the **outbox only** migrates to IndexedDB via a `$persist` custom storage adapter. Forward lever, not built. <!-- 2026-07-14 -->

---

# API Client Pattern

## Transport

All protected API calls use:

```
Authorization: Bearer <JWT>
```

Token acquisition and refresh are handled by Neon Auth — not by custom API endpoints.

## Response handling

All API responses use the standard envelope from `06-API/00-Overview.md`.

Success:

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
```

Error:

```json
{
  "ok": false,
  "requestId": "uuid",
  "error": {
    "code": "DOMAIN_ERROR_CODE",
    "message": "human-readable summary",
    "retryable": false,
    "details": {}
  }
}
```

Frontend client code must:

1. check `ok` before reading `data`
2. handle domain error codes for user-facing messages
3. retry only when `error.retryable === true` and an idempotency key is available (batch writes)

The client wrapper (`lib/api/client.ts`) **throws a typed `ApiError(code, retryable, details)` on `!ok`** and returns the parsed `data` on success, so call sites do not each re-check `ok`. It attaches the Bearer token, parses the envelope, and auto-retries only `retryable` batch writes with the stored idempotency key. Per-domain wrappers (`sessions.ts`, …) import the `z.infer` DTOs from `../06-API/04-Endpoint-Contracts.md`. See `01-Client-Patterns.md` for the client structure. <!-- 2026-07-14 -->

## Skeleton-first hydration

For data-heavy pages (session history, statistics, active sessions):

1. render page shell and skeleton UI immediately
2. fetch from `/api/*` on client
3. hydrate content when the response resolves
4. show error state on failure (do not silently fail)

This pattern keeps first paint fast while respecting the API as the only data gateway.

---

# Recommended Client Structure

```
app/src/lib/
├── api/
│   ├── client.ts          # fetch wrapper: auth header, envelope parsing, error handling
│   ├── sessions.ts        # typed calls for session endpoints
│   ├── routines.ts
│   ├── configuration-templates.ts
│   └── statistics.ts
└── auth/
    └── token.ts           # Neon Auth token access for API calls
```

> **v1 note:** statistics API endpoints are deferred post-v1 (see `../06-API/00-Overview.md`), so `lib/api/statistics.ts` and any statistics page are post-v1 additions. v1 focuses on capturing gameplay facts and the session/routine reads. <!-- 2026-07-12 -->

Server-side response helpers live in `lib/server/` — `lib/api/` is browser code only (see `../06-API/02-Middleware-And-Layering.md`). <!-- 2026-07-13 -->

## Client wrapper responsibilities

| Concern | `lib/api/client.ts` | Page / component |
| ------- | ------------------- | ---------------- |
| Attach Bearer token | Yes | Never |
| Parse ok/error envelope | Yes | — |
| Map domain codes to UI messages | Optional helper | Yes |
| Retry logic | Yes (retryable only) | — |
| Business logic | Never | Never |

---

# Example Calls

## Read active sessions

```typescript
const response = await apiClient.get('/api/sessions/active');
// response.data contains view-backed session list
```

## Batch write at session complete

```typescript
await apiClient.post(`/api/sessions/${sessionId}/events/batch`, {
  headers: { 'Idempotency-Key': idempotencyKey },
  body: gameplayPayload,
});
```

The payload shape is `EventsBatchRequest` in `../06-API/04-Endpoint-Contracts.md`. Payloads contain gameplay facts, not persistence UUIDs.

---

# Astro Actions — Frontend Guidance

Astro Actions are not the primary API integration mechanism for this application.

For v1:

- use `fetch` (via `lib/api/client.ts`) for all domain API calls
- do not replace REST endpoints with Actions for sessions, routines, or statistics
- Actions may be introduced post-v1 for internal UI-only forms that delegate to the same service layer

Rationale: the frozen API contract is REST under `/api/*` with Bearer JWT and custom headers. See `06-API/01-Implementation-Strategy.md`.

---

# Frontend Must Not

| Anti-pattern | Reason |
| ------------ | ------ |
| Direct database access | violates layer boundaries |
| Generate persistence UUIDs | Worker owns UUIDv7 for runtime entities |
| Compute statistics for display from raw tables | statistics come from API / views |
| Store completed gameplay as source of truth locally | PostgreSQL is authoritative |
| Parse or verify JWT in page scripts | middleware owns identity verification |
| Per-dart API calls during active play | batch write at session boundary |
| Rely on the server for mid-session recovery | in-progress state is client-local (persisted Alpine store) |

---

# Technology Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Astro.js |
| Interactivity | Alpine.js |
| Styling | Tailwind CSS |
| API transport | `fetch` with Bearer JWT |
| Auth provider | Neon Auth |
| Deployment | Cloudflare Workers (`@astrojs/cloudflare`) |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `../06-API/00-Overview.md` | Frozen API contract (v1.3.0) |
| `../06-API/01-Implementation-Strategy.md` | Why REST endpoints over Actions |
| `../06-API/02-Middleware-And-Layering.md` | Middleware and service layer structure |
| `../02-System-Architecture.md` | Presentation layer responsibilities |
| `../01-Principles.md` | Frontend principles |
