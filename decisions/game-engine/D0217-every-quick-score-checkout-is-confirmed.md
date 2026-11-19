---
id: D0217
status: accepted
date: 2026-08-20
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, fact log, 501, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Every quick-score checkout is confirmed through one dialog that also captures the visit's dart counts

## Context and Problem Statement
The two binary buttons made TUOD the only quick-score game without a keypad, and none of the three games recorded how a checkout was actually thrown — the one visit whose dart count is not derivable from `maxDartsPerTurn`. Asking for it at the moment the player already has to answer "was it a double?" costs no extra dialog. Narrowing the options to the chart's routes is what keeps the question answerable in one tap rather than a free 1-2-3 guess.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep the two binary buttons (Checked out / Missed) on the TUOD play screen.
* One shared `CheckoutConfirm` dialog with a keypad (chosen).

## Decision Outcome
Chosen option: "`DoubleCheckoutConfirm.astro` is replaced by `CheckoutConfirm.astro`, shared by 501, 121 and TUOD. It has two actions — Confirm and Cancel — and two option rows — darts to finish, darts at a double — whose choices come from `checkoutDartOptions(remainingScore, maxDarts)` (`modules/game/checkout-darts.module.ts`), which reads the shortest route off the existing checkout chart: a score needing `n` darts offers `n..maxDarts` to finish and `1..maxDarts-n+1` at a double, so 41 offers 2|3 and 1|2 while 170 offers one answer to each. The shortest route is preselected, so Confirm is always reachable in one tap. `FiveOhOneVisitInput`, `OneTwentyOneVisitInput` and `TuodAttemptInput` gain optional `dartsUsed`/`dartsAtDouble`; all three engines reject a claim the chart contradicts and `wouldComplete` answers false for exactly those claims rather than throwing. TUOD's play screen drops its binary Checked out / Missed buttons for the shared `ScoreInput` keypad: a typed total equal to the current target opens the dialog, every other total is a failed attempt. The old dialog's Bust / miss action is gone: the typed total already reports the outcome, since the dialog opens only on a total that finishes exactly, and Cancel returns that total to the keypad.".

### Consequences
The counts are **not persisted** — a quick-score turn still carries `darts: []`, so no migration and no schema change, and nothing derived from the fact log (`dartsThrownCount`, the three-dart average) moves. Their only live use is validation, which is real but modest: an impossible claim is refused at the engine boundary instead of being silently accepted. Dropping Bust / miss also drops the one way to report a visit that scored exactly the remaining score without finishing on a double — a real 501 bust; the player must record it as some other total until a bust affordance exists on the keypad itself. Persisting them as dart rows so checkout quality becomes queryable is deferred, and is the change that would make the capture pay for itself. TUOD's `recordAttempt` takes a `TuodAttemptInput` rather than a `checkedOut` boolean and `pendingAttempt` holds that input, so the finish-confirm gate replays exactly what was deferred; the existing TUOD play tests were re-pointed at the same guarantees through the new signature, not re-scoped.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/checkout-darts.module.test.ts` covers `checkoutDartOptions`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-20

* Commit `19ebfff0` (PR #149, 2026-08-20; adds `CheckoutConfirm.astro`, `checkout-darts.module.ts` and the D217 row): rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-08-20-tuod-analytics-design.md`, `docs/superpowers/specs/2026-09-02-tuod-hardening-design.md`.
