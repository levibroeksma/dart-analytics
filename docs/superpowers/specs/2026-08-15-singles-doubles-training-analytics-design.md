# Singles & Doubles Training — Analytics Capture (VISUAL_BOARD) — Design

Status: approved (brainstorming). Source: `app/src/lib/game/rulesets/capabilities.ts`,
`app/src/modules/game/{singles,doubles}-training.engine.module.ts`,
`app/src/services/rulesets/{singles,doubles}-training/*.validator.ts`,
`app/src/lib/game/play-lifecycle.ts`, `app/src/lib/game/bobs27-play.data.ts` (VISUAL_BOARD
precedent), `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`,
`docs/superpowers/specs/2026-08-13-{singles,doubles}-training-frontend-design.md` (historical —
both explicitly scoped `VISUAL_BOARD` out, citing the Singles Training RECREATIONAL-only
precedent; this design reverses that for both rulesets).

Single branch, both rulesets: `SINGLES_V1` and `DOUBLES_TRAINING_V1` gain the `ANALYTICS` +
`VISUAL_BOARD` capability pair (board-tap coordinate capture) alongside their existing
`RECREATIONAL` + `DETAILED_DARTS` keypad capture — the exact pair Bob's 27 already declares. They
are mechanically identical (21-target path, same capability shape), so one spec/plan/branch covers
both.

## Why

Both rulesets currently only support keypad capture; neither can be played in Analytics mode
(pointer/coordinate darts, the shape needed for location-based accuracy analysis). Bob's 27 proved
the pattern end-to-end (Phase 2 capability + Phase 4 board UI). This design applies that same
pattern to the two remaining `DETAILED_DARTS`-only training rulesets and, in doing so, generalizes
the one piece of Bob's 27's rollout that was left bespoke rather than shared.

## Scope

In: capability declaration + seed row for both rulesets, validator dispatch (keypad vs board),
engine coordinate-fact fix, a generalized `play-lifecycle.ts` that both rulesets keep using under
either mode, and the play-screen board UI (mirroring `Bobs27.astro`).

Out: any new scoring rule, config field, order-mode change, or `v_*` read-model/reporting view.
Setup pages are unchanged — `resolveSessionModePair`'s own-first-pair fallback and the existing
zero-editable-settings flow already handle a ruleset gaining a second capability pair.

## Capability & validation layer

- `capabilities.ts`: `SINGLES_V1` and `DOUBLES_TRAINING_V1` both become
  `[DETAILED_DARTS, VISUAL_BOARD]`.
- `database/seeds/0007_ruleset_version_capabilities.sql`: append the two new
  `('SINGLES_V1','ANALYTICS','VISUAL_BOARD')` /
  `('DOUBLES_TRAINING_V1','ANALYTICS','VISUAL_BOARD')` rows to the running ledger (same convention
  every prior VISUAL_BOARD/capability addition used); `database/verification/0007_capability_seed_checks.sql`
  updated in lockstep.
- `singles-training.validator.ts` / `doubles-training.validator.ts`: gain the `bobs27.validator.ts`
  shape — an `isDetailedDartsOrVisualBoardCapture` dispatch in `validateConfig`, and `validateBatch`
  branching to the shared `validateVisualBoardTurns` (`visual-board.validator.ts`) under the board
  pair, keeping the existing dartless-turn/negative-score checks under the keypad pair unchanged.
- `games-visibility.ts`/`games-visibility.test.ts`: `SINGLES_V1`'s "first carded-ruleset exception"
  (RECREATIONAL-only) note is now stale for both rulesets — corrected; `supportsCaptureMode`
  requires no code change, only new test cases and the now-true `ANALYTICS` visibility.

## Engine layer

Both `record()` methods currently hardcode `locationX: null, locationY: null` on every dart fact —
correct for a keypad-only engine, but it silently drops the coordinate a board session captures.
Both engines now carry the observation's real `locationX`/`locationY` through to the fact — the
same fix Bob's 27's Phase 2 needed. No other reducer/scoring change: `trainingPointsFor` (Singles)
and `isHitOn` (Doubles) already key off `hitTargetNumber`/`hitZoneKey`, not capture mode. Singles
Training's `intendedTargetNumber`/`intendedZoneKey`-always-`null` convention is a scoring-semantics
choice (all three rings are equally valid intentional outcomes), independent of how the dart was
captured, and stays unchanged.

## Shared lifecycle — generalizing `play-lifecycle.ts`

Bob's 27 stayed bespoke (not on `play-lifecycle.ts`) specifically because `VISUAL_BOARD` needs two
things the shared module didn't have: the board-tap DOM bridge (`boardInputData`) and a 1.5s
reveal-then-clear timer on a resolved visit's markers. With a second and third ruleset now needing
exactly that shape, `play-lifecycle.ts` is generalized rather than re-forked:

