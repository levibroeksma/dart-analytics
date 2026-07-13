<!--
status: canonical
scope: api/contract-baseline
read-when: any API work (frozen v1 baseline)
updated: 2026-07-12
-->

# API Overview

> **Version:** 1.2.0 (frozen v1 API baseline; response contracts 2026-07-12)
>
> Canonical API baseline for Cloudflare Workers deployment in `app/`.

---

## Scope

This document defines:

- API runtime and ownership boundaries
- route surface (v1 baseline)
- authentication and identity flow
- write/read contracts
- error envelope and retry semantics

Implementation guidance (middleware, folder structure, REST vs Actions, Cloudflare + Neon) is in `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md`.

This is the source of truth for API contract behavior. Deeper per-domain endpoint docs may be added under `06-API/` in future.

---

## Runtime And Ownership

- Runtime: Astro server endpoints on Cloudflare Workers (`app/`).
- Database access: `@neondatabase/serverless`.
- Authentication provider: Neon Auth.
- Identity verification and domain authorization: Worker middleware + service layer.

Layer ownership:

| Layer      | Owns                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | UX, game engine, temporary state                                                |
| Worker API | Identity verification, validation, orchestration, transactions, UUID generation |
| PostgreSQL | Storage, constraints, historical truth, views                                   |

---

## Route Surface (v1 Baseline)

Resource-first REST by domain.

### Sessions

- `POST /api/sessions`
- `GET /api/sessions/active`
- `GET /api/sessions?limit=&cursor=`
- `GET /api/sessions/:sessionId`
- `PATCH /api/sessions/:sessionId`
- `POST /api/sessions/:sessionId/events:batch`
- `GET /api/sessions/:sessionId/replay`
- `GET /api/sessions/:sessionId/darts`

`POST /api/sessions` requires `captureModeKey` and `inputModeKey` and creates a single `PLAYER` participant; full request/response shape in `04-Endpoint-Contracts.md`. <!-- 2026-07-12 -->

### Routines

- `GET /api/routines`
- `GET /api/routines/:routineId`
- `GET /api/routines/:routineId/execution`

### Statistics

Deferred (post-v1) — no statistics endpoints ship in v1:

- `GET /api/statistics/overview`
- `GET /api/statistics/trends`
- `GET /api/statistics/checkouts`

v1 captures the dart/turn/session facts statistics are derived from; the aggregated read endpoints are added post-v1 and must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`). <!-- 2026-07-12 -->

### Players

- `POST /api/players/provision` <!-- 2026-07-10 -->

Idempotent; creates the `players` row for a JWT-valid user. Full contract in `04-Endpoint-Contracts.md`.

---

## Authentication And Identity Flow

- Protected routes require `Authorization: Bearer <JWT>`.
- Middleware verifies token once per request and sets `locals.auth`.
- Required JWT claims for protected routes:
  - `sub`
  - `exp`
- `locals.auth` must include:
  - `authUserId`
  - `playerId`
  - selected token claims (minimal set needed by handlers)
- `authUserId` is derived from JWT `sub` and mapped to `players.auth_user_id`.
- Handlers never parse JWT directly.
- Token issuance/refresh is external to this API (Neon Auth).

---

## Write Contract

Batch write endpoint:

- `POST /api/sessions/:sessionId/events:batch`

Rules:

- Payload contains gameplay ordering and dart fact data, not persistence UUIDs.
- Worker generates UUIDv7 for created runtime rows.
- Writes are persisted in a single transaction.
- Completed sessions reject writes (`409`).
- Ruleset-owned limits are validated in service layer.

### Idempotency

- Require `Idempotency-Key` on batch write requests.
- Server stores (`session_id`, `idempotency_key`, normalized payload hash, result).
- Backing schema artifact: `architecture/docs/database/migrations/0012_session_write_idempotency.sql`.
- Same key + same hash -> return stored result.
- Same key + different hash -> `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.

---

## Read Contract

Reads are view-backed and player-scoped.

