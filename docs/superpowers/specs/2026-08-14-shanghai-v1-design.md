<!--
status: canonical
scope: shanghai-v1-design
read-when: implementing or reviewing Shanghai v1
updated: 2026-08-14
-->

# Shanghai V1 — Design Spec

## Summary

New single-player game type: round-by-round target game. Round *n* (n = 1..20) has an active number *n*; three darts per round score only on that number (single = face value, double = 2×, treble = 3×). Hitting single, double, and treble of the active number in one visit (any order) is a **Shanghai** — instant win, session ends immediately. Otherwise the session runs all 20 rounds and ends with a final total score, no win/loss framing.

Source: `docs/game-rules/rulesets/shanghai.md` (non-canonical). Its Features table marked "Rounds 1–20" as v1 and "Rounds 1–7" as TBD, but its Objective/Config prose described a 1–7 default — an internal contradiction. Resolved with the product owner: **v1 ships 1–20** (full board). The doc's prose sections are non-canonical background, not itself updated by this spec.

## Scope

**V1 ships:**

- Single player
- Rounds 1–20, fixed ascending order, no BULL round
- Config screen shown with zero editable settings (locked preset)
- Single/double/treble of the active number scores; anything else scores 0
- Shanghai instant win
- 3-dart visits, per-round score tracked
- DETAILED_DARTS capture only (tap-based S/D/T/Miss input, no coordinate board)

**Deferred (not this branch):** multiplayer, custom round ranges, disabling instant-win, VISUAL_BOARD input, match structure (first-to-N Shanghai).

## Persistence shape (Hard Invariant)

- Capture mode: `RECREATIONAL`; input mode: `DETAILED_DARTS`
- Stage type: one `EXERCISE_BLOCK` stage (no legs/sets — matches Singles Training, Bob's 27)
- Turns: one `TurnFact` per round, exactly 3 `DartFact`s each (max 20 turns)
- Dart facts: `intendedTargetNumber`/`intendedZoneKey` both `null` on every dart — S/D/T of the active number are equally valid intended outcomes (same reasoning as Singles Training), and the active number is always recoverable from the round index since v1 has no order config. `score` is the dart's real board value (`boardScore(hitTargetNumber, hitZoneKey)`), never the Shanghai-restricted round points.

## Database (seed-only, no schema migration)

New seed `database/seeds/0008_shanghai_game_engine_reference.sql`:

- `game_types` row — implementation key `SHANGHAI`
- `ruleset_versions` row — implementation key `SHANGHAI_V1`
- `configuration_templates` — one system preset, `configuration: {}` (zero settings)
- `ruleset_version_capabilities` row — `(SHANGHAI_V1, RECREATIONAL, DETAILED_DARTS)`
- Verification script mirroring `database/verification/0007_capability_seed_checks.sql`

No `game_type_features` rows needed (no TIMED_MODE/ROUNDS_MODE/etc. apply).

## Config schema

`app/src/lib/game/rulesets/types.ts`:

```ts
export const ShanghaiConfig = z.object({}).strict();
export type ShanghaiConfigData = z.infer<typeof ShanghaiConfig>;
export type ShanghaiSnapshot = {}; // no fields — nothing to carry
```

`RulesetVersionKey` gains `"SHANGHAI_V1"`; `RULESET_CONFIGS` and `ConfigSnapshotFor` gain matching entries.

`app/src/lib/game/rulesets/capabilities.ts`: `SHANGHAI_V1: [DETAILED_DARTS]`.

## Engine (`modules/game/shanghai.engine.module.ts`)

Fixed path: rounds 1–20 via `numbersPath()` — the engine never indexes past `targetIndex === 19` (index 20, BULL, is simply unreachable; no order/config drives this).

```ts
type ShanghaiState = {
  targetIndex: number; // 0..19 — round n = targetIndex + 1
  totalScore: number;
  dartsThisVisit: (DartZoneKey | null)[]; // this visit's raw hit zone, or null for miss/off-target
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE";
};
```

`applyShanghaiDart(config, state, observation)`:

- A hit on the active number (`observation.hitTargetNumber === target.number`) in any of `SINGLE`/`INNER_SINGLE`/`OUTER_SINGLE`/`DOUBLE`/`TREBLE` adds `boardScore(target.number, zone)` to `totalScore` and appends that zone to `dartsThisVisit`.
- Anything else (wrong number, BULL, MISS) adds 0 and appends `null`.
- On the visit's 3rd dart: derive the set of zone *kinds* hit (single-ish/DOUBLE/TREBLE, using the same `SINGLE_ZONE_KEYS` bucket Singles Training uses) from `dartsThisVisit`. If all three kinds are present → `status: "SHANGHAI"` (terminal, instant win). Else if `targetIndex === 19` → `status: "COMPLETE"` (terminal). Else advance `targetIndex`, reset `dartsThisVisit`.
- Throws if called when `status !== "IN_PROGRESS"` (same contract as every other engine).

`ShanghaiEngine implements GameEngine<DartObservation, ShanghaiState>` — same shape as `SinglesTrainingEngine`/`Bobs27Engine`: `record`/`undo`/`wouldComplete`/`isComplete`/`state`/`facts`/`create(config, prior)`. `wouldComplete` mirrors the others: only a visit's 3rd dart can resolve, so it short-circuits when `dartsThisVisit.length < 2`.

Registered in `modules/game/engine.registry.ts` under `SHANGHAI_V1`. Server-side validator under `services/rulesets/shanghai/`, registered in `services/rulesets/registry.ts`, enforcing DETAILED_DARTS only.

## Frontend

Reuses existing components with no changes:

- `SinglesRecreationalInput.astro` and `VisitPreview.astro` bind to Alpine method names (`recordTap`, `isBullVisit`, `currentTargetLabel`, `undoVisit`, `finished`) — the Shanghai play-data module exposes the same surface, with `isBullVisit()` always `false`. No new input/preview markup.

New files, mirroring the Singles Training/Bob's 27 shape:

- `components/layout/games/interfaces/Shanghai.astro` — `SinglePlayerDisplay` (running `totalScore`) + stat row "Round n/20"; Singles Training's Misses/Singles/Doubles/Trebles stat rows don't apply here.
- `components/layout/games/setup/ShanghaiSetupForm.astro` — `SetupShell` + `UserSection` + `InfoSection` only, zero settings (mirrors Bob's 27/Doubles Training).
- `components/layout/games/result-modals/ShanghaiResults.astro` — title "Shanghai!" when `resultsSnapshot.status === "SHANGHAI"`, else "Session complete"; shows total score and round reached.
- `pages/games/shanghai/setup/index.astro`, `pages/games/shanghai/play/index.astro`
- `lib/game/shanghai-setup.data.ts`, `lib/game/shanghai-play.data.ts` — mirror `singles-training-*.data.ts`, reusing `play-lifecycle.ts`.
- New `games-visibility.ts` card entry.

## Testing

- Engine unit tests: reducer + class — record/undo/wouldComplete/rehydrate; Shanghai detection across every dart order (S-D-T, D-T-S, T-S-D, etc.) and non-triggering combinations (e.g. two singles + a treble); completion at round 20 without a Shanghai; throws once terminal.
- Setup/play data tests mirroring the Singles Training suite.
- Capability/validator parity test extension for `SHANGHAI_V1`.
- `bash scripts/check-game-engines.sh` green.

## Open questions carried from the source doc (not blocking v1)

- Multiplayer tie-break when two players Shanghai in the same round (source doc: "usually first in order") — deferred with multiplayer itself.
