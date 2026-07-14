<!--
status: canonical
scope: api/middleware-layering
read-when: middleware or folder-layering changes
updated: 2026-07-13
-->

# API Middleware And Layering

> **Version:** 1.1.0 (layout reconciliation 2026-07-13)
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
| Route classification (public / protected / provision-exempt) | Yes    | —                       |
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

## Route classes

Middleware classifies every request into exactly one class:

| Class | JWT verified | Player resolved | Members |
| ----- | ------------ | --------------- | ------- |
| Public | No | No | unauthenticated routes (if any) |
| Protected | Yes | Yes — missing player → `403 PLAYER_NOT_PROVISIONED` | all domain routes (sessions, routines) |
| Authenticated-unprovisioned | Yes | Skipped | `POST /api/players/provision` only |

The **authenticated-unprovisioned** class exists because `POST /api/players/provision` must be reachable by a JWT-valid user who has no `players` row yet — precisely the state it resolves. For this class, middleware verifies the JWT and sets `locals.auth.authUserId` from `sub`, but does **not** run player resolution and never returns `PLAYER_NOT_PROVISIONED`. The handler creates or returns the player row. <!-- 2026-07-12 -->

## `locals.auth` contract

Middleware must set `locals.auth` on protected routes:

```typescript
{
  authUserId: string; // from JWT sub
  playerId: string; // resolved from players.auth_user_id
  // minimal additional claims as needed by handlers
}
```

On the authenticated-unprovisioned route (`POST /api/players/provision`), `locals.auth` carries `authUserId` only; `playerId` is absent because the player row may not exist yet. <!-- 2026-07-12 -->

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
src/services/**       Service — orchestration, transactions, validation, UUIDv7
        ▼
src/repositories/**   Repository — SQL queries
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

## Service (`src/services/`)

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

## Repository (`src/repositories/`)

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
│   │   ├── types.ts                 # domain contract barrel (@routes/... via alias)
│   │   └── [sessionId]/
│   │       ├── index.ts             # GET, PATCH
│   │       ├── events/
│   │       │   └── batch.ts         # POST /api/sessions/:sessionId/events/batch
│   │       ├── replay.ts
│   │       └── darts.ts
│   ├── routines/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── [routineId]/
│   │       ├── index.ts
│   │       └── execution.ts
│   └── players/
│       └── provision.ts             # POST (authenticated-unprovisioned route)
├── lib/
│   ├── server/                      # server-side response helpers (ok/error, registry mapping)
│   │   ├── envelope.ts              # ok/error response helpers
│   │   └── errors.ts                # domain error codes and HTTP mapping (registry in 03)
│   └── auth/
│       ├── verify-jwt.ts
│       └── resolve-player.ts
├── db/
│   └── client.ts                    # neon client factory (http vs transaction)
├── services/
│   ├── session.service.ts
│   ├── types.ts                     # raised service contract types (@services/types)
│   └── ...
└── repositories/
    ├── session.repository.ts
    ├── types.ts
    └── ...
```

## Route file mapping note

The public batch route is `POST /api/sessions/:sessionId/events/batch` (amended 2026-07-13 from the earlier `events:batch` custom-method spelling), served natively by the `events/batch.ts` route file. No rewrite machinery exists or is permitted.

## Statistics (deferred)

No `statistics/` route folder exists in v1. Statistics endpoints
(`overview`, `trends`, `checkouts`) are deferred post-v1 and must each be
view-backed when built (see `00-Overview.md` and D63). <!-- 2026-07-13 -->

---

# Shared Library Modules

## `lib/server/envelope.ts`

`lib/api/` is reserved for the browser-facing API client (see `../07-Frontend/00-Overview.md`, D41); browser and Worker code never share a folder. <!-- 2026-07-13 -->

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

## `lib/server/errors.ts`

Maps domain error codes to HTTP status codes. Controllers use this; services throw or return typed domain errors.

## `lib/db/client.ts`

Factory for `@neondatabase/serverless`:

- HTTP client for simple reads
- WebSocket transaction client for batch writes and multi-table orchestration

Do not expose the raw client to controllers or repositories outside the established factory pattern.

## Path aliases & type barrels

Import conventions are owned by `03-Shared-Conventions.md`: `@`-prefixed
aliases and `@<area>/types` type-raising barrels. The target alias set is
`@services`, `@repositories`, `@routes`, `@lib`, `@db`. This alias set and the
per-area `types.ts` barrels are the documented target for the frontend/API
implementation phase; `app/tsconfig.json` currently defines only a subset
(`@lib`, `@components`, …) and is extended when the endpoints are built.
<!-- 2026-07-13 -->

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
    ├─ provision-exempt route? → set locals.auth (authUserId only) → next()
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
| `03-Shared-Conventions.md`       | Envelope builders, header contract, pagination, error registry, alias/barrel conventions <!-- 2026-07-13 --> |
| `04-Endpoint-Contracts.md`       | Per-domain request/response contracts <!-- 2026-07-13 --> |
| `../07-Frontend/00-Overview.md`  | How the frontend calls the API                          |
| `../04-Architecture-patterns.md` | Pattern 6 (Repository Pattern)                          |
