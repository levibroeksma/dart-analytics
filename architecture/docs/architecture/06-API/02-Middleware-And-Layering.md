<!--
status: canonical
scope: api/middleware-layering
read-when: middleware or folder-layering changes
updated: 2026-07-11
-->

# API Middleware And Layering

> **Version:** 0.1.0
>
> This document defines middleware responsibilities, the `locals` auth contract, and the recommended `app/` folder structure for the Worker API layer.
>
> HTTP contract details remain in `00-Overview.md`. Implementation approach selection is in `01-Implementation-Strategy.md`.

---

# Purpose

Middleware is the single entry point for cross-cutting API concerns on every request.

Handlers must remain thin. Business logic belongs in the service layer. Database access belongs in repositories.

This document specifies what each layer owns so responsibilities do not overlap.

---

# Middleware Responsibilities

Per `00-Overview.md`, middleware verifies identity once per request and sets `locals.auth`. Handlers never parse JWT directly.

## Owned by middleware

| Concern                                     | Middleware             | Handler / Service       |
| ------------------------------------------- | ---------------------- | ----------------------- |
| JWT signature verification                  | Yes                    | Never                   |
| Required claims (`sub`, `exp`)              | Yes                    | Never                   |
| `requestId` generation                      | Yes                    | Use from `locals`       |
| Player lookup (`auth_user_id` → `playerId`) | Yes (per request)      | Never re-verify JWT     |
| Route classification (public vs protected)  | Yes                    | —                       |
| Session ownership                           | No                     | Service layer           |
| Business validation                         | No                     | Service layer           |
| Idempotency logic                           | No                     | Write handler + service |
| Response envelope formatting                | Optional shared helper | Controller applies      |
| UUIDv7 generation                           | No                     | Service layer           |
| Database transactions                       | No                     | Service layer           |

## Auth responsibility split

| Layer         | Responsibility                                            |
| ------------- | --------------------------------------------------------- |
| Neon Auth     | login, token issuance, token refresh (external to API)    |
| Middleware    | verify JWT, map `sub` to `authUserId`, resolve `playerId` |
| Service layer | domain authorization (`SESSION_OWNERSHIP_MISMATCH`, etc.) |

## `locals.auth` contract

Middleware must set `locals.auth` on protected routes:

```typescript
{
  authUserId: string; // from JWT sub
  playerId: string; // resolved from players.auth_user_id
  // minimal additional claims as needed by handlers
}
```

Extend `App.Locals` in `env.d.ts` to type `auth` and `requestId`.

## Failure mapping

| Condition                                                             | HTTP | Code                         |
| --------------------------------------------------------------------- | ---- | ---------------------------- |
| Missing, malformed, invalid, or expired token; missing `sub` or `exp` | 401  | `UNAUTHORIZED`               |
| Valid token but no matching player                                    | 403  | `PLAYER_NOT_PROVISIONED`     |
| Valid identity but domain ownership fails                             | 403  | `SESSION_OWNERSHIP_MISMATCH` |

Middleware handles the first two. Services handle domain ownership failures.

---

# Layer Architecture

```
src/middleware.ts
        ▼
src/pages/api/**          Controller — HTTP parsing, envelope mapping
        ▼
src/lib/services/**       Service — orchestration, transactions, validation, UUIDv7
        ▼
src/lib/repositories/**   Repository — SQL queries
        ▼
Neon Postgres
```

## Controller (`src/pages/api/`)

Handles:

- HTTP method routing
- request body and query parsing
- input schema validation (Zod)
- calling the appropriate service method
- mapping service results to the standard envelope

Does not handle:

- JWT parsing
- raw SQL
- multi-step transaction orchestration

## Service (`src/lib/services/`)

Handles:

- business workflows
- domain authorization
- transaction boundaries
- UUIDv7 generation for runtime entities
- idempotency check and store for batch writes
- ruleset-owned limit validation

Does not handle:

- HTTP status code selection (controller maps domain errors)
- direct JWT verification

## Repository (`src/lib/repositories/`)

Handles:

- parameterized SQL against runtime tables and `v_*` views
- player-scoped query filters

Does not handle:

- business rules
- transaction orchestration across multiple write domains

---

# Recommended Folder Structure

```
app/src/
├── middleware.ts
├── env.d.ts                         # App.Locals { auth, requestId }
├── pages/api/
│   ├── sessions/
│   │   ├── index.ts                 # POST, GET (list)
│   │   ├── active.ts                # GET
│   │   └── [sessionId]/
│   │       ├── index.ts             # GET, PATCH
│   │       ├── events/
│   │       │   └── batch.ts         # POST (maps to events:batch contract)
│   │       ├── replay.ts
│   │       └── darts.ts
│   ├── routines/
│   │   ├── index.ts
│   │   └── [routineId]/
│   │       ├── index.ts
│   │       └── execution.ts
│   └── statistics/
│       └── overview.ts
└── lib/
    ├── api/
    │   ├── envelope.ts              # ok/error response helpers
    │   └── errors.ts                # domain error codes and HTTP mapping
    ├── auth/
    │   ├── verify-jwt.ts
    │   └── resolve-player.ts
    ├── db/
    │   └── client.ts                # neon client factory (http vs transaction)
    ├── services/
    │   ├── session.service.ts
    │   └── ...
    └── repositories/
        ├── session.repository.ts
        └── ...
```

## Route file mapping note

Astro file-based routing may use `events/batch.ts` instead of a literal `events:batch` path segment. The logical contract remains `POST /api/sessions/:sessionId/events:batch` per `00-Overview.md`. Document any file-to-route mapping in implementation; do not change the public contract.

---

# Shared Library Modules

## `lib/api/envelope.ts`

Standardizes success and error response shape per `00-Overview.md`:

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
```

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

## `lib/api/errors.ts`

Maps domain error codes to HTTP status codes. Controllers use this; services throw or return typed domain errors.

## `lib/db/client.ts`

Factory for `@neondatabase/serverless`:

- HTTP client for simple reads
- WebSocket transaction client for batch writes and multi-table orchestration

Do not expose the raw client to controllers or repositories outside the established factory pattern.

---

# Middleware Flow (Conceptual)

```
Request arrives
    │
    ├─ assign requestId → locals.requestId
    │
    ├─ public route? → next()
    │
    ├─ extract Bearer token
    │   └─ missing/invalid → 401 UNAUTHORIZED
    │
    ├─ verify JWT (sub, exp)
    │   └─ failed → 401 UNAUTHORIZED
    │
    ├─ resolve player from auth_user_id
    │   └─ not found → 403 PLAYER_NOT_PROVISIONED
    │
    ├─ set locals.auth
    │
    └─ next() → route handler
```

---

# Rules

1. Handlers never parse JWT directly.
2. One business operation = one service method.
3. Repositories never contain business logic.
4. Controllers never open database transactions.
5. All protected queries must be player-scoped using `locals.auth.playerId`.
6. Batch writes must run inside a single service-level transaction.
7. Idempotency is enforced in the service layer, not middleware.

---

# Related Documents

| Document                         | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `00-Overview.md`                 | Frozen auth flow, error envelope, route surface         |
| `01-Implementation-Strategy.md`  | REST vs Actions decision, Cloudflare + Neon constraints |
| `../07-Frontend/00-Overview.md`  | How the frontend calls the API                          |
| `../04-Architecture-patterns.md` | Pattern 6 (Repository Pattern)                          |
