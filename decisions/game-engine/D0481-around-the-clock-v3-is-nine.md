---
id: D0481
status: accepted
date: 2026-10-22
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Around the Clock V3 is Nine Lives: required `lives`, two lives policies, `OUT` as a solo outcome

## Context and Problem Statement
Easy's `advanceOnHit` zeroes `hitsThisVisit` on every hit, so a `hitsThisVisit === 0` blank test would charge a life for a visit that hit on dart one; a visit-hit flag is the smallest state that survives it. Optional seat fields keep every V1/V2 golden and existing test as they were (D243's rule: a shipped version is never edited in place).

## Decision Drivers
* A shipped ruleset version is never edited in place (D243), so Nine Lives is a new version and V1 and V2 snapshots stay untouched (spec § 3).
* Nine Lives keeps the literal life rule: any hit in a visit saves the life (spec § 1, Decided).
* Each new Track policy lands with its first caller (spec § 2.2; D468).
* Existing tests and goldens must not change, so new seat fields are optional (plan item 3).

## Considered Options
* A `visitHit` flag set per dart and read at visit close (chosen; plan item 2).
* A `hitsThisVisit === 0` blank test. The plan rejects it: Easy's `advanceOnHit` zeroes `hitsThisVisit` on every hit, so a visit that hit on dart 1 would lose a life.

## Decision Outcome
Chosen option: "`AROUND_THE_CLOCK_V3` is a new ruleset version (V2 fields with `difficulty` fixed to `EASY`, `duration_type` to `UNTIMED`, and a required literal `lives: 3`; seat cap 1). The Track policies `noteVisitHit` (per dart) and `loseLifeOnBlank` (visit close) read `LivesTrackExt = { lives: number | null; visitHit: boolean }`; `lives: null` makes both no-ops, so V1 and V2 fold through the same code. A visit with no hit costs a life and the last one puts the seat `OUT`; solo session status maps `COMPLETE` and `OUT` to `COMPLETE`. The seat state, results snapshot and replay cell carry `lives` and `out` only when the snapshot has `lives`.".

### Consequences
both policies have Nine Lives as first caller (D468). A multi-seat lives race stays out of scope (`SEAT_CAPS` 1). `rulesetKeyOf`, `aroundTheClockVariantValidator`, `variantsPlayAgain` and `searchParamFromLocation` are shared, not copied. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-nine-lives.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/around-the-clock.engine.module.test.ts` and `around-the-clock.golden.test.ts` cover the life rules and the unchanged V1 and V2 folds. The plan pins named cases such as "hit then two misses keeps the life".

## Pros and Cons of the Options
### `visitHit` flag
* Good, because a visit that hit on dart 1 and then missed keeps its life.
* Good, because `lives: null` makes both policies no-ops, so V1 and V2 take the same code path.

### `hitsThisVisit === 0` blank test
* Bad, because Easy's `advanceOnHit` zeroes `hitsThisVisit` on each hit, so it charges a life for a visit that hit on dart 1.

## Evidence / More Information
Decided: 2026-10-22

* `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (§ 1 Decided, § 2.2, § 3): rebuilt Decision Drivers.
* `docs/superpowers/plans/2026-10-22-track-t2-nine-lives.md` (spec refinements 2 and 3, pinned cases): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons.
* Commit `d50ee134` (2026-10-22, "Nine Lives (Around the Clock V3) and card-level tags, D481, D482"): adds the original ledger block.
