<!--
status: canonical
scope: api/endpoint-contracts
read-when: adding or changing endpoint contracts
updated: 2026-07-11
-->

# API Endpoint Contracts

> **Version:** 0.1.0 (draft)
>
> Per-domain request/response contracts for the v1 API surface.
> Subordinate to the frozen contract in `00-Overview.md`. Shared conventions (envelope, headers,
> pagination, types, error registry) are defined in `03-Shared-Conventions.md` and are not repeated here.
> All schemas are design-level Zod sketches — not implementation.

---

## Purpose

Define the concrete request and response shape of every v1 endpoint. The transport is
engine-agnostic: the same runtime payload serves 501, TUOD, Singles, and Score Training.
Reference values travel as `implementation_key`s; the client sends no persistence UUIDs
(the Worker generates UUIDv7).

---

## Write Path — `POST /api/sessions/:sessionId/events:batch`

The engine-agnostic batch write payload is the centerpiece of this contract. It carries ordered gameplay across three nested levels: stages (e.g., legs, rounds), turns (a participant's action in a stage), and darts (individual dart observations). The shape is invariant across all game types; the ruleset decides which levels are required and which fields are populated.

**Recursive tree structure:**

- **Stage:** A logical grouping of turns (e.g., a leg in 501, a round in Score training). Nests turns and optionally child stages (`parentClientKey` for tree structure).
- **Turn:** A participant's action within a stage (e.g., one player's three darts in 501). Contains dart facts (empty array in recreational mode).
- **Dart:** One observed throw result (hit zone, score). Idempotency is handled by `clientKey` at each level for client-side deduplication.

**Rules:**

- Recreational mode: `darts: []` (score observed only).
- Analytics mode: Full dart observations (intended + hit zone, coordinates mapped to server zones).
- Ruleset determines which is required; validation happens in service layer.
- Idempotency via `Idempotency-Key` header + normalized payload hash (matches frozen contract in `00-Overview.md`).
- Single transaction: all stages, turns, darts created atomically.
- Completed session → `409 SESSION_ALREADY_COMPLETED` (from error registry in `03-Shared-Conventions.md`).
- Referential failures (`clientKey` lookup, `parentClientKey` tree breaks) → `BATCH_INCONSISTENT_ORDERING` or `BATCH_REFERENCE_MISSING`.
- Success returns standard envelope (via `ok()` builder from `03`) with created-row summary (counts + server UUIDs).

```typescript
// design sketch — reference values are implementation_key strings; no persistence UUIDs
const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string(),               // dart_zones.implementation_key
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),                    // dart_zones.implementation_key
  score: z.number().int(),
});
const TurnFact = z.object({
  clientKey: z.string(),                     // client-side ordering/dedup key
  participantRef: z.string(),                // participant reference within the session
  sequence: z.number().int(),
  totalScore: z.number().int(),
  completedAt: z.string().datetime().nullable(),
  darts: z.array(DartFact),                  // [] in recreational mode
});
const StageFact = z.object({
  clientKey: z.string(),
  stageTypeKey: z.string(),                  // stage_types.implementation_key
  parentClientKey: z.string().nullable(),    // tree nesting
  sequence: z.number().int(),
  turns: z.array(TurnFact),
});
const EventsBatchRequest = z.object({ stages: z.array(StageFact) });
type EventsBatchRequest = z.infer<typeof EventsBatchRequest>;
```

---

## Session Creation — `POST /api/sessions`

Sessions are created with a ruleset and a configuration source. The configuration may come from a registered template (template-based game) or be fully inline (ad-hoc setup). In both cases, the server validates and materializes a snapshot; templates are never referenced at runtime.

**Discriminated config input:**

- `source: "template"`: resolve the template by `templateRef` (implementation_key), apply optional `overrides`, and validate merged config against ruleset.
- `source: "inline"`: config provided directly; validate immediately against ruleset.

**Outcomes:**

- Server creates activity / exercise session / config snapshot row / participant references.
- Config is **always** copied (materialized as an `exercise_configurations` snapshot), never referenced.
- Returns server-generated `sessionId` (UUIDv7), enclosed in standard `ok()` envelope.
- Template resolution or config validation failure → error using an appropriate code from the error-code registry in `03-Shared-Conventions.md` (do not introduce ad-hoc codes here).

```typescript
// discriminated config input — template-based OR ad-hoc inline; server snapshots + validates in every case
const ConfigInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), templateRef: z.string(), overrides: z.record(z.unknown()).optional() }),
  z.object({ source: z.literal("inline"),   config: z.record(z.unknown()) }),
]);
const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),                   // game_types.implementation_key
  rulesetVersionKey: z.string(),             // ruleset_versions.implementation_key
  config: ConfigInput,
});
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

const CreateSessionResponse = z.object({
  sessionId: z.string(),                     // server-generated UUIDv7
});
type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;
```

The server generates the session (and its activity, configuration snapshot, and participants) and returns `sessionId` in the `ok()` envelope.

---

## Session Lifecycle — `PATCH /api/sessions/:sessionId`

