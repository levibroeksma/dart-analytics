# Board Marker Clear for Remaining Games — Design

Status: Approved · Date: 2026-08-26

## Problem

`BoardInputPanel.astro` (mounted by all 9 board-input games) unconditionally
renders `visitMarkers()`. Five games (Bob's 27, Singles Training, Doubles
Training, Shanghai, Around the Clock) override `visitMarkers()` to delegate
to `play-lifecycle.ts`'s `playVisitMarkers`, which hides the last turn's
markers once its `hiddenTurnKey` matches — driven by the 1500ms
reveal-then-clear timer `playCommitDart` arms (Pattern 19, D233).

The other four — 501, 121, Score Training, Ten Up One Down — never override
`visitMarkers()`. They fall back to `boardInputData()`'s own default
(`markersForTurns`, unconditional), and their hand-rolled `commitDart`/
`recordDart` methods never set a `hiddenTurnKey` at all — none of the four
declare the field. A dart's marker on the board never clears; it sits until
the *next* visit's first dart overwrites the same slot, in analytics mode,
single-player and 1v1 alike.

`501`, `121`, and `TUOD` each hand-roll a `commitDart` that is otherwise
functionally identical to `playCommitDart` (record → mirror facts →
complete-check). Score Training has no `commitDart` at all — `recordDart`
records and mirrors directly, and deliberately never calls `isComplete()`
after recording, because a MINUTES-mode session can already be complete
before a dart is thrown (timer expiry), and an unconditional post-record
completion check would upload and finish the session mid-visit.

## Scope

**In scope:** 501, 121, Score Training, Ten Up One Down — single-player and
1v1 (the mechanism is turn/seat-scoped already, per Pattern 19; no
player-count branching needed).

**Out of scope:** the 5 games already wired (no behavior change intended);
`VisitPreview`/`previewSegments()` (none of these 4 games render it — they
score by visit total/checkout, not per-dart target, matching the prior
task's own scoping); 2v2 (no team/`sideKey`-group code exists yet).

## Design

### 1. Extract the timer primitive out of `playCommitDart`

`play-lifecycle.ts` gains two small exports, factored out of
`playCommitDart`'s existing inline logic (behavior unchanged for its
current callers):

```ts
function clearTimerHandle(context: {
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
}

export function armHiddenTimer(
  context: {
    hiddenTurnKey: string | null;
    hiddenTimer?: ReturnType<typeof setTimeout> | null;
  },
  turns: readonly TurnFact[],
): void {
  const resolvedTurn = turns.at(-1);
  if (!resolvedTurn?.completedAt) return;
  clearTimerHandle(context);
  const clientKey = resolvedTurn.clientKey;
  context.hiddenTimer = setTimeout(() => {
    context.hiddenTurnKey = clientKey;
  }, 1500);
}

export function clearHiddenTimer(context: {
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  clearTimerHandle(context);
  context.hiddenTurnKey = null;
}
```

`playCommitDart` calls `armHiddenTimer(context, facts.turns)` instead of its
inline block. `playUndoVisit` and `runPlayAgain` call `clearHiddenTimer(context)`
instead of their inline `clearTimeout`/`hiddenTurnKey = null` pairs. No
behavior change for existing callers — this is a pure extraction.

This is the reusable unit a game with different completion semantics needs
(Score Training, below) without adopting the whole `playCommitDart`
composite.

### 2. 501, 121, TUOD — delegate `commitDart`/`visitMarkers` to the shared module

Each already has a `commitDart(this: XPlayContext, observation)` that
records, mirrors, and checks `isComplete()` — identical in shape to
`playCommitDart`. Replace the body:

```ts
commitDart(this: XPlayContext, observation: DartObservation) {
  return playCommitDart(this, observation);
},
```

