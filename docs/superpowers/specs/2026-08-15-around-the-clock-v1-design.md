<!--
status: canonical
scope: around-the-clock-v1-design
read-when: implementing or reviewing Around the Clock v1
updated: 2026-08-15
-->

# Around the Clock V1 — Design Spec

## Summary

New single-player game type: walk a fixed 21-target path (1 → 20 → BULL). Any hit on the current target's number — single, double, or treble — advances to the next target **immediately**, mid-visit: a lucky 3-dart visit can clear several numbers in one turn (classic pub-rule Around the Clock, not the fixed-target-per-visit shape Singles Training/Shanghai use). BULL requires one hit, outer or inner. Hitting BULL ends the session immediately, even mid-visit with darts still in hand. No bust, no fail condition in v1 — misses simply don't advance.

Source: `docs/game-rules/rulesets/around-the-clock.md` (non-canonical). Its "visit = up to 3 darts" + "any dart in the segment advances" phrasing is the classic mid-visit-advance rule, confirmed with the product owner over the alternative (locking a visit to one target, like existing engines).

## Scope

**V1 ships:**

- Single player
- Fixed path 1 → 20 → BULL, low-to-high, no order config
- Any segment (single, double, or treble) of the current number counts as a hit
- BULL: one hit, outer or inner bull
- Hit advances the target immediately, within the same visit
- Session ends immediately on the BULL hit, regardless of darts remaining in that visit
- Visits are up to 3 darts; a visit with no further hit closes at 3 darts as usual
- Config screen shown with zero editable settings (locked preset)
- Track turns to completion, hit ratio, hit type per target — all derived, nothing stored
- DETAILED_DARTS capture only (tap-based S/D/T/Bull/Bullseye/Miss input, no coordinate board)

**Deferred (not this branch):** multiplayer, high→low/other paths, doubles-only/trebles-only segment locks, Intermediate/Hard/Pro difficulty and their fail behavior, VISUAL_BOARD input, match structure.

## Persistence shape (Hard Invariant)

