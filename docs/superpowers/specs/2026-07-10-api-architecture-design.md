# API Architecture — Per-Domain Contracts & Shared Conventions (Design)

> **Status:** Design (pre-freeze)
> **Date:** 2026-07-10
> **Branch:** `api-architecture`
> **Phase:** Documentation/design only — no `app/` implementation until this design is frozen.

---

## 1. Purpose

Design the **next stage of the API layer**: detailed per-domain endpoint contracts plus the
reusable, strictly-enforced scaffolding that makes every endpoint behave identically.

The v1 API *contract behaviour* is already frozen in
`architecture/docs/architecture/06-API/00-Overview.md` (routes, Bearer JWT auth flow,
`locals.auth`, success/error envelope, initial error codes, idempotency, view-backed reads).
This design fills the deliberately-deferred gap those docs repeatedly reference:
*"payload shape defined per domain in future `06-API/` endpoint docs."*

### Goals

- **Consistency:** one predictable request/response pattern across all endpoints.
- **Strict agent guardrails:** rules concrete enough that any agent produces uniform,
  testable output.
- **Performance & scalability:** carry the frozen driver/batch/pagination guidance forward.
- **Loose coupling for extensibility:** new game types, rulesets, and engines are added
  over months/years **without editing the transport contract or shared code.**

### Non-goals (this phase)

- No `app/` TypeScript is written. All "types and functions" are expressed as
  **design-level signatures / Zod schema sketches** in the architecture docs.
- No changes outside `architecture/` (plus this spec artifact under `docs/superpowers/specs/`).
- No new migrations, seeds, or view changes.

---

## 2. Deliverables

| File | Status | Purpose |
| ---- | ------ | ------- |
| `architecture/docs/architecture/06-API/03-Shared-Conventions.md` | **New — `0.1.0` (draft)** | The strict, reusable rulebook every endpoint obeys |
| `architecture/docs/architecture/06-API/04-Endpoint-Contracts.md` | **New — `0.1.0` (draft)** | Per-domain request/response contracts for the full v1 surface |
| `architecture/docs/architecture/06-API/00-Overview.md` | **Frozen → dated edit** | Add `POST /api/players/provision` to route surface + related-docs row |

Both new docs are **draft**, not frozen. They are subordinate to the frozen `00-Overview.md`
contract: they *detail* it and must never override it. Any conflict is resolved in favour of
`00-Overview.md`.

Every newly added or changed table row in edited docs carries an ISO date (`2026-07-10`)
per `architecture/` documentation rules.

---

## 3. Key Decisions (approved during brainstorming)

| # | Decision | Rationale |
| - | -------- | --------- |
| D1 | **Fully engine-agnostic transport contract** (rejected discriminated-per-game and hybrid). | Transport never learns game rules. New engines register a ruleset validator and change nothing in the contract or endpoint code. Maximum loose coupling. |
| D2 | **Full v1 surface is in scope; add `POST /api/players/provision`.** | A frozen error code (`PLAYER_NOT_PROVISIONED`) with no endpoint to produce the provisioned state is a latent inconsistency. Reconcile it now. |
| D3 | **Zod schemas are the single source of truth; types are `z.infer<>`.** | Types ≡ validation ≡ runtime behaviour can never drift. One place per contract → predictable, inherently testable. |
| D4 | **`types.ts` barrel files (strict rule).** | Consumers import contract types from one barrel path, not scattered import lines. |
| D5 | **Path aliases via `tsconfig.json` (strict rule).** | No deep relative import chains. |
| D6 | **Session-creation config input is a discriminated union** (`template + overrides` \| `inline`). | Supports preconfigured templates *and* ad-hoc/custom one-off games, and makes session restart easier. Server always materializes + validates the snapshot. |
| D7 | **Two focused docs** (`03-Shared-Conventions`, `04-Endpoint-Contracts`), first versions **draft**. | Separate "rules every endpoint obeys" from "what each endpoint carries" without over-fragmenting. |

---

## 4. `03-Shared-Conventions.md` — the agent guardrails

Design-level contracts (not implementation). Content outline:

### 4.1 Response envelope
- Canonical success / error shapes from `00-Overview.md`.
- Produced **only** through two shared builders (design signatures):
  - `ok(data, requestId) -> SuccessEnvelope<T>`
  - `err(code, opts, requestId) -> ErrorEnvelope`
- Handlers never hand-assemble envelopes.

### 4.2 Header contract
- Single definition of required/standard headers: `Authorization: Bearer <JWT>`,
  `Idempotency-Key` (batch writes only), `Content-Type: application/json`, and a
  `requestId` echo header.
- Design specifies a small header-helper surface for reading/setting these uniformly.

### 4.3 `requestId` propagation
- Assigned in middleware, carried in `locals.requestId`, echoed in every envelope
  and in a response header.

### 4.4 Pagination
- Cursor-based, matching the frozen `?limit=&cursor=`.
- Fixed opaque-cursor format and a standard list data shape: `{ items: T[], nextCursor: string | null }`.
- All list endpoints use this shape.

### 4.5 Validation & types (strict rules)
- **Zod single source of truth**; all contract types are `z.infer<typeof Schema>` — never
  hand-authored in parallel (D3).
- **`types.ts` barrels** re-export contract types per domain; consumers import from the
  barrel (D4).
- **Path aliases** in `tsconfig.json`; no deep relative import chains (D5).

