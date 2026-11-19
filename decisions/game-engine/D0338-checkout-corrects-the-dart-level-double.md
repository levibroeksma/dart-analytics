---
id: D0338
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, checkout, 501, leg, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0256
superseded-by:
---
<!-- backfill: pending -->

# Checkout % corrects the dart-level double-attempt classifier (bounce-outs and busts are misses, not exclusions) and moves the ladder fold into the app so TUOD/121 join the career stat

## Context and Problem Statement
Review against D256's own worked examples found two directions of undercounting: a bounce-out is unambiguously a failed throw at the double, and a dart that busts a visit is the least deliberate throw the rule set can describe, yet both were previously dropped from the denominator — inflating the percentage for exactly the misses a player most wants counted. The 50-remaining inner-single case was unclassified default behaviour with no rule stated anywhere, so it silently fell into "not an attempt" alongside genuine bull-adjacent setup shots it does not resemble. Widening the career read to TUOD/121 was blocked purely by where the ladder fold lived (SQL vs. app), not by any property of the darts themselves; once the fold moved to `checkout-visits.module.ts` for the live modals (Pattern 18, `04-Architecture-patterns.md`), reusing it for the career read was the only way the two could ever agree.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The unit stays one dart thrown at a double, but two of D256's exclusions were wrong. A bounce-out or off-board dart (`hitZoneKey === "MISS"`) at a directly-finishable remaining is now a **miss**, not excluded — the player did throw at the double, it just didn't land anywhere countable. Any dart that busts the visit (`resolveCheckoutAttempt(...).busted`) is likewise now a **miss**, and that bust test runs ahead of the sector/reroute-exclusion rules, so a wild dart that overshoots or leaves exactly 1 can never read as a deliberate lay-up. At exactly 50 remaining, the inner single band is a **missed bull** — nobody aims there, but it sits inside the bull's own footprint — while the outer single band and the trebles at 25 stay excluded as ordinary setup shots for the next visit; the unbanded `SINGLE` zone keypad capture writes still can't prove which band it landed in, so it stays excluded at 50 regardless of capture mode. A dart on an unrelated single/treble, or on a sector genuinely not adjacent to the required double, remains excluded — a deliberate reroute is still never fabricated into a miss. The field this feeds is renamed `checkoutPercentage` end to end (seat result, `StatisticsOverviewResponse`, store, UI label `Checkout %`) from D256's `doubleAccuracy`, still `hits / (hits + misses)` over every dart across the whole session, not per leg. Separately, the persisted view backing the career read (`v_double_out_checkout_darts`, migration `0024`) is replaced by `v_x01_checkout_darts` (migration `0039`), which drops the view's own `SUM(d.score)` running total — wrong the instant a bust zeroes a leg's counted total while its darts keep their real board scores — and exposes facts only; the read layer folds remaining-before-dart from those facts through `checkout-visits.module.ts`, the same builder the live result modals already used, because `05-Views.md` forbids TUOD's and 121's ladder-fold escalation (`finishBonus`/`missPenalty`) in SQL. Moving the fold into the app, rather than trying to express it in the view, is what let TUOD and 121 join the career `checkoutPercentage` stat at all — D256 had left them out of the persisted read entirely for exactly this reason.".

### Consequences
`double-attempt.module.ts`'s `classifyDart` runs the bust test ahead of the sector/reroute checks and treats `hitZoneKey === "MISS"` as a miss rather than short-circuiting to `NOT_ATTEMPT`; the ten reference darts in `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md` are each a named test case. 501's/121's/TUOD's seat-result `doubleAccuracy` fields are all renamed `checkoutPercentage: string | null`, rendered through the new `checkoutPercentageDisplay()` helper (Pattern 20) rather than `accuracyDisplay()`, since a checkout rate over zero attempts is missing data (`—`), not a proven `"0.00%"`. `StatisticsOverviewResponse.doubleAccuracy` is renamed `checkoutPercentage` (a 0-1 ratio, null when no dart was thrown at a double); `06-API/04-Endpoint-Contracts.md` takes the doc-version bump the freeze-semantics rule allows. `v_double_out_checkout_darts` is dropped (migration `0039`); `v_x01_checkout_darts` scopes to `game_type_key IN ('501', 'TUOD', 'ONE_TWENTY_ONE')` and is the only source `modules/stats/x01-checkout-sessions.module.ts`'s `checkoutVisitsFromRows` reads for the career stat. **Highest checkout widens with it**: `highestCheckout` reads those same visits, so the career "Highest checkout" card now counts TUOD and 121 finishes alongside 501's instead of 501's alone — intended, and the direct consequence of one builder feeding both stats; a finish on a double is a finish on a double whichever ladder posed it. **`scoringAverageExcludingDoubles` reads each visit's counted total, not just its darts**: the numerator is built from `turns.total_score`, which is 0 for a busted 501/121 visit and for every failed TUOD attempt while the visit's darts keep their real board scores, so an attempt dart from such a visit leaves the denominator but is never subtracted from the numerator — the shared builders therefore return `CheckoutVisitTotals` (`CheckoutVisitDarts` plus `countedTotal`). A session whose stored configuration snapshot no longer decodes contributes no visits rather than throwing, so one drifted snapshot cannot 500 the whole `/api/statistics/overview` response. The career `Checkout %` renders to two decimals, matching the modals' `checkoutPercentageDisplay`, rather than to a whole percent. `0039` also retires `database/verification/0024_double_out_checkout_darts_view_checks.sql` (deleted with its subject) and narrows `0036_read_model_view_consumers_checks.sql` to the two checkout-darts guarantees that survive the view swap, re-pointed at `v_x01_checkout_darts`. Full design: `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
