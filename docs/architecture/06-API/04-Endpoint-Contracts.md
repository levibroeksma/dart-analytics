<!--
status: canonical
scope: api/endpoint-contracts
read-when: adding or changing endpoint contracts
updated: 2026-09-20
-->

# API Endpoint Contracts

> **Version:** 1.9.0 (weekly training schedules shipped, closing Task 3 of `docs/superpowers/plans/2026-09-18-weekly-training-schedules.md`: new "Training Schedules" section for `/api/schedules` — list, get, active, create, replace, activate, deactivate, delete — against `v_training_schedules`/`v_training_schedule_days`; `DELETE /api/routines/:routineId` documented gaining the `"routine in use"` rejection; D342/D343, 2026-09-20; prior 1.8.0 `StatisticsOverviewResponse.doubleAccuracy` renamed `checkoutPercentage`, backed by `v_x01_checkout_darts` — doc-only bump under the freeze-semantics rule, 2026-09-19; prior 1.7.0 custom-routine-builder shipped, closing issue #483: the three `GET /api/routines*`/`/exercise-templates` reads and the Custom Routine Write Contracts section drop their "(not implemented)"/"(planned, unbuilt)" tags, `v_routine_execution`'s list/detail paragraph restated as built, `CreateRoutineRequest`/`UpdateRoutineRequest`/`ExerciseTemplateCatalogEntry` marked shipped, and a note added that a real-but-not-offerable `exerciseTemplateId` answers with the same "unknown exerciseTemplateId" reason as a genuinely unknown one, 2026-09-19; prior 1.6.0 `VISUAL_BOARD` added to the `inputModeKey` contract and the capability pairing corrected, issue #341; activity grouping restated as shipped — D301, 2026-09-17; prior 1.5.0 Statistics Overview, 2026-09-06)
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
- A training routine's dart-exercise step (`SWITCHING_V1`, `DOUBLE_PATTERN_V1`) uploads through this same route on a session that carries an exercise ruleset and no game ruleset: the batch passes the structural checks (ownership, active status, idempotency, `participantRef`, stage/zone reference resolution) and no per-ruleset `validateBatch`, since exercise rulesets validate configuration only. A Warm-Up session (no dart-writing ruleset, no capture pair) that sends a batch is rejected `INTERNAL_ERROR` — it records no dart by design. (D277, 2026-09-14) That configuration validation runs in `startTraining`, once, over every step of the routine before the activity's snapshot is written; a step that fails it, or that resolves no validator at all, fails the whole `POST /api/training-sessions` call with `VALIDATION_FAILED` and no activity is created (D296, 2026-09-17). <!-- 2026-09-14 --> <!-- 2026-09-17 -->
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
- `captureModeKey` and `inputModeKey` are required and stored on the session (self-describing runtime record); the pair is validated against the requested ruleset version's rows in `ruleset_version_capabilities` (migration `0019`, seeded in `0007`), so which pairs are legal is data, not a rule stated here. As seeded: every ruleset version pairs `ANALYTICS` with `VISUAL_BOARD`, and `RECREATIONAL` with `QUICK_SCORE` or `DETAILED_DARTS` depending on the game. `ANALYTICS` / `DETAILED_DARTS` is not a seeded pair for any ruleset. <!-- 2026-07-12; pairing corrected against seed `0007` 2026-09-17 -->
- **Participants (v1):** the server derives exactly one participant of type `PLAYER` for the authenticated player, `displayName` copied from `players.display_name`, and returns its `ref`. Guest/DartBot participants are deferred post-v1 (added later as an optional `participants[]` input — additive, non-breaking). <!-- 2026-07-12 -->
- **Participants (guests):** the optional `participants[]` input is now implemented as that decision anticipated. Array ORDER is seat order — it decides who throws first in leg 1. Omitting the field reproduces the single-`PLAYER` session above exactly. The `PLAYER` seat's `displayName` is always copied server-side from `players.display_name`; a client-supplied value is ignored, because migration `0005`'s CHECK requires exactly that. The seats are also written into the configuration snapshot under `seats`, in the same transaction as the participant rows. <!-- 2026-08-21 -->
- **Seat rejections** (all `VALIDATION_FAILED`, asserted once in `app/src/services/session-seats.service.ts`, and nothing is written): fewer than 1 or more than 4 seats; not exactly one `PLAYER`; a `GUEST` with a blank name; two seats sharing one `sideKey` (2v2 is not implemented); more seats than the requested ruleset's own cap — see `SEAT_CAPS` below. Duplicate guest display names are deliberately allowed — seats are identified by ref, not name. <!-- 2026-08-21; seat cap generalized from a single 501_V1 special case to SEAT_CAPS 2026-08-22 -->
- **`SEAT_CAPS`** (`app/src/services/session-seats.service.ts`) — the most seats a session may request, keyed by `rulesetVersionKey`. A ruleset with no entry defaults to a cap of **1** (any 2nd seat rejected). `501_V1` alone keeps room for a future 2v2; the other eight rulesets each support exactly one opponent (1v1) per `2026-08-22-single-opponent-seat-remaining-engines-design.md`:

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
- **Activity (v1):** the session's activity is created and managed server-side. A standalone game session gets an activity of its own; a training routine's activity spans every step session started under it, so one activity to N sessions is the shipped shape, not a deferred one (D301, issue #339). Routine-run writes ship as `POST /api/training-sessions` and `POST /api/training-sessions/:activityId/steps`. <!-- 2026-07-12; restated as shipped 2026-09-17 -->
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
  inputModeKey: z.string(),                  // input_modes.implementation_key (QUICK_SCORE | DETAILED_DARTS | VISUAL_BOARD)
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

## Statistics Overview — `GET /api/statistics/overview`

The caller's career-wide stat overview. Read-only, backed by `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, and `v_x01_checkout_darts` (migrations `0009`, `0025`, `0026`, `0039`). Aggregation happens in `services/statistics.service.ts` over the four pure modules under `modules/stats/`/`modules/game/`, not a single dedicated view — see `decisions/api.md` for why.

**Auth:** standard protected route class — JWT-verified, player resolved by middleware. No path parameter, no query parameter, no request body.

Every response field is always present. `null` means "not enough data to compute" (e.g. no completed sessions, no legs with complete dart capture) — never "field not implemented." `checkoutPercentage` and `highestCheckout` are computed from whatever `v_x01_checkout_darts` currently returns (501/TUOD/121 under `VISUAL_BOARD`, as of this writing) and will widen automatically, with no contract change, once that view's game-type filter is extended. `checkoutPercentage` is a 0–1 ratio of hits over every dart thrown at a double across the caller's whole X01 history, `null` when no dart was ever thrown at one (D338, `decisions/game-engine.md`). The session's `starting_score` is one of those columns from migration `0036` on, so the read no longer selects `exercise_configurations` itself (D298, issue #342). <!-- 2026-09-17; renamed and widened to TUOD/121, 2026-09-19 -->

Success → `200` with the standard `ok()` envelope carrying `StatisticsOverviewResponse`. No new error codes — only the standard protected-route failures (`401`, `403 PLAYER_NOT_PROVISIONED`, `500`/`503` from the API error boundary).

```typescript
const StatisticsOverviewResponse = z.object({
  totalGamesPlayed: z.number().int(),
  totalPlayTimeSeconds: z.number().int(),
  favoriteGameTypeKey: z.string().nullable(),
  longestPlayStreakDays: z.number().int(),
  currentPlayStreakDays: z.number().int(),
  totalDartsThrown: z.number().int(),
  hundredPlusCount: z.number().int(),
  oneTwentyPlusCount: z.number().int(),
  oneFortyPlusCount: z.number().int(),
  oneEightiesCount: z.number().int(),
  medianVisitScore: z.number(),
  highestGameAverage: z.number(),
  firstNineCareerAverage: z.number(),
  scoringAverageExcludingDoubles: z.number(),
  bestLegDarts: z.number().int().nullable(),
  averageDartsPerLeg: z.number().nullable(),
  checkoutPercentage: z.number().min(0).max(1).nullable(), // ratio of darts thrown at a double that hit; null when none were thrown
  highestCheckout: z
    .object({ value: z.number().int(), timesHit: z.number().int() })
    .nullable(),
});
type StatisticsOverviewResponse = z.infer<typeof StatisticsOverviewResponse>;
```

Win rate is deliberately absent from this shape, not a null field — it needs session-replay-from-persisted-facts, which doesn't exist for any game engine yet, and will be an additive field on a future plan rather than a breaking change to this one.

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
| `GET /api/routines` | `v_routine_execution` | `ListResult<RoutineSummary>` | 2026-07-10; shipped 2026-09-19 |
| `GET /api/routines/:routineId` | `v_routine_execution` | `RoutineExecution` | 2026-07-12; shipped 2026-09-19 |
| `GET /api/routines/:routineId/execution` (dropped 2026-09-18, D321 — same shape as the row above; never built) | — | — | 2026-07-12 |
| `GET /api/exercise-templates` | `v_exercise_template_catalog` | `ExerciseTemplateCatalogEntry[]` | 2026-09-17; shipped 2026-09-19 |
| `GET /api/schedules` | `v_training_schedules` | `ListResult<ScheduleSummary>` | 2026-09-20 |
| `GET /api/schedules/active` | `v_training_schedules` + `v_training_schedule_days` | `Schedule \| null` | 2026-09-20 |
| `GET /api/schedules/:scheduleId` | `v_training_schedules` + `v_training_schedule_days` | `Schedule` | 2026-09-20 |
| `GET /api/configuration-templates` | `v_configuration_presets` | `ConfigurationPreset[]` | 2026-07-13 |
| `GET /api/players/me/settings` | `v_player_settings` | `PlayerSettingsResponse` | 2026-08-08 |
| `GET /api/players/me` | `v_player_profile` | `PlayerProfileResponse` | 2026-08-15 |
| `GET /api/statistics/overview` | `v_session_overview` + `v_player_visit_facts` + `v_player_leg_facts` + `v_x01_checkout_darts` | `StatisticsOverviewResponse` | 2026-09-06 |

**Deferred (post-v1):** `GET /api/statistics/trends`, `GET /api/statistics/checkouts`. `GET /api/statistics/overview` shipped 2026-09-06 (see the Statistics Overview section above); the remaining two must each be view-backed when built per the view-backed-reads rule. <!-- 2026-07-12; overview shipped 2026-09-06 -->

`v_routine_execution` is step-level; it backs both `GET /api/routines` (the list) and `GET /api/routines/:routineId` (the single-routine execution detail), both shipped 2026-09-19 (migration `0038`, D336). `POST /api/training-sessions` is a second consumer, resolving a system routine's — or, since D321, the caller's own — ordered steps through it by routine id (D299, issue #344). <!-- 2026-09-17; corrected 2026-09-19, D321 --> Migration `0038` recreated the view with `player_id` and `routine_description`/`exercise_description`, which is what makes the "system routines + caller's own" list readable through it (D321) — committed unapplied, per D336. The list **aggregates step rows to one summary row per routine** (distinct on routine identity) for `RoutineSummary`; the detail returns the full ordered step set. A dedicated `v_routine_summary` view may be introduced later if service-layer aggregation proves awkward; it is not required for v1. <!-- 2026-07-12; shipped 2026-09-19 -->

**Pagination:** List endpoints support cursor-based pagination (`?limit=&cursor=`) and return `{ items: T[], nextCursor: string | null }`. Cursor is opaque, server-owned, and base64url-encoded. The sessions list orders by `session_id DESC` (UUIDv7 creation-ordered; the cursor encodes the last-seen `session_id`). <!-- 2026-07-13 -->

**Analytics-only darts:** `GET /api/sessions/:sessionId/darts` (`v_dart_analytics`) includes only darts with complete intention data and returns an empty array for recreational sessions — expected behaviour, not an error. <!-- 2026-07-12 -->

**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.

---

## Custom Routine Write Contracts

Per D306 and `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
§3.4, refined by D321. Shipped 2026-09-19 (`app/src/pages/api/routines/`,
`app/src/services/routine.service.ts`). The database side these routes write
through — migration `0038`'s ownership `CHECK` and duration-bound trigger —
is committed but applied to no database (D336).

| Endpoint | Body | Response | Ownership |
| -------- | ---- | -------- | --------- |
| `POST /api/routines` | `CreateRoutineRequest` | `RoutineExecution` | creates under caller's `player_id` |
| `PUT /api/routines/:routineId` | `UpdateRoutineRequest` | `RoutineExecution` | owner only |
| `DELETE /api/routines/:routineId` | — | `204` | owner only, never a system routine |
| `POST /api/training-sessions` (change, D321) | `StartTrainingRequest` gains `routineTemplateId`, replacing `routineTemplateName` | `StartTrainingResponse` gains `routineTemplateId` | system, or caller-owned routine |

`PUT` replaces `name`/`description`/the full ordered `steps[]` — no partial-reorder
patch. `sequence_number` is assigned server-side from array position and is
never accepted from the request body. A write against another player's routine
returns `NOT_FOUND` (existence is not leaked); a write against a system routine
(`is_system_template = TRUE`) returns `VALIDATION_FAILED` with
`details.reason = "system routine is read-only"` — the closed error registry in
`03-Shared-Conventions.md` has no generic 403 code and is not reopened for this
(D321, 2026-09-18). Phase 1 accepts `durationTypeKey: "MINUTES"` only.

A step naming an `exerciseTemplateId` the catalog does not currently offer —
whether the id is genuinely unknown, or names a real system exercise template
that `GET /api/exercise-templates` filters out for having no
`default_configuration` — answers `VALIDATION_FAILED` with the same
`details.reason = "unknown exerciseTemplateId"`. This is deliberate, not a
missed case: a distinct reason for "exists but not offerable" would let a
write confirm the existence of a system template the read side never exposes
(`app/src/services/routine.service.ts`'s `writeIssues`, 2026-09-19).

---

## Training Schedules — `/api/schedules`

Per D342/D343 and `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`
§4/§5. Shipped 2026-09-20 (`app/src/pages/api/schedules/`,
`app/src/services/schedule.service.ts`) against `v_training_schedules`/
`v_training_schedule_days` (migration `0041`, D342).

**Auth:** standard protected route class — JWT-verified, player resolved by middleware.
Every route is player-scoped through the service; no player id travels in any path.

**"Today" is resolved client-side, not by a route here (D343).** `players` carries no
timezone column and the API sets no cookie a server could read one from, so the contract
has no `/today` endpoint. The client computes `new Date().getDay()` mapped to ISO
(Sunday = 7) and indexes the active schedule's `days[]` (`isoWeekday`/`todayEntry`,
`lib/training/schedules/today.ts`). `GET /api/schedules/active` exists only to save that
lookup its own round trip: one call returns the active `Schedule | null` for the
`/training` Today card, instead of the client fetching the list and finding the active row
itself.

### `GET /api/schedules`

Read-only, backed by `v_training_schedules`, player-scoped. Returns every schedule the
caller owns, each with its `dayCount` (view column) — a schedule with no days still lists,
since the view never joins onto `training_schedule_days` to produce its row.

Success → `200` with the standard `ok()` envelope carrying `ListResult<ScheduleSummary>`.

### `GET /api/schedules/active`

Read-only, backed by `v_training_schedules` + `v_training_schedule_days`. Returns the
caller's active schedule (`Schedule`, `days[]` populated and sorted by `dayOfWeek`), or
`null` when none is active — never `404`.

Success → `200` with the standard `ok()` envelope carrying `Schedule | null`.

### `GET /api/schedules/:scheduleId`

Read-only, backed by `v_training_schedules` + `v_training_schedule_days`.

- Foreign or unknown `scheduleId` → `404 NOT_FOUND` (existence is not leaked).
- Success → `200` with the standard `ok()` envelope carrying `Schedule`.

### `POST /api/schedules`

Creates a schedule inactive — a fresh schedule is never auto-activated.

- A weekday repeated in `days[]` → `422 VALIDATION_FAILED`,
  `details = { reason: "duplicate dayOfWeek", dayOfWeek }`.
- A `routineTemplateId` that does not resolve as system or caller-owned (via `getRoutine`,
  `app/src/services/routine.service.ts`) → `422 VALIDATION_FAILED`,
  `details = { reason: "unknown routineTemplateId", dayOfWeek }`.
- A malformed body → `422 VALIDATION_FAILED` from the shared request-parsing helper.
- Success → `201` with the standard `ok()` envelope carrying the created `Schedule`.

### `PUT /api/schedules/:scheduleId`

Full replace of `name` and `days[]` — delete-then-insert the days in one transaction, no
partial-day patch. Same validation as `POST` (duplicate weekday, unknown
`routineTemplateId`).

- Foreign or unknown `scheduleId` → `404 NOT_FOUND`.
- Success → `200` with the standard `ok()` envelope carrying the updated `Schedule`.

### `DELETE /api/schedules/:scheduleId`

- Foreign or unknown `scheduleId` → `404 NOT_FOUND`.
- Success → `204`, no envelope body — there is no body to carry a `requestId` in, the
  header still does — matching `DELETE /api/routines/:routineId`'s convention. Days
  cascade; deleting the active schedule leaves the player with none active.

### `POST /api/schedules/:scheduleId/activate`

One transaction: `UPDATE … SET is_active = FALSE WHERE player_id = ?` runs before
`SET is_active = TRUE WHERE id = ? AND player_id = ?`, ordered so
`uq_training_schedules_player_active` (the partial unique index, D342) never trips
clearing every sibling before setting the target.

- Foreign or unknown `scheduleId` → `404 NOT_FOUND`.
- Success → `200` with the standard `ok()` envelope carrying the now-active `Schedule`.

### `POST /api/schedules/:scheduleId/deactivate`

Leaves the player with no active schedule — deactivating is not the same as activating
another schedule.

- Foreign or unknown `scheduleId` → `404 NOT_FOUND`.
- Success → `200` with the standard `ok()` envelope carrying the now-inactive `Schedule`.

### Routine deletion when scheduled

`DELETE /api/routines/:routineId` (Custom Routine Write Contracts, above) gains one more
rejection once a routine is scheduled anywhere:
`fk_training_schedule_days_routine_template` (`ON DELETE RESTRICT`, migration `0041`)
blocks the delete, and `deleteRoutine` (`app/src/services/routine.service.ts`) catches the
`23503` — via the shared `matchesConstraintError` helper (`services/db-errors.ts`) — and
answers `422 VALIDATION_FAILED`, `details = { reason: "routine in use", scheduleIds }`;
`scheduleIds` is read back through `findScheduleIdsUsingRoutine` (`v_training_schedule_days`,
player-scoped). No silent `SET NULL`: a training day never turns into rest without the
caller being told (D342).

No new error codes are introduced anywhere in this section; `NOT_FOUND` and
`VALIDATION_FAILED` are reused from the registry in `03-Shared-Conventions.md`.

```typescript
// design sketch — mirrors app/src/pages/api/schedules/types.ts exactly
const ScheduleDayInput = z.object({
  dayOfWeek: z.number().int().min(1).max(7),   // ISO weekday, 1 = Monday … 7 = Sunday
  routineTemplateId: z.string().min(1),
});
const CreateScheduleRequest = z.object({
  name: z.string().trim().min(1).max(60),      // MAX_SCHEDULE_NAME_LENGTH
  days: z.array(ScheduleDayInput).max(7),      // a weekday absent from days[] is rest
});
type CreateScheduleRequest = z.infer<typeof CreateScheduleRequest>;
const UpdateScheduleRequest = CreateScheduleRequest;  // PUT body — full replace, same shape

const ScheduleDay = z.object({                // one entry per weekday present in days[]
  dayOfWeek: z.number().int(),
  routineId: z.string(), routineName: z.string(), routineMinutes: z.number().int(),
});
const ScheduleResponse = z.object({           // GET (detail/active)/POST/PUT/activate/deactivate → Schedule
  scheduleId: z.string(), name: z.string(), isActive: z.boolean(),
  days: z.array(ScheduleDay),                 // sorted by dayOfWeek
});
type Schedule = z.infer<typeof ScheduleResponse>;

const ScheduleSummary = z.object({            // GET /schedules list row
  scheduleId: z.string(), name: z.string(), isActive: z.boolean(), dayCount: z.number().int(),
});
const ScheduleListResponse = z.object({       // GET /schedules → ListResult<ScheduleSummary>
  items: z.array(ScheduleSummary), nextCursor: z.null(),
});
```

---

## Response DTOs

camelCase Zod sketches (source of truth; `type = z.infer<>`). Mapped from the normalized views in the repository (snake→camel). Read DTOs omit `playerId` and internal lookup ids; timestamps are ISO strings; `durationSeconds` is an integer. <!-- 2026-07-12 -->

```typescript
const SessionActive = z.object({            // v_active_sessions — GET /sessions/active → SessionActive[]
  sessionId: z.string(),
  gameTypeKey: z.string().nullable(), gameTypeName: z.string().nullable(),
  captureModeKey: z.string().nullable(), inputModeKey: z.string().nullable(),
  rulesetVersionKey: z.string().nullable(), // all five NULL for a training exercise session (migration 0033)
  startedAt: z.string().datetime(),
});

const SessionOverview = z.object({          // v_session_overview — list, GET /sessions/:id, PATCH result
  sessionId: z.string(),
  gameTypeKey: z.string().nullable(), gameTypeName: z.string().nullable(),
  statusKey: z.string(), captureModeKey: z.string().nullable(),
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
  gameTypeKey: z.string().nullable(),
  intendedTargetNumber: z.number().int(), intendedZoneKey: z.string(), // non-null: view WHERE guarantees
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int(), exactHit: z.boolean(),
});                                          // session_id/player_id filter but are not echoed

const RoutineSummary = z.object({           // v_routine_execution aggregated — GET /routines → ListResult<RoutineSummary>
  routineId: z.string(), routineName: z.string(), stepCount: z.number().int(),
  description: z.string().nullable(), isSystemTemplate: z.boolean(),   // D321: the list must tell system from own
  totalMinutes: z.number().int(),                                        // sum of MINUTES steps, derived per §6
});

const RoutineStep = z.object({              // v_routine_execution row
  sequenceNumber: z.number().int(),
  exerciseTemplateId: z.string(), exerciseName: z.string(),
  exerciseDescription: z.string().nullable(),   // D321: the data-driven detail page renders it
  exerciseTypeKey: z.string(),                  // D321: WARM_UP | SWITCHING | DOUBLE_PATTERN | GAME
  gameTypeKey: z.string().nullable(),       // NULL for a non-game exercise step
  durationValue: z.number().int(), durationTypeKey: z.string(),
});
const RoutineExecution = z.object({         // GET /routines/:id → RoutineExecution (the /execution alias is dropped, D321)
  routineId: z.string(), routineName: z.string(),
  description: z.string().nullable(), isSystemTemplate: z.boolean(),
  steps: z.array(RoutineStep),
});

const ExerciseTemplateCatalogEntry = z.object({ // v_exercise_template_catalog — GET /exercise-templates (D321, shipped 2026-09-19)
  exerciseTemplateId: z.string(), name: z.string(), description: z.string().nullable(),
  exerciseTypeKey: z.string(), gameTypeKey: z.string().nullable(),
});

const RoutineStepInput = z.object({         // request shape inside steps[] — POST/PUT /routines
  exerciseTemplateId: z.string(),
  durationValue: z.number().int(), durationTypeKey: z.string(),
});
const CreateRoutineRequest = z.object({     // POST /routines body → RoutineExecution
  name: z.string(), description: z.string().nullable(),
  steps: z.array(RoutineStepInput),
});
const UpdateRoutineRequest = CreateRoutineRequest; // PUT /routines/:id body — full replace, same shape

const BatchWriteResponse = z.object({       // POST /sessions/:id/events/batch — counts only
  created: z.object({ stages: z.number().int(), turns: z.number().int(), darts: z.number().int() }),
});
```

Every lookup key a read DTO projects is nullable exactly when its view column is. Since migration `0033` the read model LEFT JOINs the lookups a training exercise session leaves NULL, so `gameTypeKey`/`gameTypeName`/`captureModeKey`/`inputModeKey`/`rulesetVersionKey` arrive as `null` for such a session rather than the session vanishing from the response. <!-- 2026-09-16 -->

All read DTOs are flat and close to 1:1 with their view, except `RoutineExecution`, which groups the step-level `v_routine_execution` rows into a routine with an ordered `steps[]`. `PATCH /api/sessions/:sessionId` returns the updated `SessionOverview`. `POST /api/players/provision` returns `ProvisionPlayerResponse` (defined under Player Provisioning). `POST /api/sessions` returns `CreateSessionResponse` (defined under Session Creation). `GET`/`PATCH /api/players/me` return `PlayerProfileResponse` (defined under Player Profile). `GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings). `GET /api/statistics/overview` returns `StatisticsOverviewResponse` (defined under Statistics Overview). `POST`/`PUT /api/routines` return the updated `RoutineExecution`; `CreateRoutineRequest`/`UpdateRoutineRequest` (D306, shipped 2026-09-19) are the request DTOs. `GET /api/schedules/active`, `GET /api/schedules/:scheduleId`, `POST /api/schedules`, `PUT`/activate/deactivate `/api/schedules/:scheduleId` all return `Schedule`; `GET /api/schedules` returns `ListResult<ScheduleSummary>` (all defined under Training Schedules, D342/D343, shipped 2026-09-20).

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
