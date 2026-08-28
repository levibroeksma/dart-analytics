# 501: per-player match summary (Issue #167, Part B) — Design

Status: Approved · Date: 2026-08-28

## Problem

Issue #167's third comment, for the end-of-match summary modal
(`FiveOhOneResults.astro`):

> the stats should show for both players. The labels should be centered,
> with player 1 stats left and player 2 stats right. The stats should be
> individual and not a compound of both players. It should clearly state who
> won, and include checkout percentage and legs won. Also add stats for 60+
> | 100+ | 120+ | 140+ | 180's, to both single and 1v1.

Today's modal shows one combined block (`Total`/`Legs`/`Average`) built by
`computeStats`, which is match-wide, not per-seat — wrong for 1v1 as
reported, and missing checkout %, legs won as its own row, and every
score-band tally.

## Precedent

Issue #169 shipped the identical shape for Score Training just one day
before this task: a per-seat `statsFor`, a `ScoreTrainingSeatResult[]`
snapshot, and a solo-column-vs-1v1-comparison-rows modal
(`docs/superpowers/specs/2026-08-27-score-training-previous-throw-and-summary-stats-design.md`,
mirrored from `ShanghaiResults.astro`). This design reapplies that exact
pattern to 501, changing only the stat set and the winner condition (legs,
not highest total).

## Scope

In scope: `app/src/lib/game/five-oh-one-play.data.ts`,
`app/src/lib/game/types.ts` (new `FiveOhOneSeatResult`/
`FiveOhOneResultsSnapshot`, replacing the flat `{total, legs, average}`),
`app/src/lib/game/play-visit-stats.ts` (extend `visitScoreBandCounts`),
`app/src/modules/game/checkout-bust.module.ts` (new
`checkoutAttemptCount` helper), `app/src/components/layout/games/
result-modals/FiveOhOneResults.astro`.

Out of scope: any change to `FiveOhOneEngine` itself — every new stat is
derived from `turns`/`state()` at snapshot time, same as `computeStats`
today. The other 8 rulesets' results modals. `checkoutHint`/
`checkoutDartOptions` (unrelated — those drive the live keypad checkout
flow, not the summary).

## Decisions carried from brainstorming

- Checkout % and legs-won appear in **both** the solo and 1v1 summaries (not
  1v1-only) — same full stat set, solo just renders one column.
- The 60+ band extends the **shared** `visitScoreBandCounts` helper (Pattern
  21) rather than a 501-local function — Score Training's and Shanghai's
  modals are unaffected since they don't render the new field; this keeps
  Pattern 21's own stated intent ("any future game adding visit milestone
  counts reuses this") true in practice, not just in the doc.
- Winner banner reads **"\<name\> wins the match!"** — format-agnostic,
  doesn't restate the leg count already visible in the stats below.
- Checkout % is computed and shown **only for VISUAL_BOARD sessions**; for
  QUICK_SCORE sessions the row falls back to "—". See Design §3 for why this
  is a hard capture-mode limit, not a simplification of convenience.

## Design

### 1. `visitScoreBandCounts` gains a `sixtyPlus` band

```ts
export function visitScoreBandCounts(turns: VisitLike[]): {
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
} {
  const counts = { sixtyPlus: 0, hundredPlus: 0, oneTwentyPlus: 0, oneFortyPlus: 0, oneEighties: 0 };
  for (const turn of completedVisits(turns)) {
    const score = turn.totalScore;
    if (score === 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
    else if (score >= 60) counts.sixtyPlus += 1;
  }
  return counts;
}
```

Exclusive-band rule unchanged (D238/Pattern 21): a 65 counts only as
`sixtyPlus`, never also... there is no lower band to double-count into, so
the new band only ever adds a fifth mutually-exclusive bucket below the
existing four. The pre-existing `score === 180` equality check (tracked
separately as `FINDINGS.md` F34, inert today since no template allows a
visit above 180) is left untouched — this task doesn't touch that branch
and fixing an unrelated finding in the same pass would violate the
finding-vs-work-item rule in root `CLAUDE.md`.

