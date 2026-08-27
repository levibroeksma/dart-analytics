# Shanghai: seat-scoped dart preview + per-seat results stats (Issue #166) — Design

Status: Approved · Date: 2026-08-27

## Problem

Issue #166 ("BUG: Shanghai") reports two things:

1. In 1v1, the per-dart hit/miss preview strip (`VisitPreview.astro`, driven by
   `shanghai-play.data.ts`'s `previewSegmentsFor`) misclassifies darts once
   both players have thrown at least once. `previewSegmentsFor` derives the
   round's target as `targetNumberAt(turns.length - 1)` — a global index over
   *every* seat's turns, not the throwing seat's own round count. In 1v1 the
   two seats' turns interleave in `$store.game.turns`, so by the time player 2
   throws their 2nd visit, `turns.length` is 4 (2 turns each), not 2 — the
   preview checks darts against round 4's target instead of round 2's.
   Confirmed via the issue's own follow-up comment: "After both players pass
   the 10 mark and have target 11 the darts preview stops working" —
   `targetNumberAt` throws once the computed index reaches 20 (Shanghai's
   `LAST_TARGET_INDEX` guard), which a 1v1 session with interleaved turns
   reaches at half the true round count.
2. The results modal (`ShanghaiResults.astro`) shows only the completing
   player's own total score and round reached — no accuracy, no zone
   breakdown, and no visibility into the opponent's stats in a 1v1 session.

## Scope

In scope: `shanghai-play.data.ts`, `shanghai.engine.module.ts` (exporting one
existing private helper, no behavior change), `ShanghaiResults.astro`,
`app/src/lib/game/types.ts` (`ShanghaiResultsSnapshot`/`ShanghaiPlayContext`).

Out of scope, confirmed in brainstorming:

- **Singles Training** carries the identical `turns.length - 1` bug (also
  1v1-capable) — logged as a new `FINDINGS.md` entry, not fixed here.
- **Around the Clock**'s `previewSegmentsFor` filters turns by
  `state.activeParticipantRef` rather than the open/closing turn's own
  `participantRef`. Traced through `seat-rota.module.ts`'s `activeSeat`: a
  turn keeps its own seat only while open (`completedAt === null`); the
  instant it closes, `activeSeat` rotates to the other seat — before
  `playCommitDart`'s 1.5s reveal timer even starts. So during that reveal
  window, Around the Clock's own preview is already scoped to the *next*
  thrower's turns, not the one whose darts are fading out. A second new
  `FINDINGS.md` entry — not fixed here (Around the Clock wasn't named in
  #166, and this repo's process bars fixing an incidentally-noticed defect
  in the same pass).
- Bob's 27 and Doubles Training are unaffected — their shared
  `doublesPathPreviewSegments` classifies from the dart's own recorded
  `intendedTargetNumber`/`intendedZoneKey`, never from a turn-array index.
- No engine, schema, or migration change. No new UI primitive — the
  comparison-row layout is inline markup in `ShanghaiResults.astro`, matching
  this repo's D101 precedent (`.astro` variant logic stays in the component's
  own frontmatter, not extracted into a testable helper) and the existing
  Doubles Training summary-stats precedent (issue #133) of computing stats in
  the play-data layer, not the engine.

## Design

### 1. Preview fix — seat-scoped round index

`previewSegmentsFor` computes the round index from a count of the *last
turn's own* `participantRef`, not `turns.length` and not
`state.activeParticipantRef`:

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(seatRoundIndex);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}
```

`seatRoundIndex` is computed once per call (not per dart) from `turns`, which
`previewSegmentsFor` already receives unfiltered — no change to the call site
(`previewSegments(this: ShanghaiPlayContext)` still passes
`this.$store.game.turns` as today). When `turns` is empty, `seatRoundIndex`
defaults to `0` but is never read: `playPreviewSegments` returns the 3-empty
placeholder before invoking `classify` in that case, mirroring today's
behavior exactly for the empty case.

This is correct for solo play too: with one seat, every turn belongs to it,
so `seatRoundIndex` equals `turns.length - 1` exactly as before — no
behavior change for the case that was already working.

### 2. Reuse `zoneBucketOf` for the results breakdown

`shanghai.engine.module.ts`'s private `zoneBucketOf(zone: DartZoneKey):
"SINGLE" | "DOUBLE" | "TREBLE" | null` (returns `null` for both bull zones and
`MISS`) is exported, unchanged, for the results-stats computation to reuse —
avoids a second, drifting copy of "what counts as a single/double/treble"
that the play-data layer would otherwise have to redefine.

### 3. `ShanghaiResultsSnapshot` reshaped to per-seat stats

Replaces the current flat `{score, status, round, winningSideKey}` with:

```ts
export type ShanghaiSeatResult = {
  participantRef: string;
  sideKey: string;
  score: number;
  round: number;
  accuracy: string;
  trebles: number;
  doubles: number;
  singles: number;
};

