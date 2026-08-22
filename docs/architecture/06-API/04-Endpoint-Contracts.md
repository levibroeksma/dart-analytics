<!--
status: canonical
scope: api/endpoint-contracts
read-when: adding or changing endpoint contracts
updated: 2026-08-22
-->

# API Endpoint Contracts

> **Version:** 1.4.0 (`GET`/`PATCH /api/players/me`, 2026-08-15; prior 1.3.0 — `GET`/`PATCH /api/players/me/settings`, 2026-08-08)
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
in runtime-write payloads (the Worker generates UUIDv7); referencing an entity obtained
from a read endpoint (e.g. `templateRef`) is normal REST addressing. <!-- 2026-07-13 -->

---

## Write Path — `POST /api/sessions/:sessionId/events/batch`

The engine-agnostic batch write payload is the centerpiece of this contract. It carries ordered gameplay across three nested levels: stages (e.g., legs, rounds), turns (a participant's action in a stage), and darts (individual dart observations). The shape is invariant across all game types; the ruleset decides which levels are required and which fields are populated.

**Recursive tree structure:**

- **Stage:** A logical grouping of turns (e.g., a leg in 501, a round in Score training). Nests turns and optionally child stages (`parentClientKey` for tree structure).
- **Turn:** A participant's action within a stage (e.g., one player's three darts in 501). Contains dart facts (empty array in recreational mode).
- **Dart:** One observed throw result (hit zone, score). Idempotency is handled by `clientKey` at each level for client-side deduplication.

**Rules:**

- `RECREATIONAL` + `QUICK_SCORE`: `darts: []` (turn totals only). `RECREATIONAL` + `DETAILED_DARTS`: hit-only dart rows (intention pair null). <!-- 2026-07-13 -->
- `ANALYTICS` capture: intention required on every dart (service-validated). <!-- 2026-07-13 -->
- `clientKey`/`parentClientKey` resolve references within this single payload only; there is no cross-batch reconciliation (local-first recovery model). <!-- 2026-07-13 -->
- Ruleset determines which is required; validation happens in service layer.
- Idempotency via `Idempotency-Key` header + normalized payload hash (matches frozen contract in `00-Overview.md`).
- Single transaction: all stages, turns, darts created atomically.
- Completed session → `409 SESSION_ALREADY_COMPLETED` (from error registry in `03-Shared-Conventions.md`).
- Referential failures (`clientKey` lookup, `parentClientKey` tree breaks) → `BATCH_INCONSISTENT_ORDERING` or `BATCH_REFERENCE_MISSING`.
- `TurnFact.participantRef` must match a participant `ref` returned by `POST /api/sessions`; an unmatched ref → `BATCH_REFERENCE_MISSING`. Refs may vary within one batch when several seats played the session; a solo session has exactly one (the `PLAYER`). <!-- 2026-07-12; multi-seat 2026-08-21 -->
- Success returns the standard envelope (via `ok()` from `03`) with a `BatchWriteResponse` created-row count summary (see Response DTOs below). <!-- 2026-07-12 -->

