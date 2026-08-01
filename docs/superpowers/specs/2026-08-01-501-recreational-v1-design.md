# 501 Recreational V1 — Design

> status: canonical (until superseded)
> scope: `app/` frontend — 501 setup/play pages
> updated: 2026-08-01

---

## Purpose

Ship a playable v1 of 501 (recreational, `501_V1` ruleset), same score-input UX as
Score Training (throw → enter visit total → deduct from remaining → next turn),
with two 501-specific additions: an optimal-finish-path hint when the remaining
score is a legal double-out finish, and leg-scoped progress stats (darts thrown,
3-dart average, previous score) in the same card.

## Non-goals / already done

- No database, migration, or API changes. Seeds already contain the `501` game
  type, `501_V1` ruleset, and two configuration presets ("501 — Quick Play",
  "501 — Best of 5 Legs") — `database/seeds/0001_reference_data.sql`,
  `0002_default_templates.sql`.
- No engine changes. `app/src/modules/game/five-oh-one.engine.module.ts`
  (`FiveOhOneEngine`) already implements the full `GameEngine` contract:
  straight-in start, double-out finish, bust rules, leg progression,
  `wouldComplete`/`isComplete`/`undo`/rehydrate. It is already registered
  (`engine.registry.ts` via its factory's side-effect import) and covered by
  `scripts/check-game-engines.sh`.
- No new route classification entry needed — `/games` is already a protected
  prefix in `07-Frontend/01-Rendering-Strategy.md`.

## Routes

- `app/src/pages/games/501/setup/index.astro`
- `app/src/pages/games/501/play/index.astro`
- `GameCard` added to `app/src/pages/games/index.astro` linking to
  `/games/501/setup`.

`GAME_TYPE_KEY = "501"`, `RULESET_VERSION_KEY = "501_V1"` (matches seeded
`implementation_key` values).

## Setup flow

New `FiveOhOneSetupForm.astro`. `SetupSessionForm.astro` is explicitly
Score-Training-shaped (duration-mode radios) and is not reused. The 501 form is
a radio choice between the two seeded presets, keyed by preset name or
`legs_to_win`:

- "Quick Play" (`legs_to_win: 1`)
- "Best of 5 Legs" (`legs_to_win: 3`)

New `five-oh-one-setup.data.ts` Alpine factory mirrors
`score-training-setup.data.ts`:
`fetchConfigurationPresets("501")` + `fetchActiveSessions()` +
`reconcileActiveSession("501", ...)` (shared helper, unchanged) → on `start()`,
`createSession({ gameTypeKey: "501", rulesetVersionKey: "501_V1",
captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE", config: { source:
"template", templateRef: preset.configurationTemplateId } })`, then
`$store.game.startSession(...)` and redirect to `/games/501/play`.

### Shared-component reuse fixes (in scope)

Two existing components hardcode Score Training and block reuse; both get a
prop with the Score Training value as default so existing behavior is
unchanged:

- `ContinueSessionModal.astro`: add `gameTitle` prop (default `"Score
  Training"`), used in "You have an active {gameTitle} session."
- `NoSessionPanel.astro`: add `href` prop (default
  `"/games/score-training/setup"`), used as the "Configure new session" link
  target.

501's setup/play pages pass `gameTitle="501"` / `href="/games/501/setup"`.

## Play flow & engine wiring

New `five-oh-one-play.data.ts` mirrors `score-training-play.data.ts`: resumes
or creates a `FiveOhOneEngine` via `getEngineFactory("501_V1")`, reuses
`ScoreInputBuffer` + `ScoreInput.astro` unchanged, reuses `ExitModal`/abandon
flow, `undo()`, and the completed-session upload gate unchanged.

**Visit submit** (`submitVisit()`):

1. Read `score = Number(scoreInput.value)`.
2. If `this.engine.state().remainingScore - score === 0` (a would-be
   checkout): show a "Finished on a double?" `ConfirmDialog` (new
   `showDoubleConfirm` flag, same presentational pattern as Score Training's
   `showFinishConfirm`) before recording anything.
   - Confirm → `record({ scoreAttempted: score, finishedOnDouble: true })`
   - Cancel/No → `record({ scoreAttempted: score, finishedOnDouble: false })`
     (the engine's existing bust rule turns this into a scoreless visit with
     the remaining score unchanged — no new engine logic needed)
3. Otherwise → `record({ scoreAttempted: score, finishedOnDouble: false })`
   directly (the flag is only read on the exact-zero path).
4. After `record()`, mirror facts to the store (`recordFacts`), clear the
   input, then check `this.engine.isComplete()`. If true, the visit won the
   match: proceed exactly like Score Training's `confirmFinish` —
   `finished = true`, `uploadAndCompleteSession()`. If false (leg won but
   match continues, or plain visit), stay on the play screen; the engine has
   already opened the next leg's stage internally when applicable.

`wouldComplete()` is not used for this gating — 501's decision point (bust vs.
checkout) has to happen *before* `record()`, unlike Score Training's
"would this recording end the session" gate. `isComplete()` after the fact is
sufficient to detect a match win.