Updates a session's status during its lifecycle — primarily the transition to completion. Consistent with the immutability principle (sessions are mutable during active play, immutable once `COMPLETED`), a session already in a terminal status rejects further updates with `409 SESSION_ALREADY_COMPLETED` (from the error-code registry in `03-Shared-Conventions.md`).

```typescript
// design sketch — status transition is validated server-side against the game_statuses lifecycle
const UpdateSessionRequest = z.object({
  status: z.string(),                        // game_statuses.implementation_key (e.g. "completed")
  completedAt: z.string().datetime().optional(),
});
type UpdateSessionRequest = z.infer<typeof UpdateSessionRequest>;
```

- The server validates the requested transition against the `game_statuses` lifecycle; invalid transitions are rejected using a registered error code from `03-Shared-Conventions.md`.
- Ownership is enforced (`403 SESSION_OWNERSHIP_MISMATCH`) before any mutation.
- Success returns the standard envelope (via `ok()` from `03`) with the updated session summary.

---

## Player Provisioning — `POST /api/players/provision`

On first login, a JWT-valid user has no row in `players` table. This endpoint closes the `PLAYER_NOT_PROVISIONED` gap: it creates a player row from `auth_user_id` (extracted from JWT `sub`).

**Idempotent behavior:**

- No player found → create new row, return `created: true`.
- Player already exists → return existing record, `created: false`.

**Response:**

```typescript
const ProvisionPlayerResponse = z.object({
  playerId: z.string(),                      // UUIDv7
  authUserId: z.string(),
  created: z.boolean(),                      // false when already provisioned
});
type ProvisionPlayerResponse = z.infer<typeof ProvisionPlayerResponse>;
```

**Note:** This endpoint must be routed in `00-Overview.md` and is required before (or alongside) initial session creation. Middleware prevents non-provisioned users from reaching protected endpoints.

---

## Read Contracts

All read endpoints are view-backed and player-scoped. Thin response contracts stay close to 1:1 view structure; list endpoints wrap view output in the standard `ListResult<T>` shape defined in `03-Shared-Conventions.md`.

| Endpoint | View | Shape | Date |
| -------- | ---- | ----- | ---- |
| `GET /api/sessions/active` | `v_active_sessions` | object or null | 2026-07-10 |
| `GET /api/sessions?limit=&cursor=` | `v_session_overview` | `ListResult<SessionOverview>` | 2026-07-10 |
| `GET /api/sessions/:sessionId` | `v_session_overview` | object (1:1 view) | 2026-07-10 |
| `GET /api/sessions/:sessionId/replay` | `v_game_replay` | object (1:1 view) | 2026-07-10 |
| `GET /api/sessions/:sessionId/darts` | `v_dart_analytics` | array (1:1 view) | 2026-07-10 |
| `GET /api/routines` | `v_routine_execution` | `ListResult<RoutineSummary>` | 2026-07-10 |
| `GET /api/routines/:routineId` | `v_routine_execution` | object (1:1 view) | 2026-07-10 |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` | object (1:1 view) | 2026-07-10 |
| `GET /api/statistics/overview` | overview aggregation | object | 2026-07-10 |

`v_routine_execution` backs both the routine list and the single-routine execution detail; the list projects summary columns and the detail returns the full execution definition.

**Pagination:** List endpoints support cursor-based pagination (`?limit=&cursor=`) and return `{ items: T[], nextCursor: string | null }`. Cursor is opaque, server-owned, and base64url-encoded.

**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.

---

## Extensibility — Ruleset Validator Registry

The v1 API transport contract (envelope, headers, pagination) and write-path shape (`EventsBatchRequest`) are engine-agnostic and stable by design. New game types and rulesets do **not** modify this document or any endpoint signature.

**Extensibility pattern:**

1. Define a new `ruleset_version` and `game_type` in lookup tables (`ruleset_versions`, `game_types`).
2. Author a **ruleset validator** (a Zod schema or equivalent validation function) that enforces game-specific rules (e.g., scoring bounds, turn structure, required/optional fields).
3. Register the validator in a runtime registry (e.g., a `Map<rulesetVersionKey, ValidatorFunction>`).
4. At session creation time, service layer resolves the ruleset, invokes its validator on the `ConfigInput`, and rejects invalid config with domain-specific error details.

**Result:** The API surface, shared code, middleware, and transport remain stable. Game logic is contained in ruleset-specific validation and in the game engine (client-side). This enables:

- New game types without API changes.
- Simultaneous support for multiple rulesets and game engines.
- Ruleset-specific error details without cluttering the shared error registry.

---

## Related Documents

| Document | Purpose | Date |
| -------- | ------- | ---- |
| `00-Overview.md` | Frozen API baseline contract (routes, auth, error shapes) | 2026-07-10 |
| `01-Implementation-Strategy.md` | REST vs Astro Actions, proxy terminology, Cloudflare + Neon constraints | 2026-07-10 |
| `02-Middleware-And-Layering.md` | Middleware responsibilities, layer ownership, `app/` folder structure | 2026-07-10 |
| `03-Shared-Conventions.md` | Response envelope builders, pagination, types, error-code registry | 2026-07-10 |
| `../05-Database/06-Database-Specification.md` | Domain tables, views, constraints, and relationships | 2026-07-10 |