```typescript
// design sketch — reference values are implementation_key strings; no persistence UUIDs
const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string().nullable(),      // nullable pair with intendedTargetNumber (both null or both set)
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),                      // required on any dart row; MISS covers misses
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

- `source: "template"`: resolve the preset by `templateRef` (the configuration template UUID from `GET /api/configuration-templates`), apply optional `overrides`, and validate merged config against ruleset. <!-- 2026-07-13 -->
- `source: "inline"`: config provided directly; validate immediately against ruleset.

**Outcomes:**

- Server creates activity / exercise session / config snapshot row / participant(s).
- `captureModeKey` and `inputModeKey` are required and stored on the session (self-describing runtime record); both are validated against the ruleset (a ruleset may require `ANALYTICS` / `DETAILED_DARTS`). <!-- 2026-07-12 -->
- **Participants (v1):** the server derives exactly one participant of type `PLAYER` for the authenticated player, `displayName` copied from `players.display_name`, and returns its `ref`. Guest/DartBot participants are deferred post-v1 (added later as an optional `participants[]` input — additive, non-breaking). <!-- 2026-07-12 -->
- **Participants (guests):** the optional `participants[]` input is now implemented as that decision anticipated. Array ORDER is seat order — it decides who throws first in leg 1. Omitting the field reproduces the single-`PLAYER` session above exactly. The `PLAYER` seat's `displayName` is always copied server-side from `players.display_name`; a client-supplied value is ignored, because migration `0005`'s CHECK requires exactly that. The seats are also written into the configuration snapshot under `seats`, in the same transaction as the participant rows. <!-- 2026-08-21 -->
- **Seat rejections** (all `VALIDATION_FAILED`, asserted once in `app/src/services/session-seats.service.ts`, and nothing is written): fewer than 1 or more than 4 seats; not exactly one `PLAYER`; a `GUEST` with a blank name; two seats sharing one `sideKey` (2v2 is not implemented); more seats than the requested ruleset's own cap — see `SEAT_CAPS` below. Duplicate guest display names are deliberately allowed — seats are identified by ref, not name. <!-- 2026-08-21; seat cap generalized from a single 501_V1 special case to SEAT_CAPS 2026-08-22 -->
- **`SEAT_CAPS`** (`app/src/services/session-seats.service.ts`) — the most seats a session may request, keyed by `rulesetVersionKey`. A ruleset with no entry defaults to a cap of **1** (any 2nd seat rejected). `501_V1` alone keeps room for a future 2v2; the other seven rulesets each support exactly one opponent (1v1) per `2026-08-22-single-opponent-seat-remaining-engines-design.md`:

  | Ruleset version key   | Seat cap |
  | ---------------------- | -------- |
  | `501_V1`                | 4        |
  | `BOBS27_V1`              | 2        |
  | `121_V1`                 | 2        |
  | `AROUND_THE_CLOCK_V1`    | 2        |
  | `TUOD_V1`                | 2        |
  | `SHANGHAI_V1`            | 2        |
  | `SCORE_TRAINING_V1`      | 2        |
  | `SINGLES_V1`             | 2        |
  | `DOUBLES_TRAINING_V1`    | 2        |
  | *(any other ruleset)*   | 1 (default — reject) |

  <!-- 2026-08-22 -->
- The events batch endpoint is unchanged: a turn's `participantRef` may now vary within one batch, which `validateBatchReferences` already allowed. <!-- 2026-08-21 -->
- **Activity (v1):** the session's activity is created and managed server-side, one activity per session; multi-session activities and routine-run writes are deferred post-v1. <!-- 2026-07-12 -->
- Config is **always** copied (materialized as an `exercise_configurations` snapshot), never referenced.
- Returns server-generated `sessionId` (UUIDv7) and participant ref(s), enclosed in standard `ok()` envelope.
- Template resolution or config validation failure → error using an appropriate code from the error-code registry in `03-Shared-Conventions.md` (do not introduce ad-hoc codes here).
- An existing ACTIVE session for the same game type → `409 SESSION_ALREADY_ACTIVE`, with `error.details = { sessionId, startedAt }` (the existing session). Service-enforced by a pre-check plus a race-safe `uq_sessions_single_active` catch (D132). <!-- 2026-07-22 -->

```typescript
// discriminated config input — template-based OR ad-hoc inline; server snapshots + validates in every case
const ConfigInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), templateRef: z.string() /* configuration template UUID from GET /api/configuration-templates */, overrides: z.record(z.unknown()).optional() }),
  z.object({ source: z.literal("inline"),   config: z.record(z.unknown()) }),
]);
const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),                   // game_types.implementation_key
  rulesetVersionKey: z.string(),             // ruleset_versions.implementation_key
  captureModeKey: z.string(),                // capture_modes.implementation_key (RECREATIONAL | ANALYTICS)
  inputModeKey: z.string(),                  // input_modes.implementation_key (QUICK_SCORE | DETAILED_DARTS)
  config: ConfigInput,
  participants: z.array(ParticipantInput).optional(),  // array order IS seat order; omitted = one PLAYER seat
});
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

// one requested seat; displayName is required for a GUEST and ignored for the
// PLAYER, whose name is copied server-side from players.display_name
const ParticipantInput = z.object({
  participantTypeKey: z.enum(["PLAYER", "GUEST"]),
  displayName: z.string().optional(),
  sideKey: z.string().min(1),                // groups seats; v1 writes one seat per side
});