### 4.6 Error-code registry
- Single enumerated registry of domain codes → HTTP status → `retryable` semantics,
  extending the frozen initial set in `00-Overview.md`.
- One source referenced by both controllers (status mapping) and services (throwing/returning).

### 4.7 Extensibility rule
- The transport contract is engine-agnostic. **New game types never edit endpoint
  contracts or shared code.** They register a ruleset config validator (see §6).

---

## 5. `04-Endpoint-Contracts.md` — per-domain contracts

Each endpoint documented as a **design-level Zod schema sketch** for request and response,
plus an envelope example. No implementation code.

### 5.1 Write path — engine-agnostic runtime payload (centerpiece)

`POST /api/sessions/:sessionId/events:batch` carries a generic `stages[] -> turns[] -> darts[]`
tree — identical shape for 501, TUOD, Singles, and Score Training. Reference values travel as
`implementation_key`s; the client sends **no persistence UUIDs** (Worker generates UUIDv7).

Design sketch:

```
stages[]:  { clientKey, stageTypeKey, parentClientKey | null, sequence, turns[] }
turns[]:   { clientKey, participantRef, sequence, totalScore, completedAt | null, darts[] }
darts[]:   { sequence, intendedTargetNumber, intendedZoneKey,
             hitTargetNumber, hitZoneKey, score }
```

- **Recreational mode:** turns with `darts: []` (turn score only).
- **Analytics mode:** full intention+result darts.
- Same contract in both; the ruleset decides which is required.
- Idempotency per frozen rules (`Idempotency-Key` + normalized payload hash), single
  transaction, `409` when the session is already completed.
- `clientKey` / `parentClientKey` express ordering and tree nesting client-side; the server
  maps them to generated UUIDv7 rows. Referential problems map to frozen codes
  (`BATCH_INCONSISTENT_ORDERING`, `BATCH_REFERENCE_MISSING`).

### 5.2 Session creation — `POST /api/sessions`

Discriminated config input (D6):

```
config: { source: "template", templateRef, overrides? }
      | { source: "inline",   config }
```

- Server resolves the source, validates against the ruleset schema, and **materializes the
  configuration snapshot in every case** (config copied, never referenced).
- Creates the activity / exercise session / config snapshot / participants; returns the
  server-generated `sessionId` (and any keys the client needs to continue).

### 5.3 Provisioning — `POST /api/players/provision`

- JWT-valid user with no `players` row → create one from `auth_user_id`.
- **Idempotent:** returns the existing player if already provisioned.
- Closes the `PLAYER_NOT_PROVISIONED` gap (D2). Requires the dated edit to `00-Overview.md`.

### 5.4 Reads — thin, view-backed contracts

Response Zod sketches mapping 1:1 to the frozen view backing:

| Endpoint | View |
| -------- | ---- |
| `GET /api/sessions/active` | `v_active_sessions` |
| `GET /api/sessions?limit=&cursor=` | `v_session_overview` (paginated list shape) |
| `GET /api/sessions/:sessionId/replay` | `v_game_replay` |
| `GET /api/sessions/:sessionId/darts` | `v_dart_analytics` |
| `GET /api/routines`, `GET /api/routines/:routineId/execution` | `v_routine_execution` |
| `GET /api/statistics/overview` | overview aggregation |

- Replay/analytics/darts stay close to 1:1 view contracts.
- List/overview endpoints wrap view output in the standard `{ items, nextCursor }` shape.

---

## 6. Extensibility & testability

### Ruleset config validator registry (design concept)
- Config JSONB is validated per `ruleset_version` by a registered schema resolved at runtime.
- Adding a game type / ruleset = register a validator (+ engine). **The API surface, transport
  contract, and shared code stay frozen.** This is the mechanism that keeps years of new
  engines loosely coupled.

### Testability by construction
- Because every contract is a Zod schema, each contract is exercisable with known-good /
  known-bad fixtures. Uniform, predictable, agent-proof validation.

### Performance & scalability (carried from frozen guidance)
- HTTP driver for reads; WebSocket transaction for the batch write.
- Batch-at-session-boundary — never per-dart calls.
- Cursor pagination on list endpoints.
- Caching headers noted on the scalability path (not built in v1).

---

## 7. Authority & consistency

- Subordinate to `00-Overview.md` (frozen). New docs detail, never override.
- Aligns with `01-Implementation-Strategy.md` (Astro endpoints on Workers, Neon driver split)
  and `02-Middleware-And-Layering.md` (Controller → Service → Repository; middleware owns
  identity; services own transactions/UUIDv7/idempotency).
- Aligns with `07-Frontend/00-Overview.md` (client sends gameplay-derived payloads, no
  persistence UUIDs).
- Respects frozen principles: config copied not referenced; ruleset owns limits; statistics
  derived in views; UUIDv7 app-generated; TIMESTAMPTZ UTC.

---

## 8. Definition of done (for the implementation phase that follows freeze)

1. `03-Shared-Conventions.md` created at `0.1.0 (draft)` covering §4.
2. `04-Endpoint-Contracts.md` created at `0.1.0 (draft)` covering §5.
3. `00-Overview.md` updated: `POST /api/players/provision` added to route surface; related-docs
   table references `03` and `04`; changed rows dated `2026-07-10`.
4. No contradictions with frozen `00`/`01`/`02` or `07-Frontend/00`.
5. No `app/` code, migrations, or seed changes introduced.
