---
id: D0505
status: accepted
date: 2026-10-28
origin: contemporaneous
original-date:
tags: [game-engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Killer V1 is playable: two-seat floor, player-chosen numbers, shell gating

## Context and Problem Statement
a guest who wins the starter step must throw first and keep their own number; a gate in the shell, not the form, keeps every start path honest. Killer is a board game, so career stats stay out of scope (spec section 11).

## Decision Drivers
* Seats are exactly 2 in V1; 3–4 seats wait until setup and the play screen seat more than two (spec E3).
* A seat number belongs to the person, so it must follow them through the starter step and Play Again (spec § 12; plan, Setup row).
* The validator's `seat_numbers.length === 2` must agree with the seat count (plan, two-seat floor row).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`SEAT_FLOORS` in `session-seats.service.ts` makes `rejectSeatRequest` refuse a seat list (or an omitted one, meaning solo) below a ruleset's floor; `KILLER_V1` floors at 2, so the validator's `seat_numbers.length === 2` always agrees with the seat count. Seat numbers follow the person through the starter step: `configOverrides(ctx)` returns `seat_numbers` reordered by `starterFirstNumbers(ctx.seatNumbers, ctx.starterIndex)`, and Play Again's `buildOverrides` reorders `prior.seatNumbers` the same way before `variantsPlayAgain("KILLER_V1")`. Input is the new `KillerRecreationalInput` (ring keys, 1-20 grid, BULL, MISS over the `marks-play.data.ts` helpers); the visual board comes from `SeatedPlayScreen` as for every game. Setup picks numbers with `Select` pickers (defaults 20 for you, 19 for the guest). `SetupShell` gains the optional `startBlockedExpr` prop (default `"false"`), OR'd into the slide's `disabledExpr` and the submit guard; Killer passes `"!canStart()"`. A `killer` summarizer in `session-progress.module.ts` shows `1v1 · Killer` or `1v1 · Not Killer` with the active seat's lives (`LIVES`). `KILLER_V1` joins `HEATMAP_ONLY_LAYOUTS`. The card sits in `CLASSICS` as "Killer" / "Hit your double, then hunt theirs."".

### Consequences
no migration. `killer.md` is now `V1 (shipped 2026-10-28)`. Three or more seats, DartBot and the other deferred rows stay deferred. Spec: `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
* Three or four seats: spec E3 defers them until setup and the play screen seat more than two.

### Confirmation
`app/tests/services/session-seats.service.test.ts` covers the two-seat floor in `rejectSeatRequest`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-28

* `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md` (E3, E6, E8, E9, § 12): rebuilt Decision Drivers and Revisit When.
* `docs/superpowers/plans/2026-10-28-elimination-kernel-pr2.md` (two-seat floor and start gating rows): rebuilt Decision Drivers.
* Commit `2c8c218f` (PR #1141; adds the D505 row): rebuilt Confirmation.