- `PlayLifecycleContext` (`lib/game/types.ts`) gains an optional
  `hiddenTimer?: ReturnType<typeof setTimeout> | null`.
- `playCommitDart` gains Bob's 27's reveal-then-clear gate: when a visit resolves
  (`resolvedTurn.completedAt` set) and `context.$store.game.inputModeKey === "VISUAL_BOARD"`, any
  still-pending `hiddenTimer` is cleared and a new one is set to assign `hiddenTurnKey` after 1.5s;
  otherwise (today's behavior) `hiddenTurnKey` is set immediately. This is purely additive — every
  current `play-lifecycle.ts` consumer (Shanghai, 121, Around the Clock) never has
  `inputModeKey === "VISUAL_BOARD"`, so their behavior is byte-identical.
- New shared `playVisitMarkers(context)` in `play-lifecycle.ts`, extracted from Bob's 27's
  per-ruleset `visitMarkers` override (`markersForTurns`, hidden once the last turn's `clientKey`
  matches `hiddenTurnKey`) — Singles/Doubles Training reuse it instead of hand-rolling it; Bob's 27
  itself is not touched (out of scope — behavior-preserving refactor of a working module is not
  this task's job).
- `singles-training-play.data.ts` / `doubles-training-play.data.ts` each spread
  `...boardInputData((observation) => self.recordDart(observation))` and add a
  `recordDart(observation)` entry point beside their existing `recordTap`, exactly mirroring
  `bobs27-play.data.ts`'s `self`-closure pattern (needed so `boardInputData`'s `onCommit` callback
  reaches the live, reactive `this`). Both keep calling `playCommitDart`/`playUndoVisit`/etc. from
  `play-lifecycle.ts` unchanged — only the new `recordDart` entry point and the `boardInputData`
  spread are additive.

## Frontend

- `SinglesTraining.astro` / `DoublesTraining.astro`: add `BoardInputPanel` alongside the existing
  recreational input component, with the existing input gated
  `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` — the exact `Bobs27.astro` structure.
  `previewSegments()`/marker rendering reuse the new `playVisitMarkers` where the component reads
  `visitMarkers()`.
- Setup pages/forms: unchanged. Both already reconcile against
  `resolveSessionModePair(rulesetVersionKey, settings)`, which already falls back correctly for a
  ruleset with more than one declared pair.

## Testing

Vitest, mirroring Bob's 27's and each ruleset's existing suites:

- `singles-training.engine.module.test.ts` / `doubles-training.engine.module.test.ts` — new cases
  asserting `record()` preserves a non-null `locationX`/`locationY` from the observation.
- `singles-training.validator.test.ts` / `doubles-training.validator.test.ts` — new
  `ANALYTICS + VISUAL_BOARD` cases (config acceptance, `validateVisualBoardTurns` delegation,
  location/zone/score mismatch rejection) mirroring `bobs27.validator.test.ts`.
- `play-lifecycle.test.ts` — new cases for the reveal-timer branch in `playCommitDart` (fires only
  under `VISUAL_BOARD`, clears a still-pending timer on a fast second resolution) and for
  `playVisitMarkers`, against the existing ruleset-agnostic fake engine.
- `singles-training-play.data.test.ts` / `doubles-training-play.data.test.ts` — new `recordDart`
  cases mirroring `bobs27-play.data.test.ts`'s board-input coverage.
- `capability-seed-parity.test.ts`, `capability-validator-parity.test.ts`,
  `games-visibility.test.ts` — regenerated/extended for the new pairs.

No `.astro` component tests (project convention, D101).

## Decisions

`play-lifecycle.ts` was deliberately scoped to exclude `VISUAL_BOARD`-shaped rulesets (D209's own
history note: "Bob's 27/501/Score Training stay out — different `VISUAL_BOARD`/`ScoreInputBuffer`
shapes"). Generalizing it to support board input now that a second/third ruleset needs that exact
shape is a boundary reversal, not a mechanical extension — needs a new `decisions/game-engine.md`
entry (`Supersedes: D209`) recorded at implementation time via the `context-maintenance` skill. The
capability addition itself (declaring a second mode pair per ruleset) reuses D196/D198 unchanged
and needs no new entry.

## Out of scope / deferred

- No schema/migration change: `location_x`/`location_y` columns and `chk_dart_location_pair`
  already exist (migration `0018`).
- No change to Bob's 27's own `visitMarkers`/`commitDart` — `playVisitMarkers` is additive, not a
  forced migration of a working bespoke module.
- No `v_*` read-model/analytics-view work — a separate, unrelated scope (reporting over the fact
  data this capture mode produces), not addressed here.
