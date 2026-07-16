# Score Training Game Engine — Design

> **Date:** 2026-07-16
> **Status:** approved (brainstorming consensus)
> **Scope:** Translate `docs/game-rules/rulesets/score-training.md` (raw, non-canonical rules notes) into the first real, end-to-end game engine implementation — Worker sessions API (service/repository/routes, none of which exist yet) plus the ruleset validator registry pattern plus the frontend engine/store/UI — using Score Training as the proof case because it is the simplest game in the ruleset set.
> **Out of scope:** 501, TUOD, Singles Training, Cricket, and every other seeded-but-unimplemented game type. Statistics endpoints (frozen deferred post-v1). Multiplayer, challenge/target-total variants, restricted-scoring variants (all explicitly V2+ in the raw notes). Any change to the frozen API v1 contract (`06-API/00-Overview.md`) — this design implements existing routes, it does not add or change any.

---

## Context

`docs/game-rules/rulesets/score-training.md` describes the simplest game in the set: throw a fixed number of visits (3 darts each), sum face values, no checkout/bust logic. The raw notes describe **only** a fixed-N-visits session.

However, exploration during brainstorming found the schema already ahead of the raw notes: `database/seeds/0001_reference_data.sql` maps `SCORE_TRAINING` to both `TIMED_MODE` and `ROUNDS_MODE` features, and `database/seeds/0002_default_templates.sql` already seeds two configuration presets — "Score Training — 10 Rounds" (`duration_type: ROUNDS`) and "Score Training — 15 Minutes" (`duration_type: MINUTES`). Per the authority order in `00-Context-Map.md`, the database spec/seed chain outranks the raw pre-spec notes, so this design treats the raw notes' silence on timing as incomplete rather than authoritative and builds both duration modes.

More significantly: **no part of the sessions vertical slice exists yet.** `app/src/services/` and `app/src/repositories/` are empty scaffolds (only `player.service.ts`/`player.repository.ts` exist, from provisioning). No `pages/api/sessions/**` routes exist. No frontend game store, engine module, or game pages exist beyond the `pages/games/index.astro` placeholder. This design is therefore the first real implementation of the API and frontend layers the architecture docs have already frozen the contract for (`06-API/00-Overview.md` v1.3.0, `07-Frontend/00-Overview.md` v0.3.3) — Score Training is the vehicle, not the whole deliverable.

**Decisions made during brainstorming:**
- One combined spec covering infrastructure + Score Training specifics (not split), since Score Training is deliberately the simplest game to prove the pattern.
- Support both `ROUNDS` and `MINUTES` duration modes (matches existing seeds).
- V1 capture/input mode is `RECREATIONAL` + `QUICK_SCORE` only (turn totals, no dart rows) — no detailed dart entry UI in this design.
- Timer expiry in `MINUTES` mode is a soft signal: the in-progress visit is always allowed to finish before the session ends.
- Reuse the existing `SegmentTimer` UI module unmodified (see below) rather than building a new timer.

---

## Design

### 1. Data & configuration shape

Game type `SCORE_TRAINING` and ruleset `SCORE_TRAINING_V1` are already seeded — no new lookup rows needed.

