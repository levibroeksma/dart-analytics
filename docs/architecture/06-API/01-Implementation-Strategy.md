<!--
status: canonical
scope: api/implementation-strategy
read-when: implementing endpoints on Cloudflare + Neon
updated: 2026-07-13
-->

# API Implementation Strategy

> **Version:** 1.0.1 (frozen v1; layout reconciliation 2026-07-13)
>
> This document defines how the v1 API baseline (`00-Overview.md`) is implemented in `app/`.
>
> It covers runtime approach selection, Cloudflare Workers and Neon integration constraints, and scalability guidance.
>
> Contract details (routes, envelopes, error codes) remain owned by `00-Overview.md`.

---

# Purpose

The v1 API contract is frozen in `00-Overview.md`.

This document answers implementation questions that the contract does not specify:

- what "proxy API" means in this project
- how Astro server endpoints implement the frozen REST contract on Cloudflare Workers
- how the API layer scales with Neon Postgres
- where business logic belongs relative to middleware and handlers

---

# Terminology — Proxy API

In this project, **proxy API** does not mean a separate reverse-proxy service or a second Worker deployment.

It means the TypeScript API layer between the frontend and PostgreSQL:

```
Frontend
    │
    ▼
Astro server endpoints (src/pages/api/)
    │
    ▼
Neon Postgres (Frankfurt)
```

The frontend never communicates directly with PostgreSQL.

The proxy responsibility is fulfilled by Astro server endpoints deployed via `@astrojs/cloudflare` in `app/`. No additional proxy service is required for v1.

---

# Decision — Implementation Approach

**Frozen (2026-07-09):** implement the v1 API as Astro server endpoints in `src/pages/api/` on Cloudflare Workers.

Rejected alternatives for v1:

| Approach                           | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| Separate Worker or backend service | Duplicates deploy surface and auth for solo operator |
| Neon Data API from client          | Bypasses Worker orchestration; violates ownership   |

---

# REST Server Endpoints — Rationale

## 1. Contract alignment

The frozen v1 API is resource-first REST with explicit HTTP semantics:

- routes under `/api/*`
- `Authorization: Bearer <JWT>` header
- `Idempotency-Key` header on batch writes
- standard `{ ok, data, requestId }` / `{ ok, error, requestId }` envelopes
- domain error codes and HTTP status mapping

Server endpoints provide full control over routes, headers, status codes, and response shape.

## 2. Multi-client scalability

Bearer JWT in the `Authorization` header was selected as the stateless baseline for growth beyond the Astro frontend (mobile clients, integrations, future partner APIs).

REST + middleware is the standard pattern for external consumers.

## 3. Batch write and idempotency

The critical write path (`POST /api/sessions/:sessionId/events/batch`) requires:

- `Idempotency-Key` header inspection
- normalized payload hash comparison
- single database transaction
- `409` on key reuse with different payload

These are HTTP-native concerns. The backing schema (`0012_session_write_idempotency.sql`) is explicitly tied to this REST endpoint.

## 4. View-backed reads

Read endpoints map cleanly to `GET` handlers returning JSON from `v_*` views.

## 5. Testability

REST endpoints are testable with standard HTTP tooling (`curl`, `wrangler dev`, integration tests).

---

# Recommended Request Flow

```
Client (fetch / Alpine)
        │  Bearer JWT, Idempotency-Key, standard HTTP
        ▼
src/middleware.ts
  • assign requestId → locals.requestId
  • classify route (public / protected / authenticated-unprovisioned)
  • verify JWT (sub, exp); resolve playerId per class → locals.auth
        ▼
src/pages/api/**  (thin controllers)
  • parse and validate input (Zod)
  • call service layer
  • map to ok/error envelope
        ▼
src/services/**  (orchestration, transactions, UUIDv7)
        ▼
src/repositories/**  (SQL against views and runtime tables)
        ▼
@neondatabase/serverless → Neon Postgres (Frankfurt)
```

This follows Pattern 6 (Controller → Service → Repository) and Pattern 8 (API Contract Boundary).

See `02-Middleware-And-Layering.md` for middleware responsibilities and folder structure.

Route classification and the exact per-class middleware behavior are owned by `02-Middleware-And-Layering.md`; this diagram is a summary and defers to it. <!-- 2026-07-13 -->

---

# Cloudflare Workers And Neon Constraints

Cloudflare Workers are fully isolated and stateless per request. No persistent TCP connection pool is available across requests.

## Driver selection

| Driver                               | Workers suitability                     | Use in this application                 |
| ------------------------------------ | --------------------------------------- | --------------------------------------- |
| `pg` / node-postgres pool            | Poor — no reusable pool across requests | Avoid                                   |
| `@neondatabase/serverless` HTTP      | Good — simple reads                     | `GET` endpoints                         |
| `@neondatabase/serverless` WebSocket | Good — transactions                     | batch writes, multi-table orchestration |

For `POST /api/sessions/:sessionId/events/batch` (single transaction + idempotency check), use WebSocket transactions via the serverless driver. Simple view reads may use HTTP queries.

## Latency profile

Frankfurt Neon + Cloudflare European edge minimizes database round-trip latency. This was the rationale for selecting Cloudflare over US-based hosting.

Operational considerations:

- **Neon cold start** (scale-to-zero): first query after idle adds latency; acceptable for batch upload at session boundary, not for per-keystroke API calls (architecture avoids this via client-side temporary state)
- **HTTP vs WebSocket overhead**: use WebSocket only when `BEGIN` / `COMMIT` is required

## Security model (v1)

Per `00-Overview.md`:

- Worker-to-database: trusted Worker service-role only
- `DATABASE_URL_UNPOOLED` in Worker secrets only — never exposed to client
- player scoping enforced in application layer on every query
- PostgreSQL RLS deferred post-v1 as defense-in-depth

## Rejected approaches (v1)

| Option                    | Reason                                          |
| ------------------------- | ----------------------------------------------- |
| Neon Data API from client | bypasses Worker orchestration, breaks contract  |
| Per-dart API calls        | frozen write model is batch at session boundary |
| Separate proxy service    | unnecessary deploy surface for v1               |

---

# Scalability Path

| Phase   | Change                                                                             |
| ------- | ---------------------------------------------------------------------------------- |
| v1      | Astro API routes + middleware + services + Neon serverless                         |
| v1.1    | caching headers on read endpoints; optional CF KV for rate limiting                |
| v2      | extract `lib/` to shared package if mobile client arrives; REST contract unchanged |
| post-v1 | PostgreSQL RLS as defense-in-depth; read replicas for heavy analytics              |
| future  | separate Worker only if API traffic dwarfs SSR — same code, different entry        |

The repository and service layer enables future extraction. The routing mechanism (REST endpoints) does not block scale-out.

---

# Related Documents

| Document                         | Purpose                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `00-Overview.md`                 | Frozen v1 API contract (routes, auth, envelopes)                 |
| `02-Middleware-And-Layering.md`  | Middleware responsibilities, folder structure, `locals` contract |
| `03-Shared-Conventions.md`       | Envelope, headers, pagination, error registry, alias/barrel conventions <!-- 2026-07-13 --> |
| `04-Endpoint-Contracts.md`       | Per-domain request/response contracts <!-- 2026-07-13 --> |
| `../07-Frontend/00-Overview.md`  | Frontend API client integration pattern                          |
| `../04-Architecture-patterns.md` | Pattern 6 (Repository), Pattern 8 (API Contract)                 |
| `../02-System-Architecture.md`   | Layer ownership and data flow                                    |
