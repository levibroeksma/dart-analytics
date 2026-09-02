# Design: Scoring/stats correctness (F20, F34, F35, F37)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F20, F34, F35, F37. Four independent stats/results
correctness items, all in the Score Training / Shanghai results path,
bundled as one spec — split at review/PR time if that reads better than
one branch.

## Task 1 — F20: `foldShanghaiState`'s `winningSideKey` reads non-null for a solo Shanghai

`raceWinner` (`app/src/modules/game/shanghai.engine.module.ts:195-200`) is
called unconditionally on every seat, including a solo (1-seat) session —
unlike `compareResult` two lines below, which already gates on
`seats.length > 1`. A lone seat that hits a Shanghai is the sole
`finished: true` entry, so `raceWinner` returns that seat's own `sideKey`
instead of `null`. `foldOneTwentyOneState` carried the identical bug and
was already fixed with a `seats.length === 1 ? null : raceWinner(...)`
guard (`one-twenty-one.engine.module.ts:330-336`) — this task gives
Shanghai the same shape.

Fix:

```ts
const raceResult =
  seats.length === 1
    ? null
    : raceWinner(
        seats.map((seat) => ({
          sideKey: seat.sideKey,
          finished: seat.status === "SHANGHAI",
        })),
      );
```

No other line changes — `compareResult`'s existing `seats.length > 1 &&`
guard and `winningSideKey: raceResult ?? compareResult` are unaffected.

Currently masked in the UI (`ShanghaiResults.astro` short-circuits to solo
banner text whenever `seats.length < 2`, regardless of `winningSideKey`),
so this closes a latent contract violation, not a visible bug — matches
the finding's own Impact note.

## Task 2 — F34: `visitScoreBandCounts`'s 180 check is an equality test, not "highest threshold"

`visitScoreBandCounts` (`app/src/lib/game/play-visit-stats.ts:120-140`)
checks `score === 180` for the top band while the other three bands use
`>=`. The function's own JSDoc and D238/Pattern 21 both promise "highest
threshold a visit total meets"; a total above 180 (unreachable today —
every seeded template's `max_visit_score` is 180) would fall through to
`oneFortyPlus` instead.

Fix: change the equality check to match the other three bands' shape:

```ts
if (score >= 180) counts.oneEighties += 1;
```

## Task 3 — F35: Score Training's per-seat `total` counts open visits; the other seven stats don't

`statsFor`'s `total` field (`app/src/lib/game/score-training-play.data.ts:82`)
reads `seat.totalScore` straight off the engine — sums every turn, open or
closed, by design (issue #168). `threeDartAverage`, `firstNineAverage`,
`highestScore`, and all four score-band counts instead derive from
`completedVisits(seatTurns)`, excluding any open visit. A results snapshot
taken while a visit is still open (reachable via the persisted-mirror
retry path, not the normal `confirmFinish` route) renders a `Total` no
combination of the other seven rows can reproduce.

This is a decision, per the finding's own Proposed text, not an obvious
fix: does `total` drop the open visit's running score to match the other
seven stats, or does the inconsistency stand because the open-visit case
can't reach the results modal in the normal flow? Taking the finding's
first option — the simpler, more defensible one, since a results
`<dl>` should never show a total the other seven rows contradict, and the
open-visit case reaching the modal at all is already the edge case the
persisted-mirror retry path exists for, not the common path:

Fix: derive `total` from `completedVisits(seatTurns)` too, matching the
other seven stats' own filter. `completedVisits` itself is private to
`play-visit-stats.ts`; add one exported helper alongside its neighbours
(`perVisitAverageDisplay`, `highestVisitScore`) rather than duplicating
the filter+reduce in `statsFor`:

```ts
// play-visit-stats.ts
export function completedVisitsTotal(turns: VisitLike[]): number {
  return completedVisits(turns).reduce((sum, turn) => sum + turn.totalScore, 0);
}
```

```ts
// score-training-play.data.ts, statsFor
total: completedVisitsTotal(seatTurns),
```

## Task 4 — F37: no 1v1 test asserts the reshaped `ScoreTrainingResultsSnapshot`'s top-level `winningSideKey`/`status`

Issue #169's reshape moved `winningSideKey`/`status` to sit alongside a new
`seats` array. No test exercises a 1v1 session where the two seats' totals
actually differ enough to produce a non-null `winningSideKey` or a `"TIE"`
status — every `winningSideKey` assertion in
`app/tests/lib/game/score-training-play.data.test.ts` (including the 1v1
test this task's own predecessor added, line 885) is `null`, and that
fixture's budget leaves the fold at `IN_PROGRESS`.

Fix: no source change — test-only. Add two cases to
`score-training-play.data.test.ts`:

- A 1v1 session played to a decided finish with different seat totals,
  asserting `resultsSnapshot.winningSideKey` matches the higher-scoring
  seat's `sideKey` and `resultsSnapshot.status === "COMPLETE"`.
- A 1v1 tie case (equal totals at the round budget), asserting
  `status === "TIE"` and `winningSideKey === null`.

## Testing

- Task 1: extend `app/tests/modules/game/shanghai.engine.module.test.ts`
  with a solo-Shanghai case asserting `winningSideKey === null` (mirrors
  the existing `one-twenty-one.engine.module.test.ts` solo-checkout-at-170
  regression test) — the existing solo-Shanghai case in
  `app/tests/lib/game/shanghai-play.data.test.ts` currently asserts
  `winningSideKey: "A"` and must be updated to `null` alongside the fix,
  not left passing against the old (wrong) contract.
- Task 2: extend `app/tests/lib/game/play-visit-stats.test.ts` with a case
  scoring exactly 180 via the `>=` branch reasoning made explicit (a visit
  above 180, even though unreachable through the engine today, so the
  band function's own contract is exercised directly) still lands in
  `oneEighties`.
- Task 3: extend `score-training-play.data.test.ts`'s open-visit /
  persisted-mirror retry coverage with a case asserting `total` matches
  the sum of `completedVisits`, not the raw `totalScore`, for a snapshot
  taken with an open visit present.
- Task 4: covered above.

## Non-goals

No change to `ShanghaiResults.astro`'s solo short-circuit (Task 1 fixes
the underlying data, not this already-correct rendering guard). No change
to `one-twenty-one.engine.module.ts` (already correct, used only as the
reference pattern for Task 1). No change to any seeded template's
`max_visit_score` (Task 2 fixes the function's contract regardless of
whether 180 is reachable today). No change to Score Training's
persisted-mirror retry path itself (Task 3 only changes what one field of
its resulting snapshot reports).
