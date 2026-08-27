# Score Training: split-view Previous throw + per-player summary stats (Issue #169) — Design

Status: Approved · Date: 2026-08-27

## Problem

Issue #169 ("Bug: score training") bundles four reports. Brainstorming scoped
this task to two of them:

1. **(A) Title bug.** In 1v1, the split scoreboard's per-seat stats
   (`ScoreTraining.astro`) show only "3 dart avg." and "Darts" — the
   "Previous" row the solo view already has is missing.
2. **(C) Summary modal.** "The summary modal should show both players stats,
   individually, and show at least, 3 darts avg. | first 9 avg. | highest
   score | 100+ | 120+ | 140+ | 180's." Today's modal (`ScoreTrainingResults.astro`)
   shows one combined `Total`/`Visits`/`Average` block, not split per seat at
   all.

Deferred (confirmed in brainstorming, not part of this task): the two other
reports on #169 — a save-failure error on session completion, and a stuck-retry
UX ("exit without save" after 3 retries). Both are unrelated subsystems (error
handling / recovery flow) and will be scoped separately.

## Scope

In scope: `app/src/components/layout/games/interfaces/ScoreTraining.astro`,
`app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`,
`app/src/lib/game/score-training-play.data.ts`, `app/src/lib/game/types.ts`
(`ScoreTrainingResultsSnapshot`/new `ScoreTrainingSeatResult`),
`app/src/lib/game/play-visit-stats.ts` (three new shared helpers).

