# Doubles Training — v1 Frontend — Design

Status: approved (brainstorming). Source: `app/src/modules/game/doubles-training.engine.module.ts`,
`app/src/services/rulesets/doubles-training/doubles-training.validator.ts`,
`docs/game-rules/rulesets/doubles-training.md`,
`docs/superpowers/specs/2026-07-24-doubles-training-engine-design.md` (historical — engine only).

Single phase. Unlike Bob's 27's four-phase rollout, no capability change is needed:
`DOUBLES_TRAINING_V1` already declares only RECREATIONAL + DETAILED_DARTS
(`capabilities.ts`, seed `0007`) — no `VISUAL_BOARD` pairing exists or is being added, so there is
no board-input branch, no mode gating, and no `BoardInputPanel` involvement anywhere in this
phase. This is the Singles Training precedent (RECREATIONAL-only, no `ANALYTICS` card pair), not
the Bob's 27 one.

## Why

Engine, validator, capability declaration, and seed for `DOUBLES_TRAINING_V1` shipped
2026-07-26 and are frozen. There is no way to play the game — no games-index card, no setup page,
no play page. This phase adds exactly that.

## Scope

In: games-index card, setup page, play page (tap input, visit preview, live hit/miss stats),
results modal.

Out: any engine/validator/capability/schema change, hard/challenge modes, non-low-to-high order,
multiplayer, `VISUAL_BOARD` capture — all correctly `TBD`/`V2+` in the ruleset doc's Features
table and untouched here.

## Files

- `app/src/lib/game/games-index.data.ts`'s `GAME_CARDS` — new `DOUBLES_TRAINING_V1` entry,
  `href: "/games/doubles-training/setup"`. Visibility: RECREATIONAL-only, same precedent as
  `SINGLES_V1` (`games-visibility.ts`'s `supportsCaptureMode` already handles a ruleset with no
  `ANALYTICS` pair — no code change to that filter, just the new card + its visibility test case).
- `app/src/lib/game/doubles-training-setup.data.ts` — mirrors `singles-training-setup.data.ts`:
  zero editable settings, `init()` reconciles an active session against the one seeded preset,
  `start()` creates a session via `resolveSessionModePair("DOUBLES_TRAINING_V1",
  this.$store.settings)`.
- `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro` — `SetupShell` +
  `UserSection` + `InfoSection` only (no `Toggle`/`Input`) — Players/Mode/Order are all "shown,
  locked" per the ruleset doc's Config & presets table. `InfoSection` description text:

  > "Work through every double, D1 to D20, then the bull. Three darts per target — hit the double
  > and move on immediately; miss all three and you still move on. On the bull, only the inner
  > bull (double bull) counts."

- `app/src/pages/games/doubles-training/setup/index.astro`,
  `app/src/pages/games/doubles-training/play/index.astro` — mirror
  `pages/games/singles-training/setup|play/index.astro`'s shells exactly (reconciliation,
  `ContinueSessionModal`, `ReconciliationBlocked`, `IsLoading`, `NoSessionPanel`).