Existing callers (`score-training-play.data.ts`) get the new field via the
object spread they already use (`...visitScoreBandCounts(seatTurns)`) —
additive, no call-site change required, though their result types gain an
unused `sixtyPlus` field their modals don't render. `ScoreTrainingSeatResult`
et al. are left as-is (out of scope); only 501's own new result type
declares/uses `sixtyPlus`.

### 2. Legs won

Already computable — `legsWonFor(seatRef)` exists on
`FiveOhOnePlayContext` today, reading `state().sides`. The new `statsFor`
(below) calls it directly; no new logic.

### 3. Checkout percentage — why VISUAL_BOARD-only, and the exact formula

`docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md` documents that a
QUICK_SCORE 501 turn never persists dart rows (`darts: []` always) — a
busted visit and a genuine zero-scoring visit both write `totalScore: 0`
with no way to tell them apart after the fact. Checkout % is therefore
**not computable at all** for QUICK_SCORE sessions, not merely imprecise.

For VISUAL_BOARD sessions, `TurnFact.darts` carries the real board score of
every dart, bust or not. Tracing `FiveOhOneEngine`'s own bust rule
(`resolveCheckoutAttempt`, shared by every X01-style game per D240) shows a
turn can only ever be flagged `busted` when its own darts summed to a value
that moved `remainingAfter` to `< 0`, `=== 1`, or `=== 0` — which requires
`thrown > 0`. A visit that scores zero for reasons unrelated to a checkout
(three misses) never moves `remainingAfter` away from `remainingBefore`, so
it can never trigger `busted`. **A bust and a checkout attempt are the same
event for this engine** — every busted visit is a failed checkout attempt,
and every checkout attempt that doesn't fail wins the leg. So:

- **made** = that seat's `legsWon` (every leg win is, by 501's double-out
  rule, exactly one successful checkout — no separate count needed)
- **attempted** = `made` + busted visits whose own darts summed to > 0

```ts
// checkout-bust.module.ts — reusable by any X01-style game's VISUAL_BOARD results
export function checkoutAttemptCount(turns: readonly TurnFact[]): number {
  return turns.filter(
    (turn) =>
      turn.totalScore === 0 &&
      turn.darts.reduce((sum, dart) => sum + dart.score, 0) > 0,
  ).length;
}
```

