# 121, Shanghai, Around the Clock — Analytics Capture (VISUAL_BOARD) — Design

Status: approved (precedent-driven, see Decisions). Source: `app/src/lib/game/rulesets/capabilities.ts`,
`app/src/modules/game/{one-twenty-one,shanghai,around-the-clock}.engine.module.ts`,
`app/src/services/rulesets/{one-twenty-one,shanghai,around-the-clock}/*.validator.ts`,
`app/src/lib/game/play-lifecycle.ts`, `app/src/lib/game/five-oh-one-play.data.ts` (QUICK_SCORE +
VISUAL_BOARD precedent), `app/src/lib/game/singles-training-play.data.ts` (DETAILED_DARTS +
VISUAL_BOARD precedent, shipped one task prior on this same context-map entry),
`docs/superpowers/specs/2026-08-15-singles-doubles-training-analytics-design.md`.

Single branch, three rulesets: `121_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1` each gain the
`ANALYTICS` + `VISUAL_BOARD` capability pair (board-tap coordinate capture) alongside their
existing keypad/tap capture. This is the deferred gap the immediately-prior context-map entry
(1.7.46) explicitly flagged: "its pre-existing gap versus the live 12-row seed
(`SHANGHAI_V1`/`121_V1`/`AROUND_THE_CLOCK_V1` untracked) is left untouched, per minimal-diffs."
`one-twenty-one-play.data.ts` already carries a `self` closure and a comment anticipating this
exact task ("121 has no board input, so no closure actually needs it yet, but `init()` assigning
it keeps the two play-data modules structurally parallel for future board-capture work").

## Why

All three rulesets currently support only their original capture mode; none can be played in
Analytics mode (pointer/coordinate darts). Bob's 27 (Phase 2/4) and the Singles/Doubles Training
rollout already proved this pattern twice — once for `DETAILED_DARTS`-shaped engines, once for
generalizing `play-lifecycle.ts`. 501/Score Training proved the `QUICK_SCORE`-shaped variant. This
design applies the already-proven pattern a third time, to the three rulesets left out.

## Scope

In: capability declaration + seed row for all three rulesets; validator dispatch (existing capture
vs board); the coordinate-carrying fact fix **only where missing**; play-screen board UI wiring.

Out: any new scoring rule, config field, or `v_*` read-model/reporting view. Setup pages are
unchanged — `resolveSessionModePair`'s own-first-pair fallback and each ruleset's existing
zero-editable-settings flow already handle a ruleset gaining a second capability pair.

The three rulesets split into two genuinely different shapes and are treated accordingly:

### Group A — Shanghai, Around the Clock (`DETAILED_DARTS` + `VISUAL_BOARD`)

Both already take `DartObservation` as their `record()` input and already carry the observation's
real `locationX`/`locationY` into the dart fact (verified by reading both engine modules — neither
has the D189/D211-class coordinate bug Singles/Doubles Training had). Both already sit on
`play-lifecycle.ts`, which is already generalized (hidden-timer reveal-then-clear,
`playVisitMarkers`) from the Singles/Doubles Training task. This group is a byte-for-byte mirror of
that task's frontend/validator/capability/seed changes, minus the engine fix and minus any further
`play-lifecycle.ts` change (already done):

- `capabilities.ts`: `SHANGHAI_V1` and `AROUND_THE_CLOCK_V1` become `[DETAILED_DARTS, VISUAL_BOARD]`.
- `shanghai.validator.ts` / `around-the-clock.validator.ts`: gain the `singles-training.validator.ts`
  shape — `isDetailedDartsOrVisualBoardCapture` dispatch in `validateConfig`, `validateBatch`
  branching to `validateVisualBoardTurns` under the board pair, with the existing
  dartless-turn/negative-score checks kept for the keypad pair (Around the Clock's validator
  currently has no such per-dart checks beyond Shanghai's shape — mirror whichever checks each
  file already has, don't invent new ones).
- `shanghai-play.data.ts` / `around-the-clock-play.data.ts`: add the `self` closure, a
  `recordDart(observation)` entry point delegating to `commitDart`, the
  `...boardInputData((observation) => self.recordDart(observation))` spread, and a
  `visitMarkers()` override delegating to `playVisitMarkers(this)` — the exact diff
  `singles-training-play.data.ts` already carries.
- `Shanghai.astro` / `AroundTheClock.astro`: add `BoardInputPanel`, gate the existing
  `SinglesRecreationalInput` behind `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` +
  `x-cloak` — the exact `SinglesTraining.astro` diff.
- `types.ts`: both `*PlayContext` types gain `hiddenTimer`, `visitMarkers()`, `recordDart()` —
  mirroring `SinglesTrainingPlayContext`'s additions.

Around the Clock's BULL-visit tap row blocks a `TREBLE` press (no treble bull exists) — this is a
keypad-only restriction. Under board capture, a real dart location in the bull rings can only ever
classify to `OUTER_BULL`/`INNER_BULL`; `classify()` has no path to a `TREBLE` zone there, so no
extra guard is needed in `recordDart` — the board's own geometry already enforces it.

### Group B — 121 (`QUICK_SCORE` + `VISUAL_BOARD`)

121 records whole-visit totals (`OneTwentyOneVisitInput { scoreAttempted, finishedOnDouble }`), not
individual darts — mirroring 501 before board input, not Shanghai/Singles Training. Its board
support is a mirror of `FiveOhOneEngine`'s dual-shape `record()`/`wouldComplete()`/`undo()`
(D198: engines dispatch on input shape, not stored mode), not of the Group A frontend diff.

**Engine (`one-twenty-one.engine.module.ts`)**:

- `OneTwentyOneInput = OneTwentyOneVisitInput | DartObservation` (new, `modules/game/types.ts`,
  mirroring `FiveOhOneInput`).
- `isDartObservation` shape guard, `resolveObservation` (classify from `locationX`/`locationY`, or
  a scoreless `MISS` when the dart carries no coordinates) — copied from
  `five-oh-one.engine.module.ts`.
- `record()` dispatches: a `DartObservation` opens/continues a visit dart-by-dart
  (`recordDart`/`openVisit`/`openNewVisit`/`settleVisit`, mirroring 501's private methods exactly),
  applying the same bust matrix `resolveOneTwentyOneVisit` already encodes (overshoot busts, exactly
  1 remaining busts, exact 0 requires a `DOUBLE` hit). A dart-based checkout climbs `currentTarget`
  by one (or wins at the 170 cap) exactly like a keypad checkout does today — `settleVisit` computes
  the outcome and the existing round-stage-opening logic (already present in `record()`) is reused
  unchanged.
- `undo()` dispatches on the shape of the last recorded turn (dart-count > 0 vs a keypad total),
  mirroring `FiveOhOneEngine.undo()`'s `undoDart`/`undoVisitTotal` split.
- `wouldComplete()` dispatches: a dart variant (`wouldCompleteDart`/`dartChecksOutFinalLeg`
  equivalent, checking the CAP_TARGET checkout) alongside the existing visit-total variant.
- Dart facts carry the observation's real `locationX`/`locationY` (never `null`) — 121 had no dart
  facts before this change, so there is no pre-existing bug to fix, just the new path built
  correctly from the start.

**Validator (`one-twenty-one.validator.ts`)**: gains the `five-oh-one.validator.ts` shape —
`isQuickScoreOrVisualBoardCapture` dispatch in `validateConfig`, `validateBatch` branching to
`validateVisualBoardTurns(batch, MAX_VISIT_SCORE)` (180, matching 501's `max_visit_score` default)
under the board pair, `validateQuickScoreTurns` kept for the keypad pair.

**Capability**: `capabilities.ts`: `"121_V1": [QUICK_SCORE, VISUAL_BOARD]`.

**Frontend (`one-twenty-one-play.data.ts`, `OneTwentyOne.astro`)**: mirrors
`five-oh-one-play.data.ts`'s board addition exactly — `recordDart`/`commitDart` entry points beside
the existing `submitVisit`/`recordVisit`, `pendingDartObservation` + reusing the *existing*
`showSessionFinishConfirm` gate for a dart that would win the session (121 already names this
dialog `showSessionFinishConfirm` rather than 501's `showMatchFinishConfirm` — keep 121's own
naming, don't rename to match 501), `...boardInputData((observation) => self.recordDart(observation))`
spread (the `self` closure already exists). `OneTwentyOne.astro` adds `BoardInputPanel`, gates the
existing `ScoreInput` behind `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` + `x-cloak` —
the exact `FiveOhOne.astro` diff. `types.ts`'s `OneTwentyOnePlayContext` gains
`pendingDartObservation`, `recordDart`, `commitDart` — mirroring `FiveOhOnePlayContext`.

## Capability & seed layer (all three)

- `database/seeds/0007_ruleset_version_capabilities.sql`: append
  `('SHANGHAI_V1','ANALYTICS','VISUAL_BOARD')`, `('121_V1','ANALYTICS','VISUAL_BOARD')`,
  `('AROUND_THE_CLOCK_V1','ANALYTICS','VISUAL_BOARD')` to the running ledger (11 → 14 rows).
- `database/verification/0007_capability_seed_checks.sql`: all four VALUES lists and the two
  hardcoded row-count assertions (`11` → `14`) updated in lockstep — same mechanical edit the prior
  task made going 9→10→11.
- `games-visibility.ts`: no code change — `supportsCaptureMode` already drives card visibility
  generically; only new/extended test cases.

## Testing

Vitest, mirroring the existing suites for each ruleset and the Singles/Doubles Training precedent:

- Group A: `shanghai.engine.module.test.ts` / `around-the-clock.engine.module.test.ts` — no new
  coordinate-preservation case needed (already correct), but add a board-shaped `record()` smoke
  case if none exists. `shanghai.validator.test.ts` / `around-the-clock.validator.test.ts` — new
  `ANALYTICS + VISUAL_BOARD` cases mirroring `singles-training.validator.test.ts`.
  `shanghai-play.data.test.ts` / `around-the-clock-play.data.test.ts` — new `recordDart` cases
  mirroring `singles-training-play.data.test.ts`.
- Group B: `one-twenty-one.engine.module.test.ts` — new cases for dart-by-dart visit building,
  dart-based bust/checkout/ladder-climb, dart-based session win at 170, `undo()` over a dart-shaped
  turn, coordinate preservation. `one-twenty-one.validator.test.ts` — new
  `ANALYTICS + VISUAL_BOARD` cases mirroring `five-oh-one.validator.test.ts`.
  `one-twenty-one-play.data.test.ts` — new `recordDart`/`commitDart` cases mirroring
  `five-oh-one-play.data.test.ts`'s board-input coverage.
- All three: `capability-seed-parity.test.ts`, `capability-validator-parity.test.ts`,
  `games-visibility.test.ts` — regenerated/extended for the three new pairs.

No `.astro` component tests (project convention, D101).

## Decisions

No new `decisions/**` entry. Every pattern this design applies is already decided:
`play-lifecycle.ts`'s generalization (Group A) and D198's shape-dispatch (Group B, already the
live pattern in `FiveOhOneEngine`) are both existing precedent, applied mechanically to three more
rulesets — not a boundary reversal or a new pattern, the same reasoning the 121/Shanghai/Around the
Clock v1 rollouts themselves used ("built entirely from already-decided patterns").

## Out of scope / deferred

- No schema/migration change: `location_x`/`location_y` and `chk_dart_location_pair` already exist.
- No `v_*` read-model/analytics-view work.
- Bob's 27's own bespoke `visitMarkers`/`commitDart` untouched (already out of scope for the prior
  task too).