// the response returns every minted participant's ref, in seat order, so the
// client can populate TurnFact.participantRef on the batch write.
const ParticipantRef = z.object({
  ref: z.string(),                           // referenced by TurnFact.participantRef
  participantTypeKey: z.string(),            // participant_types.implementation_key (PLAYER | GUEST)
  displayName: z.string(),                   // PLAYER: copied from players.display_name
});
const CreateSessionResponse = z.object({
  sessionId: z.string(),                     // server-generated UUIDv7
  participants: z.array(ParticipantRef),     // one per seat, in seat order
});
type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;
```

The server generates the session (and its activity, configuration snapshot, and participants) and returns `sessionId` together with the participant ref(s) in the `ok()` envelope. <!-- 2026-07-12 -->

---

## Session Lifecycle — `PATCH /api/sessions/:sessionId`

Updates a session's status during its lifecycle — primarily the transition to completion. Consistent with the immutability principle (sessions are mutable during active play, immutable once `COMPLETED`), a session already in a terminal status rejects further updates with `409 SESSION_ALREADY_COMPLETED` (from the error-code registry in `03-Shared-Conventions.md`).

Terminal transitions: both `COMPLETED` and `ABANDONED` set `completed_at` — the server defaults it to `now()` when the request omits `completedAt`. `completed_at` means "when the session ended"; `ACTIVE` ⇔ `completed_at IS NULL` is a service-enforced invariant (it is what the `uq_sessions_single_active` index keys on). Invalid transitions → `409 INVALID_STATUS_TRANSITION`; unknown session → `404 NOT_FOUND`. <!-- 2026-07-13 -->

```typescript
// design sketch — status transition is validated server-side against the game_statuses lifecycle
const UpdateSessionRequest = z.object({
  status: z.string(),                        // game_statuses.implementation_key (e.g. "completed")
  completedAt: z.string().datetime().optional(),
});
type UpdateSessionRequest = z.infer<typeof UpdateSessionRequest>;
```

- The server validates the requested transition against the `game_statuses` lifecycle; invalid transitions are rejected with `INVALID_STATUS_TRANSITION`.
- Ownership is enforced (`403 SESSION_OWNERSHIP_MISMATCH`) before any mutation.
- Success returns the standard envelope (via `ok()` from `03`) with the updated `SessionOverview` (see Response DTOs below). <!-- 2026-07-12 -->

---

## Player Provisioning — `POST /api/players/provision`

On first login, a JWT-valid user has no row in `players` table. This endpoint closes the `PLAYER_NOT_PROVISIONED` gap: it creates a player row from `auth_user_id` (extracted from JWT `sub`).

**Idempotent behavior:**

- No player found → create new row, return `created: true`.
- Player already exists → return existing record, `created: false`.

**Request:**

```typescript
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),   // fallback: JWT `name` claim, else 'Player'
});
```

The server resolves the stored display_name as: request displayName → JWT `name` claim (when present) → literal 'Player'. players.display_name is NOT NULL. <!-- 2026-07-13 -->

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

## Player Settings — `GET` / `PATCH /api/players/me/settings`

The caller's default capture and input mode — the "app mode" the profile screen sets and the games page filters by. Settings are **defaults only**: they are read at session start and copied onto the session, so changing one never rewrites history. Shipped 2026-08-08, superseding D60's deferral clause; the client no longer persists last-used modes locally. <!-- 2026-08-08 -->

**Auth:** standard protected route class — JWT-verified, player resolved by middleware. `me` is always the authenticated player; no player id travels in the path.

### `GET /api/players/me/settings`

Read-only, backed by `v_player_settings` (migration `0021`). A player with no settings row — every player provisioned before settings shipped — reads as `RECREATIONAL` + `QUICK_SCORE`; so does a row whose mode ids are NULL. No backfill runs and the read never writes.

Success → `200` with the standard `ok()` envelope carrying `PlayerSettingsResponse`.

### `PATCH /api/players/me/settings`

Replaces both modes; there is no partial update. The row is created lazily on first write.

- A pair no ruleset version declares in `ruleset_version_capabilities` → `422 VALIDATION_FAILED`, with `error.details.reason` naming the rejected pair. The service checks it against `capableRulesets()` (`app/src/lib/game/rulesets/capabilities.ts`), the same declaration migration `0020`'s composite foreign key enforces on `exercise_sessions`. Without this the player could be left in an app mode in which no game can be started.
- A malformed body → `422 VALIDATION_FAILED` from the shared request-parsing helper.
- Success → `200` with the standard `ok()` envelope carrying the stored `PlayerSettingsResponse` (the request echoed back).

No new error codes are introduced; both cases reuse `VALIDATION_FAILED` from the registry in `03-Shared-Conventions.md`.

```typescript
// design sketch — reference values are implementation_key strings
const UpdatePlayerSettingsRequest = z.object({
  defaultCaptureModeKey: z.string(),         // capture_modes.implementation_key
  defaultInputModeKey: z.string(),           // input_modes.implementation_key
});
type UpdatePlayerSettingsRequest = z.infer<typeof UpdatePlayerSettingsRequest>;