## Card contents: checkout path + progress stats

New `components/layout/games/interfaces/FiveOhOne.astro` (mirrors
`ScoreTraining.astro`), wraps `SinglePlayerDisplay` with `isTarget={true}` and
`target` bound to `engine`/store-derived remaining score. `SinglePlayerDisplay`
itself is unchanged — its existing `progress` named slot already renders
directly below the target number and label, so both new pieces below render
into that one slot, stacked:

### Checkout path

New `modules/game/checkout-path.module.ts` (pure functions, same shape as
`board-progression.module.ts` — no class, no Alpine, no `@client/api`):

```typescript
export function checkoutPathFor(remainingScore: number): readonly string[] | null
```

- A static lookup table for integers 2–170.
- Returns `null` for the 7 bogey numbers (169, 168, 166, 165, 163, 162, 159),
  for 1 (no possible double-out route), and for anything outside 2–170 or
  non-integer input.
- Otherwise returns a canonical dart-label sequence, e.g.
  `checkoutPathFor(121) → ["T20", "T11", "D4"]`, `checkoutPathFor(170) →
  ["T20", "T20", "BULL"]`.
- Table values authored/verified against a standard published checkout chart
  during implementation; unit-tested with spot checks across the range
  (170, 167→null, 160, 40, 2, 1→null, 0→null).
- `FiveOhOne.astro` renders the path (e.g. joined "T20 T11 D4") only when
  `checkoutPathFor(remaining)` is non-null; hidden otherwise (`x-show` +
  `x-cloak`, per house Alpine rules).

### Progress stats

Three `StatRow`s (Darts / Average / Previous), computed by
`five-oh-one-play.data.ts` methods, scoped to the **current leg only**: turns
filtered to `stageClientKey === this.$store.game.stages.at(-1).clientKey`.

- **Darts thrown** = `turnsInLeg.length * config.maxDartsPerTurn`
- **3-dart average** = `dartsThrown > 0 ? (totalScoredInLeg / dartsThrown) * 3
  : 0`
- **Previous score** = last turn's `totalScore` in the current leg, or `"—"`
  when the leg has no turns yet (start of match, or just after winning the
  previous leg)

These reset to zero/`"—"` the moment a new leg's stage opens, matching the
remaining-score reset the player is looking at.

## Results

New `FiveOhOneResults.astro` mirrors `ScoreTrainingResults.astro`: same
synchronous hard-gate completion pattern
(`completionStatus: pending|saving|succeeded|failed`, Back/Play again disabled
until `"succeeded"`). Stats shown: Total scored, Legs won, Average — computed
match-wide (not leg-scoped; this is the closing summary, not the live card).
"Play again" replays the same `templateRef`, same as Score Training.

## Types

- `lib/game/types.ts`: add `FiveOhOnePlayContext` / `FiveOhOneSetupContext`
  (mirrors `ScoreTrainingPlayContext`/`ScoreTrainingSetupContext`), including
  the new `showDoubleConfirm` field and leg-scoped stat method signatures.
- `modules/game/types.ts`: no new exported types needed —
  `checkoutPathFor`'s return type (`readonly string[] | null`) is inline in
  its own signature per existing precedent (`board-progression.module.ts`
  exports functions with inline primitive/array return types, not barrel
  types, when the shape isn't a shared domain type).

## Testing

Standard TDD (red→green→refactor), tests under `app/tests/` mirroring
`app/src/`, never colocated:

- `checkout-path.module.ts` — unit tests, spot-checking the table (see above).
- `five-oh-one-play.data.ts` — unit tests for: submit routing (checkout vs.
  bust vs. plain visit), double-confirm gating, leg-scoped stat computation,
  match-complete detection.
- `five-oh-one-setup.data.ts` — unit tests mirroring
  `score-training-setup.data.ts`'s existing coverage (preset fetch,
  reconciliation, start).
- `ContinueSessionModal.astro` / `NoSessionPanel.astro` prop changes: no new
  tests (D101 — `.astro` markup/branching stays untested inline); verify by
  running the app.
- `.astro` component branching (both new interface components, both new
  pages): untested per D101, verified manually via `npm run dev` (golden path:
  play a Quick Play leg to a double-out finish; a bust at the exact remainder;
  a Best-of-5 match to completion; undo; abandon).

`npm run validate:app` gates completion as usual. No engine files change, so
`scripts/check-game-engines.sh` / `check-refinement-coverage.sh` should be
unaffected — run them anyway as part of the standard gate.

## Context Maintenance

Per root `CLAUDE.md`, before this task is claimed done: register any new
canonical files in `00-Context-Map.md` (none of the new pages/components/
modules are "canonical docs," so likely no map edit is needed beyond the
existing Frontend gameplay pack already covering them — confirm during the
`context-maintenance` skill run), and run the mechanical guards
(`check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`).
