# API Response Contracts & v1 Freeze (Design)

> **Status:** Design (pre-freeze)
> **Date:** 2026-07-12
> **Branch:** `response-shape-decisions`
> **Cycle:** 2 of 2. Builds on cycle 1 (DB read-model normalization). This cycle defines the frozen API **response** contracts over the clean views, fixes the one existing endpoint whose code contradicts its contract (`provision`), and freezes `06-API/03`+`04`.

---

## 1. Purpose

`04-Endpoint-Contracts.md` fully specifies request shapes but names response types (`SessionOverview`, `RoutineSummary`, …) without ever listing their fields. A frontend cannot generate a typed client from that. This cycle defines every response DTO as a camelCase Zod sketch mapped onto the cycle-1 views, documents the snake→camel convention, fixes the `provision` endpoint code, and promotes `03`/`04` from draft to **frozen v1**.

Defining the concrete DTOs surfaced two contract-vs-reality defects that cycle 0's freeze missed; this cycle also reconciles them (see §3).

---

## 2. Decisions (from brainstorming)

| # | Decision | Rationale |
| - | -------- | --------- |
| C1 | Scope = response contracts + freeze **and** the `provision` code fix; no other endpoint implementation | The frozen contract needs its one existing implementation to conform; reads stay unimplemented (later backend cycle) |
| C2 | snake_case view columns → **camelCase DTO mapped in the repository**; one Zod schema per endpoint = SoT (`z.infer`) | Idiomatic per layer; already how Drizzle maps; matches request-side convention |
| C3 | Read DTOs **omit `playerId`** | Every read is player-scoped to the caller; echoing it is redundant |
| C4 | `durationSeconds` typed as **integer** `number`; service coerces the numeric epoch | Clean for display; no sub-second noise |
| C5 | Finding A: **add `session_id` to `v_dart_analytics`** via new migration `0014` | The per-session darts endpoint had no session column to filter on; reads go through views only |
| C6 | Finding B: `GET /sessions/active` returns **`SessionActive[]`** (array) | Model allows one active session *per game type*, so multiple are resumable |
| C7 | `PATCH /sessions/:id` returns the updated **`SessionOverview`** | Reuse the read DTO; no bespoke shape |
| C8 | `BatchWriteResponse` = **counts only** (no server UUIDs) | Frontend never stores persistence UUIDs by principle; returning them is dead weight |
| C9 | `provision` created-vs-existing detected via Postgres **`xmax = 0`** on the upsert `RETURNING` | Standard single-round-trip upsert-created detection |

---

## 3. Contract corrections this cycle lands

