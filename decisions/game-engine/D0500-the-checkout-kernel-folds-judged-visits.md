---
id: D0500
status: accepted
date: 2026-10-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The Checkout kernel folds judged visits; its engines migrate simplest first

## Context and Problem Statement
the four engines share one attempt loop but judge visits from different facts (darts vs a settled `totalScore`), so judging is the ruleset's policy and the loop is the kernel; simplest first keeps each shell change in the PR of the first engine that needs it (D468 method).

## Decision Drivers
* Move the four shipped Checkout engines onto one kernel with no behaviour change (spec § 1).
* Record-time rules that settle a turn must stay in the engine, so `judge` cannot hide them (spec § 11).

## Considered Options
* Migrate Checkout Sequence → Random Checkout → Ten Up One Down → 121 (chosen; spec C3, § 1).
* Migrate in the umbrella order Ten Up One Down → 121 → Checkout Sequence → Random Checkout (spec C3, § 1).

## Decision Outcome
Chosen option: "`checkout-kernel.module.ts` folds a `CheckoutSeat` over visits a ruleset has already judged: `CheckoutRules` names `judge` (turn → `VisitVerdict`), `visitsPerAttempt`, `onAttemptClose` and `nextTarget` (`null` ends the seat). The kernel never applies a bust rule itself; record-time rules that settle a turn stay in the engine. The shipped Checkout engines migrate Checkout Sequence → Random Checkout → Ten Up One Down → 121, reversing the umbrella order, because the two exercises fit the existing exercise shell and the two games each need a shell extension (visit-total input; a stage per attempt). Checkout Sequence lands first and moves onto the exercise shell, whose `isVisitOpen` now sees the folded state.".

### Consequences
Checkout Sequence's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Bullseye Checkout stays `PENDING`. Spec: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
* Spec C6: Bullseye Checkout is re-checked when its exercise shell is next touched.

### Confirmation
`app/tests/modules/game/checkout-kernel.module.test.ts` and `app/tests/modules/game/checkout-policies.test.ts` cover the kernel and its judges.

## Pros and Cons of the Options
### Checkout Sequence → Random Checkout → Ten Up One Down → 121
* Good, because the two exercises fit the existing exercise shell, while Ten Up One Down needs visit-total input and 121 also needs a stage per attempt (spec C3).

### Umbrella order
* Bad, because the two games each need a shell extension (visit-total input; a stage per attempt), where the two exercises fit the existing shell (spec C3).

## Evidence / More Information
Decided: 2026-10-27

* `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (§ 1, § 11): rebuilt Decision Drivers, Considered Options, Revisit When and Pros and Cons.
* Commit `cc278732` adds the D500 row; it rebuilt no section.