Add `visitMarkers(this: XPlayContext): BoardMarker[] { return playVisitMarkers(this); }`.
Add `hiddenTurnKey: null as string | null` and
`hiddenTimer: null as ReturnType<typeof setTimeout> | null` to the factory's
returned state and to the `XPlayContext` type in `types.ts`. Clear the timer
in `undoVisit` (after a successful `engine.undo()`, mirroring
`playUndoVisit`'s own ordering) and in `playAgain` (mirroring `runPlayAgain`'s
reset block) via `clearHiddenTimer(this)` — both files keep their existing
hand-written `undoVisit`/`playAgain` bodies (extra confirm-dialog gates
`playUndoVisit`/`runPlayAgain` don't have), just gaining the one call.

This mirrors Bob's 27's own already-migrated shape (D233) exactly.

### 3. Score Training — the primitive only, not the composite

Score Training's `recordDart` cannot call `playCommitDart`: doing so would
add a post-record `isComplete()` check that the engine's own documented
invariant forbids (a MINUTES-mode session can already be complete before a
dart lands, and checking after every dart would upload/finish mid-visit on
the first dart of a fresh visit). Instead, `recordDart` calls
`armHiddenTimer(this, this.$store.game.turns)` directly, right after
`recordFacts`, keeping its existing control flow (including the
`wouldComplete`-gated finish confirm) untouched. Same field additions as
above; `undoVisit`/`playAgain` gain `clearHiddenTimer(this)` the same way.

### 4. Types

`types.ts`: add `hiddenTurnKey: string | null`, `hiddenTimer: ReturnType<typeof setTimeout> | null`,
and `visitMarkers(this: X): BoardMarker[]` to `FiveOhOnePlayContext`,
`OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, `TuodPlayContext`.

### Non-goals

- No change to the 5 already-wired games' behavior.
- No generic `PlayLifecycleContext`-based refactor of the 4 touched
  `*PlayContext` types (would extend the already-logged F29 debt further;
  out of scope here).
- No mechanical check-script enforcing use of the shared primitive
  (consistent with how the rest of Pattern 19 is governed — documented +
  reviewed, not gated).

## Architecture / decision / doc updates

- `docs/architecture/04-Architecture-patterns.md` Pattern 19: document
  `armHiddenTimer`/`clearHiddenTimer` as the primitive underneath
  `playCommitDart`, note all 9 board-input games now clear markers via one
  mechanism, and note Score Training's use of the primitive directly.
- New decision in `decisions/frontend/alpine.md` (continues D233's
  lineage; next id derived at commit time) recording the extraction and
  the Score Training divergence.
- `docs/architecture/07-Frontend/00-Overview.md`, Visual Board Input
  section: fix two pre-existing stale claims found while reviewing this
  area — "Only 501 and Score Training offer it" (all 9 rulesets declare
  `VISUAL_BOARD` in `capabilities.ts`) and "a finished visit's grouping
  stays on the board until the next visit's first dart replaces it"
  (superseded by the reveal-then-clear timer, already true for 5 games,
  now true for all 9). Bump the doc's version note.
- `FINDINGS.md` F29: update file count from 5 to 9 (`FiveOhOnePlayContext`,
  `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, `TuodPlayContext`
  now also hand-restate `PlayLifecycleContext`'s shape).

## Testing (TDD, mandatory)

- `play-lifecycle.test.ts`: new unit tests for `armHiddenTimer` (arms on a
  resolved turn, no-ops on an open one, replaces a pending timer) and
  `clearHiddenTimer` (clears pending timer + key; no-ops when nothing is
  pending); existing `playCommitDart`/`playUndoVisit`/`runPlayAgain` tests
  continue to pass unmodified (pure extraction).
- `five-oh-one-play.data.test.ts`, `one-twenty-one-play.data.test.ts`,
  `tuod-play.data.test.ts`: new cases — a resolving dart arms the 1500ms
  timer and `visitMarkers()` empties once it fires; `undoVisit` clears a
  pending timer; `playAgain` resets `hiddenTurnKey`/`hiddenTimer`.
- `score-training-play.data.test.ts`: same reveal/undo/play-again cases,
  plus a regression case confirming a MINUTES session already complete
  from timer expiry still does not re-trigger completion when the next
  dart's timer arms (i.e. `armHiddenTimer` alone, no `isComplete()` side
  effect).

## Context maintenance

Per root `CLAUDE.md`, run the `context-maintenance` skill before completion:
register the new decision, confirm Pattern 19 / `00-Overview.md` / F29
edits, confirm `scripts/check-context-map.sh` / `check-decision-ids.sh` /
`check-findings-log.sh` pass, confirm branch/PR state.