- `GET /api/sessions/active` → **array** `SessionActive[]` (was "object or null"; C6).
- `GET /api/sessions/:sessionId/darts` stays an **array**, now genuinely session-filterable via `v_dart_analytics.session_id` (C5).
- `GET /api/sessions/:sessionId/replay` documented as an **array** `ReplayEntry[]` (corrects `04`'s stale "object (1:1 view)"; the view is row-per-dart).

---

## 4. Migration `0014_dart_analytics_session_scope.sql`

New migration (never edits `0013`/`0009`); adds `session_id` as the first column of `v_dart_analytics`. dbmate format; up drops+recreates, down restores the `0013` definition.

```sql
-- migrate:up
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped).';

-- migrate:down  -- restores the 0013 definition (no session_id)
```

`session_id` is an entity UUID a consumer addresses (the endpoint filters on it), so it is retained under the cycle-1 read-model standard; `player_id` remains for future player-global statistics. Behaviour-preserving otherwise (same rows/joins/filter).

---

## 5. Read DTOs (camelCase; `playerId` omitted; timestamps ISO strings)

Design-level Zod sketches; the repository maps view rows → DTO.

```typescript
const SessionActive = z.object({          // v_active_sessions
  sessionId: z.string(),
  gameTypeKey: z.string(), gameTypeName: z.string(),
  captureModeKey: z.string(), inputModeKey: z.string(),
  rulesetVersionKey: z.string(),
  startedAt: z.string().datetime(),
});                                        // GET /sessions/active → SessionActive[]

const SessionOverview = z.object({         // v_session_overview
  sessionId: z.string(),
  gameTypeKey: z.string(), gameTypeName: z.string(),
  statusKey: z.string(), captureModeKey: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int(),
});                                        // list → ListResult<SessionOverview>; GET /sessions/:id → SessionOverview

const ReplayEntry = z.object({             // v_game_replay
  stageSequence: z.number().int(), stageTypeKey: z.string(),
  turnSequence: z.number().int(), participantName: z.string(),
  dartNumber: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(), intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int(),
});                                        // GET /sessions/:id/replay → ReplayEntry[]

const DartAnalytics = z.object({           // v_dart_analytics (session-filtered; session_id/player_id not echoed)
  gameTypeKey: z.string(),
  intendedTargetNumber: z.number().int(), intendedZoneKey: z.string(),   // non-null: view WHERE guarantees
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int(), exactHit: z.boolean(),
});                                        // GET /sessions/:id/darts → DartAnalytics[]

const RoutineSummary = z.object({          // v_routine_execution, aggregated one-per-routine
  routineId: z.string(), routineName: z.string(), stepCount: z.number().int(),
});                                        // GET /routines → ListResult<RoutineSummary>

const RoutineStep = z.object({             // v_routine_execution row
  sequenceNumber: z.number().int(),
  exerciseTemplateId: z.string(), exerciseName: z.string(),
  gameTypeKey: z.string(),
  durationValue: z.number().int(), durationTypeKey: z.string(),
});
const RoutineExecution = z.object({        // grouped: routine + ordered steps
  routineId: z.string(), routineName: z.string(),
  steps: z.array(RoutineStep),
});                                        // GET /routines/:id and /:id/execution → RoutineExecution
```

All flat/1:1 except `RoutineExecution`, which nests its ordered `steps[]` (the one genuine parent-with-children).

---

## 6. Write / command response DTOs

```typescript
// CreateSessionResponse — unchanged from the cycle-0 freeze
const CreateSessionResponse = z.object({ sessionId: z.string(), participants: z.array(ParticipantRef) });

// PATCH /sessions/:id → the updated SessionOverview (C7)

const BatchWriteResponse = z.object({      // counts only (C8)
  created: z.object({ stages: z.number().int(), turns: z.number().int(), darts: z.number().int() }),
});

const ProvisionPlayerResponse = z.object({ // already documented; now also implemented
  playerId: z.string(), authUserId: z.string(), created: z.boolean(),
});
```

---

## 7. Provision code fix (`app/`)

Aligns the one existing endpoint with its frozen contract.

- **`player.repository.ts`** — `upsertPlayerByAuthUserId` returns `{ playerId, authUserId, created }`. Detect created via `xmax`: add `xmax: sql<string>\`xmax::text\`` to the upsert's `.returning(...)`; `created = row.xmax === '0'` (0 ⇒ freshly inserted; non-zero ⇒ ON CONFLICT update). Single round-trip, no race.
- **`player.service.ts`** — returns the repository result unchanged (already the DTO shape).
- **`provision.ts`** — envelope `data` is `{ playerId, authUserId, created }` (maps the service result; no longer the raw row).
- **Validation:** `astro check` typechecks in-session; the `created` runtime behaviour is verified on the desktop DB run (needs Neon). No unit-test suite exists in `app/`; this follows the repo's `astro check` + desktop-apply practice.

---

## 8. Convention & freeze

- **`03-Shared-Conventions.md`** — new "Response DTOs & mapping" section: snake_case view columns → camelCase DTO mapped in the repository; one Zod schema per endpoint (`z.infer`); timestamps ISO strings; internal ids and `playerId` omitted; reuse the existing `types.ts` barrels + path aliases. Then **freeze**: `0.1.0 (draft)` → `1.0.0`, status header `frozen`.
- **`04-Endpoint-Contracts.md`** — add §5/§6 DTO sketches; correct the read table to the array shapes (§3). **Freeze**: `0.2.0 (draft)` → `1.0.0`, status `frozen`.
- **`00-Overview.md`** — Read Contract table shapes reconciled (`active` → array; `replay` → array; `darts` session-scoped array); note `03`/`04` are frozen. Version bump.
- **`05-Database/06-Spec/05-Read-Model-Layer.md`** — `v_dart_analytics` Sources/Exposes gain `session_id` (migration `0014`).

---

## 9. Deliverables

| File | Change |
| ---- | ------ |
| `architecture/docs/database/migrations/0014_dart_analytics_session_scope.sql` | New: add `session_id` to `v_dart_analytics` (§4). |
| `06-API/04-Endpoint-Contracts.md` | Response DTO sketches (§5/§6); read-table array corrections; freeze → 1.0.0. |
| `06-API/03-Shared-Conventions.md` | "Response DTOs & mapping" section; freeze → 1.0.0. |
| `06-API/00-Overview.md` | Read Contract shape reconciliation; note frozen `03`/`04`; version bump. |
| `05-Database/06-Spec/05-Read-Model-Layer.md` | `v_dart_analytics` gains `session_id`. |
| `05-Database/03-Migrations.md` | `0014` chain entry (tree + execution order). |
| `app/src/repositories/player.repository.ts`, `app/src/services/player.service.ts`, `app/src/pages/api/players/provision.ts` | Provision returns `{ playerId, authUserId, created }` (§7). |
| `architecture/DECISIONS.md` | Rows for the response-contract freeze + `0014` + provision alignment. |
| `00-Context-Map.md` | Register `0014`; chain range `0001–0013 → 0001–0014`; API doc statuses/versions; map version bump. |
| **Migration-range cascade** | `0001–0013 → 0001–0014` across the same ~11 non-historical docs cycle 1 touched, or `check-context-map.sh` fails. |

### Validation
`scripts/check-context-map.sh` must print `OK`. `astro check` (in `app/`) typechecks the provision change. Desktop follow-up (Neon): `db:migrate` (applies `0013`+`0014`) → `drizzle-kit introspect` (regenerates `schema.ts`, incl. `v_dart_analytics.sessionId`) → `npx fallow` → `astro check` → confirm provision `created` behaviour.

---

## 10. Non-goals

- **No read endpoint / repository / handler implementation** — only the response *contracts* are defined; only `provision` code is touched (it already exists and contradicts the contract).
- **No frontend code.**
- **No statistics endpoints** — still deferred; `v_dart_analytics.player_id` is retained for that future work but no player-global endpoint is added.
- **No new game-type / ruleset / config-vocabulary work.**
- **`schema.ts` is not hand-edited** — regenerated on the desktop `introspect`.

---

## 11. Definition of done

1. `0014` migration created (up adds `session_id`; down restores `0013`); never edits `0013`/`0009`.
2. `04` carries every response DTO as a Zod sketch; read shapes corrected (active/replay arrays, darts session-scoped); `03` has the convention section; both frozen at `1.0.0`.
3. `00-Overview` read table matches `04`; `05-Read-Model-Layer` reflects `session_id`.
4. `provision.ts`/service/repository return `{ playerId, authUserId, created }`; `astro check` clean.
5. Chain documented `0001–0014`; `DECISIONS` + context map updated; `check-context-map.sh` prints `OK`.
6. No read endpoint code, frontend, statistics endpoint, or hand-edited `schema.ts`.
