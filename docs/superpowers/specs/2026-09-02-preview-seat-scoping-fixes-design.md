# Design: Preview seat-scoping fixes (Singles Training, Around the Clock)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F32, F33. Both are the same shaped bug Shanghai had
(`docs/superpowers/plans/2026-08-27-shanghai-preview-seat-scoping.md`) —
a per-dart preview strip computing its round/target index or seat filter
from the wrong scope in a 1v1 session. Bundled as one spec, two independent
tasks — split at review/PR time if that reads better than one branch.

## Task 1 — F32: Singles Training preview uses global turn count

`previewSegmentsFor` (`app/src/lib/game/singles-training-play.data.ts:186-196`)
computes the round's target as
`targetAt(numbersPath(config.targetOrder), turns.length - 1)` — the combined
turn count across both seats. Correct only for solo sessions; once a 1v1
session's turns from two seats interleave, the index runs ahead of the
active seat's own round the moment the second seat has thrown.

Fix, mirroring Shanghai's already-shipped `previewSegmentsFor`: derive the
round index from a count of `turns` filtered to the last turn's own
`participantRef`, not `turns.length`.

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  if (!config) return [...EMPTY_SEGMENTS];
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), seatRoundIndex);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
  });
}
```

A solo session (every turn already belongs to the one seat) computes the
exact same value `turns.length - 1` always gave it — no behavior change
there, matching Shanghai's own note on this point.

## Task 2 — F33: Around the Clock preview reads the wrong seat during reveal

`previewSegments()` (`app/src/lib/game/around-the-clock-play.data.ts:242-252`)
filters `this.$store.game.turns` down to `state.activeParticipantRef` before
computing the preview. `seat-rota.module.ts`'s `activeSeat` rotates to the
other seat the instant a turn closes (`completedAt !== null`) — before
`playCommitDart`'s 1.5s reveal timer even starts. During that reveal window,
`activeParticipantRef` already names the *next* thrower, not the seat whose
darts are fading out, so the strip shows the wrong seat's history (at
minimum a stale/empty strip) for 1.5s after every turn in a 1v1 session.

Fix: scope the filter to the last turn's own `participantRef`, not
`state.activeParticipantRef`. This also drops the function's only remaining
use of `state()`, so the guard moves to `this.engine`/`config` (matching
Singles Training's own guard style):

```ts
previewSegments(
  this: AroundTheClockPlayContext,
): AroundTheClockPreviewSegment[] {
  const config = this.$store.game.configSnapshot;
  if (!this.engine || !config) return [...EMPTY_SEGMENTS];
  const turns = this.$store.game.turns;
  const lastParticipantRef = turns.at(-1)?.participantRef;
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === lastParticipantRef,
  );
  return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
},
```

`previewSegmentsFor`'s own signature and `replayHits` (which replays a
seat's turns from that seat's own initial state) are unchanged — only which
`participantRef` selects the seat-scoped `turns` passed in.

## Testing

- Task 1: extend `singles-training-play.data.test.ts` with a 1v1 fixture
  where both seats have thrown at least once, asserting the preview target
  matches the active seat's own round, not the combined turn count.
- Task 2: extend `around-the-clock-play.data.test.ts` with a 1v1 fixture
  that reads `previewSegments()` immediately after a turn closes (before
  the reveal timer clears `hiddenTurnKey`), asserting it reflects the
  just-closed turn's own seat, not the newly active seat.

## Non-goals

No change to `previewSegmentsFor`'s Shanghai implementation (already
correct) or to `seat-rota.module.ts`'s `activeSeat` rotation timing itself
— that rotation is correct per its own contract; only the preview's use of
it here is wrong.