export type ShanghaiResultsSnapshot = {
  status: "SHANGHAI" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ShanghaiSeatResult[];
};
```

`seats` has one entry per configured seat (1 for solo, 2 for 1v1), in
`$store.game.seats` order — the same order `SplitScoreboard` and every other
1v1-aware component already reads seats in, so the modal needs no separate
ordering logic. `winningSideKey`/`status` stay at the top level (match-wide,
not per-seat).

`uploadAndCompleteSession`'s `buildResultsSnapshot` closure computes each
seat's `ShanghaiSeatResult` from that seat's own darts, replayed from
`this.$store.game.turns` (still intact at this point —
`playUploadAndCompleteSession` does not clear `$store.game.turns` before
invoking the callback).

A dart's own round target cannot be read off the seat's final `targetIndex`
(that only names the round the seat ended on) — it needs each dart's round
*at the time it was thrown*. `statsFor(seat, turns)` gets this by filtering
`turns` to that seat's own (same `participantRef` filter the preview fix
uses), then walking them in order while tracking a running round counter:
every 3rd dart of a seat's own turn stream closes a visit and advances the
counter by one, mirroring how `previewSegmentsFor`'s `seatRoundIndex` is
derived for a single turn, just accumulated across the whole seat's history
instead of read once for the last turn. For each dart at running round index
`r`: it counts as a hit when `dart.hitTargetNumber === targetNumberAt(r)`;
its zone bucket (`zoneBucketOf(dart.hitZoneKey)`) increments `trebles` /
`doubles` / `singles` independent of hit/miss, or increments none of the
three for a bull hit or `MISS`. This mirrors
`around-the-clock-play.data.ts`'s existing `replayHits`/
`applyAroundTheClockDart` fold pattern — replay the seat's own state forward
dart-by-dart rather than trusting a single final index.

`accuracy` = `` `${hits.length === 0 && darts.length === 0 ? 0 : Math.round((hits.length / darts.length) * 100)}%` ``
— `"0%"` when no darts thrown, same formatting precedent as Doubles
Training's `accuracy` field (issue #133) and `bobs27-play.data.ts`'s
`doubleHitRate`.

`trebles`/`doubles`/`singles` = raw zone tallies over every dart the seat
threw (regardless of hit/miss), via `zoneBucketOf(dart.hitZoneKey)` —
confirmed in brainstorming: a bull hit or a miss increments none of the
three counters, matching standard darts-stats convention (count what was
thrown, not just what scored).

`score`/`round` are unchanged in meaning (`seat.totalScore`,
`seat.targetIndex + 1`) — sourced from `finalState.seats`, not recomputed.

### 4. Modal layout (`ShanghaiResults.astro`)

Replaces the current single `<dl>` (Total score / Round reached) with:

- `resultsSnapshot.seats.length === 1`: one `StatRow` per stat — Score,
  Round, Accuracy, Trebles, Doubles, Singles — same vertical list shape as
  today, just more rows.
- `resultsSnapshot.seats.length === 2`: one row per stat, label centered,
  `seats[0]`'s value on the left and `seats[1]`'s on the right (Score |
  Round | Accuracy | Trebles | Doubles | Singles, each as
  `value seats[0] — label — value seats[1]`) — "label in the middle, values
  on either side," per the issue's own second comment. Each column's header
  shows that seat's `displayName` (read from `$store.game.seats`, same
  lookup the modal's title already uses for the winner name).

No new shared component — a `x-for` over a small inline array of `{label,
key}` pairs inside `ShanghaiResults.astro`'s own frontmatter/template,
matching this repo's D101 precedent that `.astro` variant/branching logic
stays inline rather than being extracted into a helper file solely to make
it testable.

## Testing (TDD, mandatory)

- `checkout-path` n/a — no engine change beyond the export.
- `shanghai-play.data.test.ts`:
  - `previewSegments()`: new 1v1 case reproducing the reported scenario —
    player A throws a full visit (round 1), player B throws a full visit
    (round 1), player A's 2nd visit's darts must classify against round 2's
    target (not round 3, which `turns.length - 1` would compute); a second
    case carries both seats past round 10 to cover the "stops working past
    target 11" follow-up comment, asserting no throw and correct
    classification at that depth.
  - `previewSegments()`: existing solo-session cases re-asserted unchanged
    (regression guard — `seatRoundIndex` must equal the old `turns.length -
    1` value for one seat).
  - `uploadAndCompleteSession` / `resultsSnapshot`: every existing case
    reshaped from the flat assertion to the new `{status, winningSideKey,
    seats: [...]}` shape (test subject unchanged — "the snapshot reflects
    the session's outcome" — assertion widened, not re-pointed, per root
    `CLAUDE.md`'s test-integrity invariant). New cases: a 1v1 session
    asserting both seats' entries (score/round/accuracy/zone tallies
    correct for each independently, including the losing seat); a session
    mixing trebles/doubles/singles/misses/bull-hits, asserting bull and
    miss increment none of the three zone counters; a zero-darts-for-one-
    seat edge case (session ends before a seat ever throws — accuracy
    `"0%"`, all zone counts `0`), if reachable pre-completion.
- No `.astro` component test for the modal layout (D101).

## Context maintenance

Per root `CLAUDE.md`, run `context-maintenance` before completion:

- `FINDINGS.md`: two new entries (Singles Training's identical preview bug;
  Around the Clock's reveal-window active-seat staleness), high-water mark
  bumped by 2.
- No new architecture pattern or decision — this composes onto the existing
  `playPreviewSegments`/`play-lifecycle.ts` mechanism (Pattern 19) and the
  Doubles Training results-stats precedent; no new pattern block needed in
  `04-Architecture-patterns.md`.
- `08-Component-Inventory.md`: no change — no new shared component.
- Run `run-all-gates` and confirm every applicable script passes.