const PlayerSettingsResponse = z.object({    // v_player_settings — GET and PATCH result
  defaultCaptureModeKey: z.string(),
  defaultInputModeKey: z.string(),
});
type PlayerSettingsResponse = z.infer<typeof PlayerSettingsResponse>;
```

`player_id` and `updated_at` are view columns and are deliberately not echoed: the caller is `me`, and no client reads the timestamp.

---

## Player Profile — `GET` / `PATCH /api/players/me`

The caller's display name and darts equipment (free-text darts description + weight in grams). Shipped 2026-08-15, closing the rename-endpoint gap `03-Player-Layer.md` flagged as deferred when `display_name` shipped. <!-- 2026-08-15 -->

**Auth:** standard protected route class — JWT-verified, player resolved by middleware. `me` is always the authenticated player; no player id travels in the path.

### `GET /api/players/me`

Read-only, backed by `v_player_profile` (migration `0022`). Every provisioned player has exactly one row — this is a plain projection over `players`, not a sparse join.

Success → `200` with the standard `ok()` envelope carrying `PlayerProfileResponse`.

### `PATCH /api/players/me`

Replaces all three fields; there is no partial update, matching `/me/settings`'s convention.

- A blank `displayName`, or `dartsWeightGrams` outside `1`-`100` → `422 VALIDATION_FAILED` from the shared request-parsing helper (the schema mirrors `chk_players_display_name_not_empty`/`chk_players_darts_description_not_empty`/`chk_players_darts_weight_grams_range`).
- Success → `200` with the standard `ok()` envelope carrying the stored `PlayerProfileResponse` (the request echoed back).

No new error codes are introduced; `VALIDATION_FAILED` is reused from the registry in `03-Shared-Conventions.md`.

```typescript
const UpdatePlayerProfileRequest = z.object({
  displayName: z.string().min(1),
  dartsDescription: z.string().min(1).nullable(),   // NULL clears it
  dartsWeightGrams: z.number().int().min(1).max(100).nullable(), // NULL clears it
});
type UpdatePlayerProfileRequest = z.infer<typeof UpdatePlayerProfileRequest>;

const PlayerProfileResponse = z.object({   // v_player_profile — GET and PATCH result
  displayName: z.string(),
  dartsDescription: z.string().nullable(),
  dartsWeightGrams: z.number().nullable(),
});
```

`player_id` and `updated_at` are view columns and are deliberately not echoed: the caller is `me`, and no client reads the timestamp.

---

## Configuration Presets — `GET /api/configuration-templates?gameType=<key>`

Lists the configuration presets available to the caller for one game type: system presets plus the caller's own. Backed 1:1 by `v_configuration_presets` (migration `0016`), player-scoped in the repository (`player_id IS NULL OR player_id = caller`). The returned `configurationTemplateId` is what `POST /api/sessions` accepts as `templateRef`. Preset CRUD is deferred post-v1; v1 presets are the read-only system seeds. <!-- 2026-07-13 -->

```typescript
const ConfigurationPreset = z.object({
  configurationTemplateId: z.string(),   // UUID — becomes templateRef
  gameTypeKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  configuration: z.record(z.unknown()),  // JSONB preset, ruleset-defined shape
  isSystemTemplate: z.boolean(),
});
```

Missing/unknown `gameType` → `422 VALIDATION_FAILED`.

---

## Read Contracts

All read endpoints are view-backed and player-scoped. Thin response contracts stay close to 1:1 view structure; list endpoints wrap view output in the standard `ListResult<T>` shape defined in `03-Shared-Conventions.md`.

| Endpoint | View | Shape | Date |
| -------- | ---- | ----- | ---- |
| `GET /api/sessions/active` | `v_active_sessions` | `SessionActive[]` | 2026-07-12 |
| `GET /api/sessions?limit=&cursor=` | `v_session_overview` | `ListResult<SessionOverview>` | 2026-07-10 |
| `GET /api/sessions/:sessionId` | `v_session_overview` | `SessionOverview` | 2026-07-12 |
| `GET /api/sessions/:sessionId/replay` | `v_game_replay` | `ReplayEntry[]` | 2026-07-12 |
| `GET /api/sessions/:sessionId/darts` | `v_dart_analytics` | `DartAnalytics[]` | 2026-07-12 |
| `GET /api/routines` | `v_routine_execution` | `ListResult<RoutineSummary>` | 2026-07-10 |
| `GET /api/routines/:routineId` | `v_routine_execution` | `RoutineExecution` | 2026-07-12 |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` | `RoutineExecution` | 2026-07-12 |
| `GET /api/configuration-templates` | `v_configuration_presets` | `ConfigurationPreset[]` | 2026-07-13 |
| `GET /api/players/me/settings` | `v_player_settings` | `PlayerSettingsResponse` | 2026-08-08 |
| `GET /api/players/me` | `v_player_profile` | `PlayerProfileResponse` | 2026-08-15 |

