# Score Training: live total score during an open visit (#168)

## Problem

In Score Training's ANALYTICS + VISUAL_BOARD mode (per-dart board capture), a
seat's displayed total score does not update until the 3rd dart of a visit,
when the visit closes. Reported symptoms:

1. Entering a single dart doesn't move the score; only the 3rd dart updates
   it.
2. After a visit closes (score shows), undoing one dart reopens the visit and
   the displayed total drops to what it would be without that visit at all
   (e.g. to 0, if it was the seat's only visit so far) — even though the
   visit's other 1-2 darts are still logged. Re-entering the missing dart
   re-closes the visit and the total reappears correctly.

## Root cause

`foldScoreTrainingState` (`app/src/modules/game/score-training.engine.module.ts`)
computes a seat's `totalScore` by summing only **closed** turns
(`turn.completedAt !== null`):

```ts
const closed = facts.turns.filter(
  (turn) => turn.participantRef === seat.participantRef && turn.completedAt !== null,
);
totalScore: closed.reduce((sum, turn) => sum + turn.totalScore, 0);
```

A dart-captured visit only gets `completedAt` on its 3rd dart
(`ScoreTrainingEngine.recordDart`). Every UI read of the seat total
(`totalScoreFor` in `score-training-play.data.ts`) goes through this folded
state, so an open visit's already-thrown darts are invisible to the total
until the visit closes. Both reported symptoms are this one defect: darts 1
and 2 never count; undo, which reopens the closing turn
(`turn-log.module.ts`'s `undoLastUnit` clears `completedAt` when darts remain),
makes a previously-counted visit vanish from the total again.

Quick-score (keypad) visits are unaffected because `recordVisitTotal` always
writes a turn with `completedAt` set the instant it's recorded — there is no
open-visit state to lag behind.

## Fix

In `foldScoreTrainingState`, sum a seat's `totalScore` across **all** of its
turns (open + closed), not just closed ones. `turn.totalScore` is already
kept current on every dart by `recordDart`
(`turn.totalScore = sumDartScores(turn.darts)`), so this requires no new
bookkeeping — just widening the filter/reduce to the seat's full turn list.

`turnCount` stays closed-turns-only: it feeds `durationSeatComplete`, which
must not count an in-progress visit as a played round, and it also becomes
`ScoreTrainingResultsSnapshot.visits` at session end (by which point the
final visit is always closed — `wouldComplete`/`confirmFinish` guarantee the
finishing dart closes its visit before completion).

## Scope

One function change (`foldScoreTrainingState`), plus its own doc comment and
`ScoreTrainingSeatState`'s JSDoc in `app/src/modules/game/types.ts` (currently
states the closed-only behavior as intentional — that sentence is being
corrected, not just the code).

No change to:

- `turnCount` semantics or `durationSeatComplete`/round-budget logic
- `wouldComplete`/`isMatchDecided`/`scoreCompareOutcome` — these gate on
  `completed` (turnCount-based), never on `totalScore`, so mid-visit partial
  totals cannot flip a match outcome early
- Quick-score (keypad) behavior — every keypad visit is already closed the
  instant it's recorded, so summing all turns vs. closed turns is the same
  result for that path
- Persistence, API, or other engines (TUOD's analogous fold is a separate
  function and out of scope for this fix)

## Testing

Extend `app/tests/modules/game/score-training.engine.module.test.ts`:

- A dart recorded mid-visit (1 or 2 darts thrown) is reflected in
  `state().seats[0].totalScore` immediately, not just after the 3rd dart.
- After a visit closes and one dart is undone (reopening it), the reopened
  visit's partial total still counts toward `totalScore` — it does not drop
  to what the seat would show without that visit.
- 1v1: an open visit's partial darts count toward the throwing seat's own
  total only, never the other seat's, and never flip `status`/`winningSideKey`
  early (`isMatchDecided`/`wouldComplete` unaffected, per Scope above).

No other test files change: no other consumer relies on the closed-only
`totalScore` reading (see Scope).