**Configuration JSONB** (already matches the seeded presets, no seed changes needed):
```json
{
  "duration_type": "ROUNDS" | "MINUTES",
  "duration_value": 10,
  "max_darts_per_turn": 3
}
```
`duration_value` bounds: `ROUNDS` → 1–50 (per the raw notes' min/max); `MINUTES` → 1–180 (sanity bound, no existing product requirement beyond that).

**Runtime shape per session:**
- 1 `exercise_session` — `capture_mode = RECREATIONAL`, `input_mode = QUICK_SCORE`.
- 1 `exercise_stage` — `stage_type = EXERCISE_BLOCK`, `sequence_number = 1`, no parent, no child stages (Score Training has no leg/set hierarchy).
- N `turns` under that stage, `sequence_number = 1..N`, `total_score` = sum of that visit's 3 darts, **no `darts` rows** (RECREATIONAL + QUICK_SCORE per `05-Database/06-Spec/04-Runtime-Layer.md`).
- 1 `participant` — server-derived `PLAYER`, per the frozen v1 baseline (single participant only).

### 2. Worker API layer

No new endpoints or contract changes — Score Training rides the existing frozen routes (`POST /api/sessions`, `POST /api/sessions/:id/events/batch`, `PATCH /api/sessions/:id`, plus the read routes). What gets built, since none of it exists:

**Ruleset validator registry** — the extensibility pattern already specified in `06-API/04-Endpoint-Contracts.md` §Extensibility:

```
app/src/services/rulesets/
├── registry.ts                          # Map<rulesetVersionKey, RulesetValidator>
├── interfaces.ts                        # RulesetValidator interface — raised to @services/interfaces
├── types.ts                             # ConfigValidationResult, BatchValidationResult — raised to @services/types
└── score-training/
    ├── score-training.config.schema.ts  # Zod schema + z.infer type; re-exported via ../types.ts
    └── score-training.validator.ts      # implements RulesetValidator from ../interfaces.ts
```

`RulesetValidator` is a TS `interface`, so it lives in `interfaces.ts` and rides the separate `interfaces.ts` raising chain (`03-Shared-Conventions.md` §`interfaces.ts` barrels) up to `@services/interfaces` — never mixed into `types.ts`, which carries the Zod-derived result/config types instead, raised to `@services/types` as usual. Same folder, two parallel barrels.

```typescript
// services/rulesets/interfaces.ts
interface RulesetValidator {
  validateConfig(config: unknown): ConfigValidationResult;
  validateBatch(config: JsonObject, batch: EventsBatchRequest): BatchValidationResult;
}
```

- `validateConfig` (called at `POST /api/sessions`): enforces `duration_value` bounds per mode and `max_darts_per_turn <= 3`. Failure → `422 VALIDATION_FAILED`, details from the Zod schema.
- `validateBatch` (called at `POST /api/sessions/:id/events/batch`): enforces (a) every `TurnFact.darts` is empty (RECREATIONAL + QUICK_SCORE contract), (b) turn ordering is contiguous, and (c) for `ROUNDS` mode only, total turn count never exceeds the configured `duration_value`. **`MINUTES` mode has no server-side turn-count ceiling** — the timer is client-side UX; the server has no wall-clock elapsed-time signal, so `MINUTES` sessions are only checked structurally. This limitation is deliberate and should not be "fixed" later without a real product need.

**Service** (`services/session.service.ts` — new):
- `createSession()` — resolves ruleset → validator from registry, resolves config (template or inline per the discriminated `ConfigInput`), calls `validateConfig`, writes activity + session + config snapshot + participant in one transaction, returns `sessionId` + participant ref.
- `appendBatch()` — loads session (ownership check, `409 SESSION_ALREADY_COMPLETED` if not `ACTIVE`), loads the ruleset config from the snapshot, resolves validator, calls `validateBatch`, checks the idempotency table, writes stage/turns (no darts) in one transaction.
- `updateStatus()` — validates the lifecycle transition, sets `completed_at` (defaults to `now()`).

**Repository** (`repositories/session.repository.ts` — new): parameterized SQL for the above inserts, plus reads from `v_active_sessions` / `v_session_overview` / `v_game_replay`.

This scaffold (registry, service, repository, routes) is generic — Score Training is simply the first entry in `registry.ts`; 501/TUOD/Singles slot in later without touching shared code.

### 3. Frontend

**Store** (`stores/game.store.ts` — new, generic across game types, keyed by `gameTypeKey` per D09):
- `sessionId`, `participantRef`, `configSnapshot` (`duration_type`, `duration_value`, `max_darts_per_turn`), `turns: {clientKey, sequence, totalScore, completedAt}[]`.
- Timer fields, populated only when `duration_type === "MINUTES"`: `timerRemainingMs`, `timerStartedAt`, and a persisted `timerExpired: boolean` flag.
- `$persist`-backed, additive-only shape, single `_v` per D89/D91.

**Timer reuse — `SegmentTimer`:** an existing portable UI module (segment-rotation countdown, built for Singles Training's target rotation) is reused unmodified for Score Training's plain countdown:
```typescript
new SegmentTimer({
  totalMinutes: durationValue,
  intervalMinutes: durationValue,   // == totalMinutes, so onSegmentChange never fires — no rotating targets here
  onTick: (secondsLeft) => { /* drives store.timerRemainingMs display */ },
  onComplete: () => { /* store.timerExpired = true — signal only, no side effects */ },
})
```
Because `intervalMinutes === totalMinutes`, the segment-change branch (`remaining % intervalSeconds === 0 && remaining > 0`) never fires; only `onComplete` triggers, with its built-in audible cue. `onComplete` never force-ends the session directly — it only flips `store.timerExpired`, which the engine checks between visits (see below), preserving "let the current visit finish."

Note: `SegmentTimer` exposes `start()/stop()/reset()` but no `destroy()`, unlike the `start()/stop()/destroy()` lifecycle documented in `07-Frontend/04-Modules-And-OOP.md` for timer-owning modules. Since this module is adopted as-is rather than authored fresh, `play.data.ts`'s Alpine teardown calls `stop()` in place of `destroy()` — a documented deviation, not a code change to the module.

**Engine module** (`modules/game/score-training.engine.module.ts` — new class, per `*.engine.module.ts` OOP pattern):
```typescript
class ScoreTrainingEngine {
  constructor(opts: { durationType: "ROUNDS" | "MINUTES"; durationValue: number; maxDartsPerTurn: number });
  recordVisit(score: number): TurnFactDraft;     // mints clientKey + sequence, appends internally
  isComplete(turnsSoFar: number, timerExpired: boolean): boolean;
  currentTotal(): number;
  currentAverage(): number;                       // total / visits so far — display only, never persisted
}
```
- Pure TypeScript — no Alpine, no `@client/api`, per the OOP boundary rules.
- `isComplete()`: `ROUNDS` → `turnsSoFar >= durationValue`; `MINUTES` → `timerExpired && turnsSoFar >= 1` (the `>= 1` guard prevents a zero-turn session if the timer expires before the first visit completes — see Edge Cases).
- Checked only immediately after `recordVisit()` closes out a visit — never mid-input, which is what makes "let the current visit finish" hold.

**Payload module** (`modules/game/score-training.payload.module.ts` — function, not class, per the "prefer functions" guidance for payload modules):
- `buildEventsBatch(turns): EventsBatchRequest` — wraps all recorded turns into a single `StageFact` (`stageTypeKey: "EXERCISE_BLOCK"`, no `parentClientKey`), each `TurnFact` with `darts: []`.

**Data component** (`pages/games/score-training/play/play.data.ts`):
- `x-data="scoreTrainingPlay()"` orchestrates: visit-entry submit → `engine.recordVisit()` → push to store → `engine.isComplete()` check → if done: `buildEventsBatch()` → `POST .../events/batch` (session still `ACTIVE`) → on success `PATCH` status `completed` → navigate to results, reading the final total/average from the store (no extra fetch needed — RECREATIONAL sessions have no finer-grained server data than what the client already holds).

**Pages:**
- `pages/games/score-training/setup/index.astro` — config screen: `GET /api/configuration-templates?gameType=SCORE_TRAINING` for the preset picker; duration value editable, scoring/players shown-and-locked (per the raw notes' config table); `POST /api/sessions` on start.
- `pages/games/score-training/play/index.astro` — single numeric visit-score input, progress display ("visit 4 of 10" for `ROUNDS`, countdown for `MINUTES`), running total.
- `pages/games/score-training/results/index.astro` — final total + average, read from the store post-completion.

Recovery follows the standard D88 auto-cleanup: on load, `GET /api/sessions/active` vs. local store `sessionId` — mismatch auto-abandons, no user prompt.

### 4. Testing

**Backend** (Vitest, `app/tests/`, mirroring `app/src/`):
- `services/rulesets/score-training/score-training.validator.test.ts` — config bounds per mode, batch validation (non-empty `darts[]` rejected, `ROUNDS` turn-count ceiling enforced, `MINUTES` has none).
- `services/session.service.test.ts` — ownership, `409` on completed-session writes, idempotency replay (same key/hash → stored result; same key/different hash → `409`).
- `repositories/session.repository.test.ts` — mocked Neon client, parameterized query shape.

**Frontend:**
- `modules/game/score-training.engine.module.test.ts` — `isComplete()` for both modes including the timer-expired-mid-visit case, `currentAverage()` rounding.
- `modules/game/score-training.payload.module.test.ts` — batch shape (`darts: []`, correct `clientKey`/sequence, single flat `EXERCISE_BLOCK` stage).
- `stores/game.store.test.ts` — persistence shape, `_v` mismatch discard.
- `.astro` pages: no test runner exists for these (D101) — verified manually via `/run` after implementation.

### 5. Edge cases

- Visit score entry: 0–180 per visit (theoretical single-visit max); no "bust," no wrong-target concept, per the raw notes.
- `ROUNDS` mode ends at exactly `duration_value` visits — no early-finish path.
- `MINUTES` mode with a `duration_value` small enough that the timer could expire before visit 1 completes: the engine's `turnsSoFar >= 1` guard blocks completion until at least one visit is recorded, avoiding a zero-turn session.
- Batch-write network failure at session-complete: handled by the existing generic completed-batch outbox (D90) with the same idempotency key — no Score-Training-specific handling needed.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol, at implementation time:
- `05-Database/10-Database-Agent-Guide.md` — no change needed; the "Add a new game type" procedure already covers this, and no new table/column/view is introduced.
- `06-API/00-Overview.md` / `04-Endpoint-Contracts.md` / `03-Shared-Conventions.md` — no change; this design implements the existing frozen contract, it does not extend it.
- `07-Frontend/00-Overview.md` and handbook — no rule changes anticipated; the store/engine/payload patterns already documented are being implemented as specified, not altered. If implementation surfaces a real gap (e.g. the `SegmentTimer` `destroy()` naming deviation proving awkward in practice), that goes through the self-learning gate before any doc edit.
- `DECISIONS.md` — new entry at implementation time recording that Score Training is the first fully-implemented game engine (service/repository/routes/store/engine/payload/pages), and that it establishes the ruleset-validator-registry pattern in code for the first time.
- `graphify-out/graph.json` — refresh via `scripts/refresh-graph.sh` once real code lands (this spec itself is docs-only, no code yet).
- This spec is docs-only; no schema/API/frontend code changes ship in this task. Implementation is the next phase (`writing-plans`), on a dedicated branch, PR to `main` on completion.
