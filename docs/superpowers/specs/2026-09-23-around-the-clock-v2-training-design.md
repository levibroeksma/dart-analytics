# Around the Clock V2 — Training Variants Design

Status: approved (brainstorming). Scope: config, engine, validator, setup/play UI, seeds, routine eligibility, docs for a new ruleset version `AROUND_THE_CLOCK_V2`. Delivered as two PRs (§11).

Source: `docs/game-rules/rulesets/around-the-clock.md` (V2 rows, amended 2026-09-23), `app/src/modules/game/around-the-clock.engine.module.ts`, `app/src/lib/game/rulesets/types.ts:325`, `docs/superpowers/specs/2026-09-12-singles-training-accuracy-mode-design.md` (new-ruleset-version precedent), `app/src/modules/game/tuod.engine.module.ts` + `app/src/lib/game/play-countdown.ts` (MINUTES precedent), `docs/architecture/09-Training/01-Routines.md` §11, `app/src/services/routines/game-step.ts`.

## 1. Scope & Non-Goals

**In scope:** path direction (low → high, high → low), odds first (combinable with either direction), segment rule (any, outer single only), difficulty (Easy, Intermediate = 1, Hard = 2, Pro = 3 hits per visit) with step back on a failed visit, a timed run (3–30 min, default 10) with clock restart, standalone setup/play, and routine eligibility with three seeded GAME templates.

**Seats:** solo and guest 1v1 run on V2. Timed is solo-only (UI-enforced, TUOD/Score Training precedent — `tuod-setup.data.ts:133`). Seating a DartBot resolves the session to `AROUND_THE_CLOCK_V1` with every toggle reset (Singles V3 pattern).

**Non-goals (deferred):** timed 1v1 (rules file V2+); DartBot on V2 (needs an outer-single / step-back strategy); a laps / furthest-target trend statistic — V2 darts flow into the existing generic statistics only; per-step routine configuration (a routine step sets minutes only; reverse / odds first stay standalone-only until that exists); any change to `AROUND_THE_CLOCK_V1` behaviour; lose-the-game on failure (V2+).

## 2. Persistence proof (Hard Invariant)

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and ANALYTICS + VISUAL_BOARD, as V1. `segment_rule = OUTER_SINGLE` is valid only under ANALYTICS + VISUAL_BOARD — keypad records an unbanded `SINGLE` (`app/src/modules/game/types.ts:318`).
- **Stage type:** one `EXERCISE_BLOCK` per seat (`PER_SEAT`), unchanged. No stage per lap or per target.
- **`turns` / `darts`:** one `turns` row per visit (≤3 darts), one `darts` row per throw; intended target and ring stay **null**, as V1 — the target is recoverable from the path, config and dart order. `score` = board score.
- **Derived, never stored:** current target, laps, step-backs, hits this visit, result. Only timer expiry is non-derivable; it enters through `expireTimer()` like TUOD, persisted client-side as `game.timerExpired`.

## 3. Config / Data Model

`app/src/lib/game/rulesets/types.ts` — new schema; V1's empty `AroundTheClockConfig` is untouched (D243/D245/D247: never widen a shipped version in place):

```ts
export const AroundTheClockV2Config = z
  .object({
    path_direction: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW"]),
    odds_first: z.boolean(),
    segment_rule: z.enum(["ANY", "OUTER_SINGLE"]),
    difficulty: z.enum(["EASY", "INTERMEDIATE", "HARD", "PRO"]),
    duration_type: z.enum(["UNTIMED", "MINUTES"]),
    duration_value: z.number().int().nullable(),
  })
  .strict()
  .superRefine(/* MINUTES ⇒ 3..30; UNTIMED ⇒ null */);
```

`duration_type`/`duration_value` reuse the key names every timed game uses, so the routine hook's `minutesInto` (`game-step.ts`) writes them unchanged. Bounds live in a new `@lib/game/around-the-clock-duration.ts` (`aroundTheClockDurationBounds()` → `{ min: 3, max: 30 }`), shared by the schema, setup form and routine hook.

`RulesetVersionKey`, `RULESET_CONFIGS`, `ConfigSnapshotFor` gain `AROUND_THE_CLOCK_V2`. Snapshot:

```ts
export type AroundTheClockV2Snapshot = {
  pathDirection: "LOW_TO_HIGH" | "HIGH_TO_LOW";
  oddsFirst: boolean;
  segmentRule: "ANY" | "OUTER_SINGLE";
  difficulty: "EASY" | "INTERMEDIATE" | "HARD" | "PRO";
  durationType: "UNTIMED" | "MINUTES";
  durationValue: number | null;
};
```