**Deferred (post-v1):** `GET /api/statistics/overview`, `GET /api/statistics/trends`, `GET /api/statistics/checkouts`. Statistics endpoints do not ship in v1; when built they must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`) per the view-backed-reads rule. v1 stores all dart/turn/session facts these derive from. <!-- 2026-07-12 -->

`v_routine_execution` is step-level; it backs both the routine list and the single-routine execution detail. The list **aggregates step rows to one summary row per routine** (distinct on routine identity) for `RoutineSummary`; the detail returns the full ordered step set. A dedicated `v_routine_summary` view may be introduced later if service-layer aggregation proves awkward; it is not required for v1. <!-- 2026-07-12 -->

**Pagination:** List endpoints support cursor-based pagination (`?limit=&cursor=`) and return `{ items: T[], nextCursor: string | null }`. Cursor is opaque, server-owned, and base64url-encoded. The sessions list orders by `session_id DESC` (UUIDv7 creation-ordered; the cursor encodes the last-seen `session_id`). <!-- 2026-07-13 -->

**Analytics-only darts:** `GET /api/sessions/:sessionId/darts` (`v_dart_analytics`) includes only darts with complete intention data and returns an empty array for recreational sessions — expected behaviour, not an error. <!-- 2026-07-12 -->

**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.

---

## Response DTOs

camelCase Zod sketches (source of truth; `type = z.infer<>`). Mapped from the normalized views in the repository (snake→camel). Read DTOs omit `playerId` and internal lookup ids; timestamps are ISO strings; `durationSeconds` is an integer. <!-- 2026-07-12 -->

```typescript
const SessionActive = z.object({            // v_active_sessions — GET /sessions/active → SessionActive[]
  sessionId: z.string(),
  gameTypeKey: z.string(), gameTypeName: z.string(),
  captureModeKey: z.string(), inputModeKey: z.string(),
  rulesetVersionKey: z.string(),
  startedAt: z.string().datetime(),
});

const SessionOverview = z.object({          // v_session_overview — list, GET /sessions/:id, PATCH result
  sessionId: z.string(),
  gameTypeKey: z.string(), gameTypeName: z.string(),
  statusKey: z.string(), captureModeKey: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int(),
});

const ReplayEntry = z.object({              // v_game_replay — GET /sessions/:id/replay → ReplayEntry[]
  stageId: z.string(),                       // structural identity for tree reconstruction
  parentStageId: z.string().nullable(),
  stageSequence: z.number().int(), stageTypeKey: z.string(),
  turnSequence: z.number().int(), participantName: z.string(),
  turnTotalScore: z.number().int(),
  dartNumber: z.number().int().nullable(),   // NULL for turn-total-only rows
  intendedTargetNumber: z.number().int().nullable(), intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int().nullable(),        // NULL when no dart row
});

const DartAnalytics = z.object({            // v_dart_analytics (session-filtered) — GET /sessions/:id/darts → DartAnalytics[]
  gameTypeKey: z.string(),
  intendedTargetNumber: z.number().int(), intendedZoneKey: z.string(), // non-null: view WHERE guarantees
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int(), exactHit: z.boolean(),
});                                          // session_id/player_id filter but are not echoed

const RoutineSummary = z.object({           // v_routine_execution aggregated — GET /routines → ListResult<RoutineSummary>
  routineId: z.string(), routineName: z.string(), stepCount: z.number().int(),
});

const RoutineStep = z.object({              // v_routine_execution row
  sequenceNumber: z.number().int(),
  exerciseTemplateId: z.string(), exerciseName: z.string(),
  gameTypeKey: z.string(),
  durationValue: z.number().int(), durationTypeKey: z.string(),
});
const RoutineExecution = z.object({         // GET /routines/:id and /:id/execution → RoutineExecution
  routineId: z.string(), routineName: z.string(),
  steps: z.array(RoutineStep),
});

const BatchWriteResponse = z.object({       // POST /sessions/:id/events/batch — counts only
  created: z.object({ stages: z.number().int(), turns: z.number().int(), darts: z.number().int() }),
});
```

All read DTOs are flat and close to 1:1 with their view, except `RoutineExecution`, which groups the step-level `v_routine_execution` rows into a routine with an ordered `steps[]`. `PATCH /api/sessions/:sessionId` returns the updated `SessionOverview`. `POST /api/players/provision` returns `ProvisionPlayerResponse` (defined under Player Provisioning). `POST /api/sessions` returns `CreateSessionResponse` (defined under Session Creation). `GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings).

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