- Capture mode: `RECREATIONAL`; input mode: `DETAILED_DARTS`
- Stage type: one `EXERCISE_BLOCK` stage (matches Singles Training, Shanghai, Bob's 27)
- Turns: one `TurnFact` per visit, up to 3 `DartFact`s each. Unlike every prior engine, a turn can close at **fewer than 3 darts permanently** (not just "currently open") when the BULL dart resolves the session early — `completedAt` is still stamped on that dart, same as any other resolving dart.
- Dart facts: `intendedTargetNumber`/`intendedZoneKey` both `null` on every dart, same convention as Singles Training/Shanghai. This is a deliberate choice, not an oversight: although the active target can now change *within* a turn (a real difference from those two engines, where one visit always aims at one fixed, index-recoverable target), the target at any point in the fact log is still exactly recoverable by replaying `facts()` through the reducer up to that dart — the same "store facts, derive meaning" guarantee `deriveState()` already provides, just applied per-dart instead of per-visit. Storing a per-dart `intendedTargetNumber` was considered and rejected: `chk_dart_target_consistency` (migration `0007`) rejects a non-null target with a null zone, and "any of single/double/treble" has no single zone to store — the same reason Singles Training leaves both null. `score` is the dart's real board value (`boardScore(hitTargetNumber, hitZoneKey)`), independent of hit/miss.

## Database (seed-only, no schema migration)

New seed `database/seeds/0010_around_the_clock_game_engine_reference.sql`:

- `game_types` row — implementation key `AROUND_THE_CLOCK`
- `ruleset_versions` row — implementation key `AROUND_THE_CLOCK_V1`
- `configuration_templates` — one system preset, `configuration: {}` (zero settings)
- `ruleset_version_capabilities` row — `(AROUND_THE_CLOCK_V1, RECREATIONAL, DETAILED_DARTS)`, appended to seed `0007`'s running ledger (not a duplicate insert in `0010` — same convention as Shanghai/121)
- Verification script mirroring `database/verification/0007_capability_seed_checks.sql`

`database/README.md`'s Seed Order and verification-script table updated for `0010`.

No `game_type_features` rows needed.

## Config schema

`app/src/lib/game/rulesets/types.ts`:

```ts
export const AroundTheClockConfig = z.object({}).strict();
export type AroundTheClockConfigData = z.infer<typeof AroundTheClockConfig>;
export type AroundTheClockSnapshot = {}; // no fields — nothing to carry
```

`RulesetVersionKey` gains `"AROUND_THE_CLOCK_V1"`; `RULESET_CONFIGS` and `ConfigSnapshotFor` gain matching entries.

`app/src/lib/game/rulesets/capabilities.ts`: `AROUND_THE_CLOCK_V1: [DETAILED_DARTS]`.

## Engine (`modules/game/around-the-clock.engine.module.ts`)

Fixed path via `numbersPath()` (targets 0..20, index 20 = BULL).

```ts
type AroundTheClockState = {
  targetIndex: number; // 0..20 — current active target; 20 = BULL
  dartsThisVisit: number; // 0..2, darts thrown in the open visit
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`isAroundTheClockHit(target, observation)` — cannot reuse `board-progression.module.ts`'s `isHitOn()` for the BULL case: it requires `INNER_BULL` only (doubles-path semantics), but this game accepts either bull ring.

- NUMBER target: `observation.hitTargetNumber === target.number && observation.hitZoneKey !== "MISS"` (any single/double/treble counts, matching `isHitOn`'s own NUMBER-kind branch — reused as-is for this case)
- BULL target: `observation.hitTargetNumber === BULL_TARGET_NUMBER && (observation.hitZoneKey === "OUTER_BULL" || observation.hitZoneKey === "INNER_BULL")`

`applyAroundTheClockDart(state, observation)`:

- Throws if called when `status !== "IN_PROGRESS"` (standard contract).
- `hit = isAroundTheClockHit(targetAt(numbersPath(), state.targetIndex), observation)`.
- If `hit` and `state.targetIndex === 20`: return `{ targetIndex: 20, dartsThisVisit: 0, status: "COMPLETE" }` immediately — the visit ends right here regardless of `dartsThisVisit`, and no further darts are recorded for it.
- Otherwise, `nextTargetIndex = hit ? state.targetIndex + 1 : state.targetIndex`, `dartsThisVisit += 1`. If `dartsThisVisit` reaches 3, the visit closes (`dartsThisVisit` resets to 0); otherwise it stays open. `targetIndex` always reflects `nextTargetIndex`, whether or not the visit itself closed — this is what makes advancement mid-visit possible.

`AroundTheClockEngine implements GameEngine<DartObservation, AroundTheClockState>` — same shape as `ShanghaiEngine`: `record`/`undo`/`wouldComplete`/`isComplete`/`state`/`facts`/`create(config, prior)`. Unlike Shanghai/Singles Training, `wouldComplete` needs **no** dart-position gating (no `dartsThisVisit < 2` short-circuit) — a BULL hit completes the session on any dart of a visit, not only the 3rd. It applies the reducer to a hypothetical observation and checks `after.status !== "IN_PROGRESS"`, same pattern otherwise.

`undo()` is the exact inverse of `record()` over `facts()`, unbounded depth, replayed the same way as every other engine (Pattern 18) — since `deriveState()` folds from an empty log on every call, popping the last dart fact and re-deriving naturally reconstructs the pre-hit `targetIndex`, including reopening a visit that had closed early via `COMPLETE`.

Registered in `modules/game/engine.registry.ts` under `AROUND_THE_CLOCK_V1`. Server-side validator under `services/rulesets/around-the-clock/`, registered in `services/rulesets/registry.ts` in the same commit (per `app/CLAUDE.md`'s atomicity rule), enforcing DETAILED_DARTS only.

## Frontend

Reuses existing components with no changes:

- `SinglesRecreationalInput.astro` and `VisitPreview.astro` bind to Alpine method names (`recordTap`, `isBullVisit`, `currentTargetLabel`, `undoVisit`, `finished`) — the Around the Clock play-data module exposes the same surface, with `isBullVisit()` reading `state().targetIndex === 20`. No new input/preview markup.

New files, mirroring the Shanghai/Singles Training shape:

- `components/layout/games/interfaces/AroundTheClock.astro` — `SinglePlayerDisplay` (current target label, e.g. "12" or "Bull") + a turns-so-far stat row.
- `components/layout/games/setup/AroundTheClockSetupForm.astro` — `SetupShell` + `UserSection` + `InfoSection` only, zero settings (mirrors Shanghai/Bob's 27).
- `components/layout/games/result-modals/AroundTheClockResults.astro` — "Session complete" (always — no win/loss framing, the session only ends by finishing the clock); shows turns to completion and hit ratio, both computed from `resultsSnapshot` at completion time.
- `pages/games/around-the-clock/setup/index.astro`, `pages/games/around-the-clock/play/index.astro`
- `lib/game/around-the-clock-setup.data.ts`, `lib/game/around-the-clock-play.data.ts` — mirror `shanghai-setup.data.ts`/`shanghai-play.data.ts`, reusing `play-lifecycle.ts`.
- New `games-visibility.ts` card entry (`AROUND_THE_CLOCK_V1`, RECREATIONAL-only, no ANALYTICS pair).

Turns-to-completion and hit ratio are both folded from `facts()` at render time (turn count; hits / total darts across all turns) — never stored on the engine or in a fact.

## Testing

- Engine unit tests: reducer + class — record/undo/wouldComplete/rehydrate; mid-visit advance (a visit that clears 2+ numbers on one turn); a visit that closes at 3 darts with no advance; BULL completion on dart 1, 2, and 3 of a visit, confirming no dart is recorded past the resolving one; undo reopening a visit that had closed early via `COMPLETE`; throws once terminal.
- Setup/play data tests mirroring the Shanghai suite.
- Capability/validator parity test extension for `AROUND_THE_CLOCK_V1`.
- `bash scripts/check-game-engines.sh` green.

## Open questions carried from the source doc (not blocking v1)

- Exact fail behavior for Intermediate/Hard/Pro difficulty (retry visit vs. game over) — deferred with those modes themselves.