- `app/src/lib/game/doubles-training-play.data.ts` — game loop:
  - `currentTargetLabel()`: `"D" + target.number`, or `"BULL"` when `target.kind === "BULL"`
    (reads `targetAt(doublesPath(), engine.state().targetIndex)`).
  - `recordTap(hit: boolean)`, mirroring `bobs27-play.data.ts`'s shape exactly (not Singles
    Training's ring-keyed variant — Doubles Training has only one hit zone per target, never
    single/treble):
    - hit → `{ hitTargetNumber: target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      hitZoneKey: target.kind === "BULL" ? "INNER_BULL" : "DOUBLE", locationX: null, locationY:
      null }`
    - miss → `{ hitTargetNumber: null, hitZoneKey: "MISS", locationX: null, locationY: null }`
  - `commitDart(observation)` → `engine.record()` → `$store.game.recordFacts()` →
    `isComplete()` → upload-and-complete. Same shape as Singles/Bob's 27's `commitDart`.
  - `undoVisit()` → `engine.undo()` → re-mirror. Same shape as the sibling play-data modules.
  - `previewSegments()`: reads the last turn's darts against
    `targetAt(doublesPath(), turns.length - 1)`, hit iff `dartHitIntendedTarget`-equivalent
    (compare `hitTargetNumber`/`hitZoneKey` to `intendedTargetNumber`/`intendedZoneKey` on the
    fact, exactly as the engine's own `dartHitIntendedTarget` does) — same derivation pattern as
    `singles-training-play.data.ts`'s `previewSegmentsFor`, simplified to a boolean instead of a
    points threshold.
  - `hitCount()` / `missCount()`: visit-level counts, not dart-level — count resolved turns
    (`turn.completedAt` set) whose last dart hit its intended target vs. didn't. Not a raw
    dart-zone tally (unlike Singles Training's `singleCount()`/`doubleCount()`), because Doubles
    Training's tracked stat is hit/miss **per visit**, and a miss visit still has up to 3
    non-hitting darts that must not each count as a separate "miss" in this total.
  - `hiddenTurnKey` reveal timing: none needed. Doubles Training never enters `VISUAL_BOARD`
    (unlike Bob's 27's 1.5s reveal-then-clear, which is analytics/board-only), so the resolved
    turn's preview just lingers until the next tap re-derives `previewSegments()` — same as
    Singles Training's synchronous (non-timer) approach.
- `app/src/components/layout/games/DoublesTrainingRecreationalInput.astro` — 3-button row, same
  bordered/glass shape as `Bobs27RecreationalInput.astro`: **Undo** (icon) · **Miss** ·
  `currentTargetLabel()`-labelled hit button. No mode gating (`x-show`) needed — this is the only
  input this ruleset ever renders.
- `app/src/components/layout/games/interfaces/DoublesTraining.astro` — `SinglePlayerDisplay`
  (`isTarget`, target = `currentTargetLabel()`), progress slot with `StatRow`s for Hits/Misses,
  `VisitPreview` (reused unchanged), `DoublesTrainingRecreationalInput`. No `BoardInputPanel`.
- `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro` — "Session
  complete" heading (no win/loss — this is a practice run, same precedent as
  `SinglesTrainingResults.astro`), `StatRow`s for Hits and Misses out of 21 visits, read off a
  `resultsSnapshot: { hits: number, misses: number } | null` captured at completion time from the
  final `hitCount()`/`missCount()`.

## Data flow

Identical to Singles Training / Bob's 27: tap → `engine.record()` (pure, throws only on an
already-complete session) → `facts()` mirrored into `$store.game` via `recordFacts()` →
`engine.isComplete()` checked → `buildEventsBatch` + `appendBatch` + `completeSession` on
completion. Visit-ends-on-hit is already the engine's own behavior
(`applyDoublesTrainingDart`/`resolveVisit`); the play-data module does no extra bookkeeping for
it beyond reading `state()` and `facts()`.

## Testing

Vitest, mirroring the Singles Training / Bob's 27 test suites:

- `doubles-training-play.data.test.ts` — `recordTap` hit/miss paths (including the bull target's
  `INNER_BULL` mapping), `undoVisit` (including re-opening an early-ended visit), completion +
  upload, `hitCount()`/`missCount()` visit-level counting (not dart-level), `previewSegments()`.
- `doubles-training-setup.data.test.ts` — mirrors `singles-training-setup.data.test.ts`'s cases
  (reconciliation, session start, no editable-settings payload).
- `games-visibility.test.ts` — extend for the new card, RECREATIONAL-only like `SINGLES_V1`.

No `.astro` component tests (project convention, D101) — new astro files stay markup-only with
inline branching, matching the sibling interfaces.

## Out of scope / deferred

- Hard mode, challenge mode, non-low-to-high order, multiplayer, per-target hit/miss ratio display
  (derivable from facts but not surfaced in v1 UI, same as the ruleset doc's "Later versions"
  section) — all explicitly `V2+`/`TBD` already.
- No schema, engine, validator, capability, or seed change — this phase is `app/src/pages`,
  `app/src/components`, and `app/src/lib/game/*-{setup,play}.data.ts` only.
- No `decisions/**` entry: this is mechanical extension of already-decided patterns (D196
  capability declaration — unchanged here since no new pair is added — D198 shape-dispatch, the
  Singles Training RECREATIONAL-only card precedent), not a new architectural pattern.