| Endpoint                                 | Source                |
| ---------------------------------------- | --------------------- |
| `GET /api/sessions/active`               | `v_active_sessions`   |
| `GET /api/sessions?limit=&cursor=`       | `v_session_overview`  |
| `GET /api/sessions/:sessionId`           | `v_session_overview`  |
| `GET /api/sessions/:sessionId/replay`    | `v_game_replay`       |
| `GET /api/sessions/:sessionId/darts`     | `v_dart_analytics`    |
| `GET /api/routines`                      | `v_routine_execution` |
| `GET /api/routines/:routineId`           | `v_routine_execution` |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` |

Policy:

- replay/analytics endpoints stay close to 1:1 view contracts
- list/overview endpoints may wrap view output for stable API response shape and pagination
- `GET /api/sessions/:sessionId/darts` is analytics-only: `v_dart_analytics` includes only darts with complete intention data, so it returns an empty array for recreational sessions <!-- 2026-07-12 -->
- `GET /api/routines` projects `v_routine_execution` to one summary row per routine; the routine detail endpoints return the full ordered step set <!-- 2026-07-12 -->

---

## Error Contract

### Success envelope

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
```

### Error envelope

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

### Initial domain codes

- `UNAUTHORIZED`
- `PLAYER_NOT_PROVISIONED`
- `SESSION_ALREADY_COMPLETED`
- `SESSION_OWNERSHIP_MISMATCH`
- `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`
- `BATCH_INCONSISTENT_ORDERING`
- `BATCH_REFERENCE_MISSING`
- `INTERNAL_ERROR`

### Authorization mapping

- `401 UNAUTHORIZED`: missing token, malformed token, invalid signature, expired token, or missing required claims (`sub`, `exp`).
- `403 PLAYER_NOT_PROVISIONED`: token is valid but no matching player can be resolved from `players.auth_user_id`.
- `403 SESSION_OWNERSHIP_MISMATCH`: token is valid but session/domain ownership authorization fails.

### Retry semantics

- Retryable: transient failures (`503`, `504`) with `retryable: true`, when idempotency key is provided.
- Not retryable: validation/auth `4xx` and idempotency mismatch `409`.

---

## Frozen Decisions

- Worker-to-database security model (v1): trusted Worker service-role only.
- PostgreSQL RLS is deferred from v1 and may be introduced later as defense-in-depth.
- JWT middleware verification contract (v1): required claims are `sub` and `exp`.
- Statistics scope (v1): no statistics endpoints; `overview`, `trends`, and `checkouts` are all deferred post-v1 and must be view-backed when built. <!-- 2026-07-12 -->
- Session participants (v1): a session has a single server-derived `PLAYER` participant; guest/DartBot play is deferred post-v1. <!-- 2026-07-12 -->
- Activity grouping (v1): one activity per session, server-managed; multi-session activities and routine-run writes are deferred post-v1. <!-- 2026-07-12 -->
- Response contracts (v1): every endpoint's response DTO is defined in `04-Endpoint-Contracts.md`; `03-Shared-Conventions.md` and `04` are frozen at 1.0.0. `GET /sessions/active`, `/sessions/:id/replay`, and `/sessions/:id/darts` return arrays. <!-- 2026-07-12 -->

---

## Related Documents

Implementation guidance that extends this contract without changing it:

| Document                        | Purpose                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `01-Implementation-Strategy.md` | REST vs Astro Actions, proxy terminology, Cloudflare + Neon constraints (2026-07-09) |
| `02-Middleware-And-Layering.md` | Middleware responsibilities, layer ownership, `app/` folder structure (2026-07-09)   |
| `../07-Frontend/00-Overview.md` | Frontend API client integration and state ownership (2026-07-09)                     |
| `03-Shared-Conventions.md`      | Envelope builders, header contract, pagination, type system, error registry (2026-07-10) |
| `04-Endpoint-Contracts.md`      | Per-domain request/response contracts for the v1 surface (2026-07-10)                     |
