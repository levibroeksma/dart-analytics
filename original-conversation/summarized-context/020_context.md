# Context Summary — Continuation (API Design Kickoff)

**Handoff note:** Database architecture/doc sync is complete through migrations `0001`–`0011`, seeds `0001`–`0002`, and `05-Database/06-Database-Specification.md` (v2.1.0). `05-Database/10-Database-Agent-Guide.md` and root `AGENT.md` were added. Conversation has now moved into API architecture design.

---

## What Was Decided In This Window

### Deployment/runtime

- Application is built in `app/`.
- Astro Cloudflare adapter is already configured in `app/astro.config.mjs`.
- Deployment target is **Cloudflare Workers**.
- Reason: keep compute geographically close to Neon PostgreSQL in AWS Frankfurt to reduce latency.

### API hosting model

- API will run as Astro server endpoints within the same `app/` deployment (not a separate Node service).
- Database access should use `@neondatabase/serverless` (Workers-compatible; no traditional TCP pooling).

### API route surface
- **Selected:** REST resources by domain (sessions/routines/statistics).
- Sessions write path uses a single batch endpoint: `POST /api/sessions/:sessionId/events:batch` (atomic write transaction).

### Authentication transport decision (A vs B)

- **Selected:** **A — Bearer JWT in `Authorization` header**.
- Why this was chosen over cookie-first:
  - Stateless and horizontally scalable across Workers regions/instances.
  - Works cleanly for future multi-client expansion (web + mobile + third-party clients).
  - Avoids cookie/session affinity coupling and simplifies API gateway/front-door patterns.
- Practical implementation note:
  - Extract/verify JWT in Astro middleware once per request.
  - Pass resolved identity (`auth_user_id`, `player_id`) via `locals` to route handlers.

### Identifier ownership
- **Selected:** API/Cloudflare Worker generates UUIDv7 for runtime entities (session/stage/turn/dart and related runtime rows).
- Client/UI sends gameplay-derived content only (no persistence UUIDs); idempotency is handled via `Idempotency-Key` + server-side stored batch result.

### Write-path contract (high level)
- `POST /api/sessions/:sessionId/events:batch`
  - Payload contains gameplay ordering + dart intention/result data (no persistence UUIDs).
  - Worker derives/creates runtime UUIDv7s and persists in one DB transaction.
  - Idempotency: `Idempotency-Key` + normalized payload hash per `session_id` (same key+payload replays result; key reuse with different payload = 409).

### Read-path contract (high level)
- API reads are view-based (`v_*`) and player-scoped via middleware-resolved identity.
- Endpoint mapping approved:
  - `GET /api/sessions/active` -> `v_active_sessions`
  - `GET /api/sessions?limit=&cursor=` -> `v_session_overview`
  - `GET /api/sessions/:sessionId/replay` -> `v_game_replay`
  - `GET /api/sessions/:sessionId/darts` -> `v_dart_analytics`
  - `GET /api/routines/:routineId/execution` -> `v_routine_execution`
- Policy:
  - replay/analytics endpoints remain close to 1:1 view contracts.
  - active/history endpoints may be wrapped for pagination/stable response fields.

### Error model (high level)
- Standard envelope:
  - success: `{ ok: true, data, requestId }`
  - error: `{ ok: false, requestId, error: { code, message, retryable, details } }`
- Initial domain codes approved:
  - `UNAUTHORIZED`, `PLAYER_NOT_PROVISIONED`, `SESSION_ALREADY_COMPLETED`, `SESSION_OWNERSHIP_MISMATCH`
  - `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`
  - `BATCH_INCONSISTENT_ORDERING`, `BATCH_REFERENCE_MISSING`, `INTERNAL_ERROR`
- Retry semantics:
  - `503`/`504` with `retryable: true` are retry-safe when idempotency key is supplied.
  - `4xx` validation/auth and idempotency-mismatch `409` are non-retryable.

---

## Current State Of Architecture Artifacts

- `architecture/docs/architecture/05-Database/00`–`10`: complete.
- `06-Database-Specification.md`: canonical DB reference.
- `06-API/00-Overview.md`: still effectively empty/not designed yet.
- API endpoint strategy is now the active design stream.

---

## Immediate Next Design Questions (for next window)

1. Worker-to-database security model:
   - trusted backend service role only vs adding PostgreSQL RLS as defense-in-depth.
2. Token verification implementation details:
   - exact Neon JWT verification path in Workers and claim mapping contract.
3. Statistics endpoint shaping:
   - whether to expose dedicated `/api/statistics/*` aggregates now or defer until first frontend integration pass.

---

## Skills To Use In The Next Context Window (order)

1. **`using-superpowers`** (always first in new conversation).
2. **`brainstorming`** (required: continue collaborative design, one question at a time, get approval per section).
3. After design approval + documentation update: **`writing-plans`** (implementation plan only; no coding yet).
4. During implementation later: **`verification-before-completion`** before claiming completion.

If API bugs appear while implementing, invoke **`systematic-debugging`** before proposing fixes.

---

## Suggested First Prompt In Next Window

Use this to resume immediately:

> Continue API architecture design for the Cloudflare Workers deployment in `app/`. We already selected Bearer JWT auth as the scalable baseline. Use brainstorming flow, ask one question at a time, and design endpoint contracts, auth middleware flow, and batch write/read interfaces aligned with `06-Database-Specification.md`.