Out of scope: any engine change (`score-training.engine.module.ts` is
untouched — all new stats are derived from `turns` at snapshot time, same
precedent as the existing `computeStats`/Shanghai's `statsFor`), the save/retry
flow (`play-lifecycle.ts`'s `uploadAndCompleteSession`/hard-gate), and the
other 8 rulesets' results modals.

### Closes F22 as a byproduct

`FINDINGS.md`'s F22 ("Score Training's live-stats banner shows combined-seat
data during the post-match save window") names exactly the `<dl>` block this
task's Part C design replaces. This task removes that block outright rather
than patching its seat filter — the redesign this issue's own comment asks for
(per-seat, richer stats, mirroring Shanghai) makes the old block's shape and
its seat-scoping bug both obsolete at once. This is work the task itself
requires, not an incidental fix bolted on — per root `CLAUDE.md`, adjacent
edits work genuinely needs proceed as normal. F22's entry is deleted as part
of this task's context-maintenance pass.

## Design

### Part A — "Previous" row in the split scoreboard

`previousScoreThisLegFor(seatRef)` already exists and is already typed on
`ScoreTrainingPlayContext` (`score-training-play.data.ts:271-280`,
`types.ts:260-266`) — implemented for exactly this purpose, just never wired
into the split-view template. Add one `StatRow` per seat slot in
`ScoreTraining.astro`:

```astro
<dl slot="progressA" class="w-full space-y-1">
  <StatRow label="3 dart avg." value="threeDartAverageFor(state()?.seats[0]?.participantRef)" />
  <StatRow label="Darts" value="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)" />
  <StatRow label="Previous" value="previousScoreThisLegFor(state()?.seats[0]?.participantRef)" />
</dl>
```

(and the mirrored `progressB` block for `seats[1]`). No data-layer, type, or
engine change — template-only, matching the solo view's existing three-row
shape.

### Part C — Per-player summary stats

Mirrors `ShanghaiResults.astro` / `shanghai-play.data.ts`'s existing
solo-column-vs-1v1-comparison-rows pattern (the most recent sibling
implementation of this exact shape, landed same day as this design).

#### 1. Three new shared visit-stat helpers (`play-visit-stats.ts`)

Alongside the existing `perVisitAverageDisplay`/`previousScoreDisplay`/etc.
(generic per-visit computations already shared across games):

```ts
/**
 * Average of the first 3 completed visits' totals, one-decimal display
 * string — the classic "first 9" darts stat. Fewer than 3 completed visits
 * averages over however many exist; "0.0" before any visit completes, same
 * convention as `perVisitAverageDisplay`.
 */
export function firstNineAverageDisplay(turns: VisitLike[]): string {
  const first = completedVisits(turns).slice(0, 3);
  if (first.length === 0) return "0.0";
  const total = first.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / first.length).toFixed(1);
}

/** Highest single completed-visit total; 0 if none completed. */
export function highestVisitScore(turns: VisitLike[]): number {
  const completed = completedVisits(turns);
  if (completed.length === 0) return 0;
  return Math.max(...completed.map((turn) => turn.totalScore));
}

/** Count of completed visits scoring >= threshold (cumulative bands — a 180
 * also counts toward a 100 or 140 threshold call). */
export function visitsAtOrAbove(turns: VisitLike[], threshold: number): number {
  return completedVisits(turns).filter((turn) => turn.totalScore >= threshold)
    .length;
}
```

All three reuse the existing private `completedVisits()` filter already in
this file — no new open/closed-visit logic.

#### 2. `ScoreTrainingSeatResult` / reshaped `ScoreTrainingResultsSnapshot`

Replaces the current flat `{total, visits, average, winningSideKey, status}`:

```ts
export type ScoreTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  total: number;
  threeDartAverage: string;
  firstNineAverage: string;
  highestScore: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

export type ScoreTrainingResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ScoreTrainingSeatResult[];
};
```

`seats` has one entry per configured seat (1 for solo, 2 for 1v1), in
`$store.game.seats` order — same convention `ShanghaiResultsSnapshot` and
`SplitScoreboard` already use, so the modal needs no separate ordering logic.
`winningSideKey`/`status` stay top-level (match-wide, not per-seat) — carried
over unchanged from the current `computeStats`.

#### 3. `score-training-play.data.ts`: per-seat `statsFor`

`computeStats(state, ownerRef)` is replaced by a per-seat `statsFor(seat,
turns)` (mirrors Shanghai's `statsFor` exactly), called once per
`state.seats` entry inside `uploadAndCompleteSession`'s results-snapshot
build step (still reads `this.$store.game.turns`, intact at that point,
filtered to `turn.participantRef === seat.participantRef` — same filter
`threeDartAverageFor`/`dartsThrownThisLegFor`/`previousScoreThisLegFor`
already use):

```ts
function statsFor(
  seat: ScoreTrainingSeatState,
  turns: readonly TurnFact[],
): ScoreTrainingSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    total: seat.totalScore,
    threeDartAverage: perVisitAverageDisplay(seatTurns),
    firstNineAverage: firstNineAverageDisplay(seatTurns),
    highestScore: highestVisitScore(seatTurns),
    hundredPlus: visitsAtOrAbove(seatTurns, 100),
    oneTwentyPlus: visitsAtOrAbove(seatTurns, 120),
    oneFortyPlus: visitsAtOrAbove(seatTurns, 140),
    oneEighties: visitsAtOrAbove(seatTurns, 180),
  };
}
```

`status`/`winningSideKey` are read from `finalState` exactly as
`computeStats` reads them today (`state.status === "TIE" ? "TIE" :
"COMPLETE"`, `state.winningSideKey`).

#### 4. Modal layout (`ScoreTrainingResults.astro`)

Replaces both existing `<dl>` blocks (the live pre-succeeded one and the
succeeded-only one) with a single Shanghai-shaped pair, gated only on
`completionStatus === 'succeeded' && resultsSnapshot`:

- `resultsSnapshot.seats.length === 1`: one `StatRow` per stat, vertical
  column — Total, 3 dart avg., First 9 avg., Highest score, 100+, 120+,
  140+, 180s.
- `resultsSnapshot.seats.length === 2`: comparison rows, same 8 stats,
  `seats[0]`'s value left / `seats[1]`'s value right, label centered, each
  column headed by that seat's `displayName` — identical markup shape to
  `ShanghaiResults.astro`'s existing 1v1 block (label-in-the-middle,
  values-on-either-side).

Inline `STAT_ROWS` array in the component's own frontmatter (`{label, key}`
pairs), same D101 precedent Shanghai's modal already follows — no new shared
component, no extracted helper.

**Live pre-succeeded block is dropped entirely.** During `pending`/`saving`,
only the existing `IsLoading title="Saving..."` shows — no numbers, matching
Shanghai's modal exactly. This is what closes F22: there is no longer an
unfiltered combined-seat live block to be wrong.

The `failed`/`playAgainError`/action-buttons sections are unchanged.

## Testing (TDD, mandatory)

- `play-visit-stats.test.ts` (new or extended, mirrors existing file if one
  exists for this module): `firstNineAverageDisplay` — 0/1/2/3/4+ completed
  visits; `highestVisitScore` — empty, single visit, several with a clear
  max; `visitsAtOrAbove` — cumulative behavior at each of the four
  thresholds, including a 180 counting toward all four.
- `score-training-play.data.test.ts`: every existing `resultsSnapshot`
  assertion reshaped from the flat fields to `{status, winningSideKey,
  seats: [...]}` (test subject unchanged — assertion widened, not
  re-pointed, per root `CLAUDE.md`'s test-integrity invariant). New cases: a
  1v1 session asserting both seats' entries independently (including a
  losing/lower-scoring seat), a session exercising each score band
  (100/120/140/180) to confirm cumulative counting, and a solo session
  confirming the single-seat shape.
- No `.astro` component test for either template change (D101) — both
  `ScoreTraining.astro`'s new StatRow and `ScoreTrainingResults.astro`'s
  reshaped modal are markup-only, no new logic to unit test.

## Context maintenance

Per root `CLAUDE.md`, run `context-maintenance` before completion:

- `FINDINGS.md`: delete F22 (closed by this task, see "Closes F22 as a
  byproduct" above).
- No new architecture pattern or decision — this composes onto the existing
  Doubles Training / Shanghai results-stats precedent (issue #133, #166) and
  the existing `play-visit-stats.ts` helper module; no new pattern block
  needed in `04-Architecture-patterns.md`.
- `08-Component-Inventory.md`: no change — no new shared component.
- Run `run-all-gates` and confirm every applicable script passes.