`statsFor` computes `checkoutPercentage` as
`accuracyDisplay(legsWon, legsWon + checkoutAttemptCount(seatTurns))`
(Pattern 20's shared formatter) when `$store.game.inputModeKey ===
"VISUAL_BOARD"`, else `null`. The modal renders `checkoutPercentage ?? "—"`.

This lands in `checkout-bust.module.ts` rather than `play-visit-stats.ts`
because it is X01-bust-rule-specific reasoning (documented alongside
`resolveCheckoutAttempt`, the rule it depends on), not a generic per-visit
stat — 121 and TUOD could reuse it later under the same reasoning, but this
task only wires it into 501.

### 4. Result types (`types.ts`)

Replaces `FiveOhOnePlayContext.resultsSnapshot: {total, legs, average} | null`:

```ts
export type FiveOhOneSeatResult = {
  participantRef: string;
  sideKey: string;
  legsWon: number;
  threeDartAverage: string;
  checkoutPercentage: string | null;
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

export type FiveOhOneResultsSnapshot = {
  winningSideKey: string | null; // null for solo; 501 has no tie outcome
  seats: FiveOhOneSeatResult[];
};
```

`seats` has one entry per configured seat (1 solo, 2 for 1v1), in
`$store.game.seats` order — same convention as `ScoreTrainingResultsSnapshot`/
`ShanghaiResultsSnapshot`.

### 5. `five-oh-one-play.data.ts`: per-seat `statsFor`

Replaces `computeStats`/`ownerRef` (the current guest-filtering hack) with
a per-seat function mirroring Shanghai/Score Training exactly — iterating
`state.seats` and filtering `turns` to each seat's own `participantRef`
naturally excludes any turn belonging to a different seat, which is what
`ownerRef` existed to approximate:

```ts
function statsFor(
  seat: SeatFact,
  turns: readonly TurnFact[],
  legsWon: number,
  inputModeKey: string | null,
): FiveOhOneSeatResult {
  const seatTurns = turns.filter((t) => t.participantRef === seat.participantRef);
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    legsWon,
    threeDartAverage: threeDartAverageDisplay(seatTurns, maxDartsPerTurn),
    checkoutPercentage:
      inputModeKey === "VISUAL_BOARD"
        ? accuracyDisplay(legsWon, legsWon + checkoutAttemptCount(seatTurns))
        : null,
    ...visitScoreBandCounts(seatTurns),
  };
}
```

Called once per `state.seats` entry inside `uploadAndCompleteSession`'s
results-snapshot build step, same call site `computeStats` occupies today.
`winningSideKey` comes straight from `state().winningSideKey` (already
correct — 501's fold never produces a tie).

### 6. Modal layout (`FiveOhOneResults.astro`)

Same structural split as `ScoreTrainingResults.astro`/`ShanghaiResults.astro`:

- **Title/banner**, `x-text`:
  `resultsSnapshot.seats.length < 2 ? 'Match Summary' : ($store.game.seats.find(s => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins the match!')`
  (no TIE branch — 501 can't tie).
- **Solo** (`seats.length === 1`): one vertical column of `StatRow`s.
- **1v1** (`seats.length === 2`): comparison rows — label centered, seat 0's
  value left, seat 1's value right, each column headed by that seat's
  `displayName` (`08-Component-Inventory.md`'s existing centered-label
  pattern, same markup shape already shipped for Score Training/Shanghai).
- `STAT_ROWS` (inline frontmatter array, D101 precedent): Legs won, 3 dart
  avg, Checkout % (falls back to "—"), 60+, 100+, 120+, 140+, 180s.
- Failed/`playAgainError`/action-buttons sections unchanged.

`Total` (raw point sum) is dropped — not requested, and less meaningful for
a legs-race game than for Score Training's fixed-rounds format.

## Testing (TDD, mandatory)

- `play-visit-stats.test.ts`: extend `visitScoreBandCounts` cases with a
  60-69 visit asserting `sixtyPlus` increments and a 59-or-below visit
  asserting it does not; confirm a 100+ visit still does **not** also
  increment `sixtyPlus` (exclusive-band case, mirrors the existing
  100-vs-120 assertion).
- New `checkout-bust.module.test.ts` cases (or extend if one exists) for
  `checkoutAttemptCount`: zero on an empty/all-completed-non-bust log; counts
  a busted visit with nonzero darts; does **not** count a genuine
  zero-score visit (darts present, all scoring 0); does not count an open
  (uncompleted) visit.
- `five-oh-one-play.data.test.ts`: every existing `resultsSnapshot`
  assertion reshaped to `{winningSideKey, seats: [...]}` (test subject
  unchanged — widened, not re-pointed, per root `CLAUDE.md`). New cases: a
  1v1 QUICK_SCORE session asserting both seats' `legsWon`/band counts
  independently and `checkoutPercentage: null` for both; a VISUAL_BOARD
  session with at least one busted checkout attempt and one won leg,
  asserting `checkoutPercentage` reflects `accuracyDisplay(1, 2)`-shaped
  math; a solo session confirming the single-seat shape.
- No `.astro` component test for the modal reshape (D101) — markup-only,
  no new logic to unit test there.

## Context maintenance

Per root `CLAUDE.md`, run `context-maintenance` before completion:

- `04-Architecture-patterns.md` Pattern 21: note the `sixtyPlus` addition
  (band count is now five, not four) — small wording update, not a new
  pattern.
- `decisions/game-engine.md`: D238's description names the four bands
  explicitly; append a superseding note (or a new decision citing
  `Supersedes: D238`) recording the fifth band, per the append-only rule.
- No new shared component — `08-Component-Inventory.md` unchanged.
- Run `run-all-gates` and confirm every applicable script passes.