No stored `target_order`: the path is a pure function of `pathDirection` + `oddsFirst`.

## 4. Engine (`around-the-clock.engine.module.ts`)

Config widens to `Seated<AroundTheClockSnapshot> | Seated<AroundTheClockV2Snapshot>`; a presence-check helper (`v2Of(config)`, mirroring Singles' `scoringModeOf`) supplies V1-equivalent defaults (`LOW_TO_HIGH`, `false`, `ANY`, `EASY`, `UNTIMED`) so V1 stays byte-identical.

**Path** — `board-progression.module.ts` gains `clockPath(direction, oddsFirst)` returning an order array for `numbersPath(order)`: `LOW_TO_HIGH` 1…20; `HIGH_TO_LOW` 20…1; odds first 1,3…19,2…20 / 19…1,20…2; bull always last.

**Hit** — `ANY`: existing `isAroundTheClockHit`. `OUTER_SINGLE`: number target ⇒ right number and `OUTER_SINGLE`; bull ⇒ either bull ring.

**Seat state** gains `laps: number` and `hitsThisVisit: number` (derived state only; V1 always reads `laps = 0`).

**Reducer** (`applyAroundTheClockDart`, takes the resolved rules):
- **Easy:** V1 behaviour on the configured path — a hit advances immediately, mid-visit.
- **Intermediate / Hard / Pro:** the target is fixed for the visit. On the visit's 3rd dart: `hitsThisVisit >= 1/2/3` ⇒ advance one; else step back one, floored at index 0. From the bull a step back returns to the path's last number.
- **Path end** (bull passed): untimed ⇒ seat `COMPLETE` (V1 rule). Timed ⇒ `laps + 1`, `targetIndex = 0`, and the visit closes on that dart — the next dart opens a new visit on the first target. (Same short-visit mechanics V1 already uses for its completing dart.)
- The floor is index 0 of the current lap; laps never decrement.

**Timed completion:** `private timerExpired = false` + `expireTimer()`, as TUOD. A timed seat is `COMPLETE` when `timerExpired`, it has ≥1 closed visit, and it has no open visit — the visit in progress finishes first (rules file, Ends when). `record()` stamps `completedAt` on the lap-closing dart as it does on V1's completing dart.

**Outcome:** untimed — V1's `scoreCompareOutcome(..., "LOWEST")` on darts. Timed is solo-only, so no timed comparison is needed.

New factory `aroundTheClockV2EngineFactory` (`rulesetVersionKey: "AROUND_THE_CLOCK_V2"`, `PER_SEAT`); the engine class takes the key as a constructor arg, as `SinglesTrainingEngine` does.

## 5. Validator

`around-the-clock.validator.ts` gains `aroundTheClockV2Validator`, composed over `createThreeDartValidator` exactly as `singlesTrainingV3Validator`: rejects `segment_rule = OUTER_SINGLE` unless `isVisualBoardCapture(...)`. Registered in `services/rulesets/registry.ts`.

## 6. Capabilities & seats

- `capabilities.ts`: `RULESET_CAPABILITIES.AROUND_THE_CLOCK_V2 = [DETAILED_DARTS, VISUAL_BOARD]`; no `RULESET_DARTBOT` entry.
- `session-seats.service.ts`: `SEAT_CAPS.AROUND_THE_CLOCK_V2 = 2`.
- `games-visibility.ts`: the listing row points at `AROUND_THE_CLOCK_V2`.

## 7. Setup UI

`AroundTheClockSetupContext` gains `pathDirection`, `oddsFirst`, `segmentRule`, `difficulty`, `durationType`, `durationValue`. `around-the-clock-setup.data.ts` moves from the bare preset controller to a ctx-dependent key and overrides (the shape `singles-training-setup.data.ts` used before issue #290): `rulesetVersionKey: (ctx) => botSeated(ctx) ? "AROUND_THE_CLOCK_V1" : "AROUND_THE_CLOCK_V2"`; `configOverrides` sends the six keys on V2 and **nothing** on V1 (V1's config is `.strict()` and empty).

Form rows (`Toggle`, horizontal): Direction (Low → High / High → Low), Odds first (Off / On), Segment (Any / Outer single — wrapped in the `captureModeKey === 'ANALYTICS'` guard, as Singles' Scoring row), Difficulty (Easy / 1 dart / 2 darts / 3 darts), Duration (Untimed / Timed + minutes input 3–30, default 10). `addGuest` forces `UNTIMED`; `addBot` resets every toggle to its default.

## 8. Play data (`around-the-clock-play.data.ts`)

- Snapshot type widens to the V2 union; `resumeEngine` (today pinned to the single `RULESET_VERSION_KEY`) accepts either key and resolves the factory from the stored `rulesetVersionKey`.
- Timed: `startCountdown` / `maybeResumeCountdown` from `play-countdown.ts`, pause toggle and hidden-timer handling as `tuod-play.data.ts`.
- HUD: current target (from the configured path), lap count and remaining time when timed, hits this visit / required when difficulty ≠ Easy.
- Preview segments use the V2 hit rule (outer-single highlight under `OUTER_SINGLE`).
- Results: untimed — V1 results. Timed — laps completed, target at expiry, darts thrown, hit ratio.
- `playAgain` wire object carries the six V2 keys only when replaying a V2 session.

## 9. Seeds & verification

**PR1:** `database/seeds/0027_around_the_clock_v2_game_engine_reference.sql` — one `ruleset_versions` row under the existing `AROUND_THE_CLOCK` game type (next free `0198f100-…` id), no new preset. `seeds/0007` appends `AROUND_THE_CLOCK_V2` × `DETAILED_DARTS`/`VISUAL_BOARD`. `database/verification/0027_around_the_clock_v2_capability_checks.sql` mirrors `0010`'s.

**PR2:** `database/seeds/0028_around_the_clock_routine_templates.sql` — three GAME `exercise_templates` (`0199b000-0000-7000-8000-00000000000b`/`c`/`d`), pinned to `AROUND_THE_CLOCK_V2`:

| Name | `default_configuration` |
| --- | --- |
| Around the Clock — 1 dart | `LOW_TO_HIGH`, odds_first false, `OUTER_SINGLE`, `INTERMEDIATE`, `MINUTES` 10 |
| Around the Clock — 2 darts | same, `HARD` |
| Around the Clock — 3 darts | same, `PRO` |

Verification file asserts the three rows and their pins.

## 10. Routine eligibility (PR2)

V2 meets §11's three conditions once listed: native timed mode, ANALYTICS + VISUAL_BOARD capability, and entries in both tables:
- `ROUTINE_GAME_STEPS.AROUND_THE_CLOCK_V2` — `applyStepDuration: minutesInto`, `minuteBounds: aroundTheClockDurationBounds()`.
- `STEP_ADAPTERS["GAME:AROUND_THE_CLOCK_V2"]` via `gameAdapter`; `step-adapter.registry.test.ts` keeps the two in agreement.

## 11. Delivery

- **PR1 — standalone V2:** §3–§9 (PR1 seeds), rules/doc updates, decision block.
- **PR2 — routine step:** §9 (PR2 seed), §10, `01-Routines.md` §11 eligible list + §Game Exercise implemented note.

## 12. Docs & context

- `docs/game-rules/rulesets/around-the-clock.md`: add to Clock restart that the lap-closing dart closes the visit; `Current version:` → V2 when PR2 ships (the routine-step row is part of V2).
- `decisions/game-engine.md`: new decision — `AROUND_THE_CLOCK_V2` as a new ruleset version; per-visit resolution + step back floored at the lap start; lap-closing dart closes the visit; bot seats resolve to V1.
- `07-Frontend/08-Component-Inventory.md` only if a new component is introduced (none planned).

## 13. Testing

**Engine:** `clockPath` for all four direction × odds-first orders; outer-single hit rule (inner single, double, treble, wrong number ⇒ miss; either bull ring ⇒ hit); Easy on a custom path matches V1 semantics; Intermediate/Hard/Pro advance at exactly N hits and step back below N; floor at index 0 (including after a restart); step back from bull ⇒ last number; untimed bull completion; timed restart increments `laps`, resets to index 0 and closes the visit; timer expiry mid-visit completes only once the visit closes; expiry before any visit does not complete; undo across a lap boundary; V1 snapshot regression (byte-identical state).

**Validator:** schema accepts/rejects each enum and the duration pairing; `OUTER_SINGLE` rejected under keypad, accepted under visual board.

**Setup / play data:** bot ⇒ V1 key and no overrides; guest ⇒ `UNTIMED`; V2 overrides carry all six keys; `playAgain` wire keys only for V2; results show laps when timed.

**Parity (existing, generic):** capabilities vs `seeds/0007`; `ROUTINE_GAME_STEPS` vs `STEP_ADAPTERS`.

## 14. Open Questions

None blocking.
