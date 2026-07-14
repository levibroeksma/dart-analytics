<!--
status: canonical
scope: frontend/integration
read-when: frontend API integration and state ownership
updated: 2026-07-14
-->

# Frontend Overview

> **Version:** 0.3.1
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

Structural patterns (folders, Alpine, modules) live in the handbook chapters below.

---

# Handbook Index

| Doc | Answers |
| --- | ------- |
| `01-Rendering-Strategy.md` | Prerender-default, middleware, route classes |
| `02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes |
| `03-Alpine-Patterns.md` | `app.factory`, stores, forms, `$persist` |
| `04-Modules-And-OOP.md` | Modules, portable UI kit, validation boundary |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |

**Authority:** API integration and data flows — this file. Rendering, folders, Alpine, modules — `01`–`04`.

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

Temporary state is held in Alpine stores using the `$persist` plugin (localStorage), keyed by `gameTypeKey`, so it survives page refreshes on the same device. Recovery is client-local: when local persisted state and `GET /api/sessions/active` agree on `sessionId`, the client resumes from the store. When local state is missing or `sessionId` mismatches, the client **automatically** `PATCH`es the server session to `ABANDONED` — no user prompt. Client-side orphans are the client's responsibility; server-side DB orphan sweeps are deferred server responsibility. The server holds no mid-session gameplay; losing the device (or clearing storage) loses the in-progress session. <!-- 2026-07-14 -->

## Persistent state (API-owned)

After session completion, persistent state is written via the API:

- activities, exercise sessions, stages, turns, darts
- configuration snapshots
- session status transitions

The frontend sends gameplay-derived payloads. It does not send persistence UUIDs. The Worker generates UUIDv7 for runtime entities.

A completed session whose batch upload fails is held in a persisted `outbox` store and retried (same `Idempotency-Key`) until the server confirms it — the finished batch is never dropped between completion and acknowledgement. Mechanism: `03-Alpine-Patterns.md` (Completed-Batch Outbox). <!-- 2026-07-14 -->

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

## Skeleton-first hydration

For data-heavy pages (session history, statistics, active sessions):

1. render page shell and skeleton UI immediately
2. fetch from `/api/*` on client
3. hydrate content when the response resolves
4. show error state on failure (do not silently fail)

This pattern keeps first paint fast while respecting the API as the only data gateway.

---

# Client Structure

Browser code uses `@client/` (API client, auth, Alpine factory), top-level `stores/`, `forms/`, `modules/`, and `types/`. Full tree, aliases, and suffix rules: `02-Folder-Structure.md`.

> **v1 note:** statistics API endpoints are deferred post-v1 (see `../06-API/00-Overview.md`). The `/statistics` route is a placeholder shell only — no stats API calls until view-backed endpoints ship. <!-- 2026-07-14 -->

Server-side response helpers live in `lib/server/` — `@client/api/` is browser code only (see `../06-API/02-Middleware-And-Layering.md`). <!-- 2026-07-13 -->

## Client wrapper responsibilities

| Concern | `@client/api/client.ts` | Page / form |
| ------- | ----------------------- | ----------- |
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

- use `fetch` (via `@client/api/client.ts`) for all domain API calls
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
| Manual abandon dialog on session mismatch | client auto-cleans per D88 |
| Use `x-init` | deprecated — use factory `init()` via `x-data="factory()"` |

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
| `01-Rendering-Strategy.md` | Prerender-default, middleware |
| `02-Folder-Structure.md` | Tree, aliases, suffixes |
| `03-Alpine-Patterns.md` | Alpine factory, stores, forms |
| `04-Modules-And-OOP.md` | Modules, portable UI kit |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
| `../06-API/00-Overview.md` | Frozen API contract (v1.3.0) |
| `../06-API/01-Implementation-Strategy.md` | Why REST endpoints over Actions |
| `../06-API/02-Middleware-And-Layering.md` | Middleware and service layer structure |
| `../02-System-Architecture.md` | Presentation layer responsibilities |
| `../01-Principles.md` | Frontend principles |
