# 121: end the final visit early when no finish is attainable

## Problem (issue #164)

121 gives each target up to 3 visits (9 darts). In the 3rd (final) visit of an
attempt, once the remaining score can no longer be reduced to exactly 0 on a
double with the darts still in hand, the outcome is already decided: the
attempt fails and `remainingInAttempt` resets to `currentTarget` regardless of
what the last dart(s) score. The engine doesn't know this — `settleVisit` only
closes a visit on overshoot / leaving 1 / reaching 0 without a double, or once
3 darts are thrown — so the UI keeps asking for a dart that cannot change
anything. Reported case: 2 darts thrown in visit 3, 25 remaining — no single
dart can finish 25 (its cheapest route, `9 D8`, needs 2 darts), but the board
still waits for a 3rd.

Separately, `checkoutHint` (the single-player display's finish suggestion)
reads `checkoutPathFor(remainingInAttempt())` without regard to darts left in
the visit, so it can show a route that needs more darts than remain — e.g. `9
D8` for 25 with 1 dart left, reading as if a finish were still on. That's the
"single bull looks like a valid out" impression from the report.

## Scope

121 only (`one-twenty-one.engine.module.ts`, `checkout-path.module.ts`,
`one-twenty-one-play.data.ts`). 501 (`five-oh-one.engine.module.ts`) has the
identical `settleVisit` shape but no visit cap — there is always a next visit,
so a visit that can't finish still carries its score forward with no
terminal, unwinnable state to short-circuit. Confirmed not a bug there; no
finding logged.

Visits 1 and 2 of a 121 attempt are unaffected: a dart that can't finish
*this* visit still lowers `remainingInAttempt` carried into the next visit, so
every dart in those visits stays required. Only visit 3 can be closed early,
because closing it early or letting it run to a non-checkout finish reach the
same state (`remainingInAttempt = currentTarget`, `visitsThisAttempt = 0`).

## Design

### `checkout-path.module.ts`

Add:

```ts
export function isCheckoutReachable(
  remainingScore: number,
  dartsAvailable: number,
): boolean {
  const path = checkoutPathFor(remainingScore);
  return path !== null && path.length <= dartsAvailable;
}
```

Pure function alongside `checkoutPathFor`; no state, no visit-budget
knowledge — the caller supplies however many darts it considers "available".

### `one-twenty-one.engine.module.ts`

`settleVisit(visit)` currently:

1. Computes `remainingAfter`.
2. Closes on bust (revert).
3. Otherwise closes on checkout, or once `darts.length === DARTS_PER_VISIT`.

Add a third closing condition, checked after bust/checkout and only when the
visit is still open (`darts.length < DARTS_PER_VISIT`): this visit is the
attempt's 3rd (its pre-visit `visitsThisAttempt === VISITS_PER_ATTEMPT - 1`,
read the same way `remainingBeforeVisit` already folds state up to the visit)
**and** `!isCheckoutReachable(remainingAfter, DARTS_PER_VISIT - visit.darts.length)`.
When that holds, close the visit now — same shape as the 3-dart case
(`visit.totalScore = thrown`, `completedAt` stamped) — which lets
`applyOneTwentyOneVisit`'s existing final-visit branch reset
`remainingInAttempt` to `currentTarget` exactly as it already does for a
visit that runs its full 3 darts.

`remainingBeforeVisit` only returns `remainingInAttempt`; extend it (or add a
sibling private helper) to also expose the folded `visitsThisAttempt` for the
seat, since both are needed here.

Visits 1-2, and any dart that still leaves a reachable finish, are untouched
— they fall through to the existing "close only at 3 darts" behavior.

### `one-twenty-one-play.data.ts`

`checkoutHint()` currently calls `checkoutPathFor(this.remainingInAttempt())`
with no darts-remaining context. Change it to
`isCheckoutReachable(remaining, dartsLeft) ? checkoutPathFor(remaining)!.join(" ") : ""`,
where `dartsLeft` comes from the same source `visitsThisAttempt()` /
`dartsThrownThisSession()` already read from — the number of darts left in
the *current* visit (`3 - (darts already thrown this visit)`), available from
`state()`'s active seat plus the open turn's dart count. This is a display-only
change; it does not gate `submitVisit`'s existing `isCheckoutAttempt` check
(quick-score mode enters a whole visit's total in one shot, so the per-dart
"darts left in visit" question doesn't arise there).

## Testing

- `checkout-path.module.test.ts`: new `describe("isCheckoutReachable")` —
  reachable within exact minimum, reachable with slack, not reachable when
  short, false for every bogey number regardless of `dartsAvailable`.
- `one-twenty-one.engine.module.test.ts`:
  - Visit 3, 2 darts thrown leaving 25: recording the 2nd dart alone closes
    the visit (no 3rd dart needed); resulting state shows
    `remainingInAttempt === currentTarget`, `visitsThisAttempt === 0`.
  - Same 25-remaining shape in visit 1 (or 2): visit stays open after the 2nd
    dart; a 3rd dart is still required to close it.
  - Visit 3, remainder still reachable with the darts left (e.g. 40 with 1
    dart left, `D20` reachable in 1): visit stays open; the dart is still
    required, and hitting `D20` still checks out normally.

## Open questions

None — scope and behavior confirmed in brainstorming.
