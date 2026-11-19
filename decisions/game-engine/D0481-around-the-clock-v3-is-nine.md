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
<!-- backfill: pending -->

# Around the Clock V3 is Nine Lives: required `lives`, two lives policies, `OUT` as a solo outcome

## Context and Problem Statement
Easy's `advanceOnHit` zeroes `hitsThisVisit` on every hit, so a `hitsThisVisit === 0` blank test would charge a life for a visit that hit on dart one; a visit-hit flag is the smallest state that survives it. Optional seat fields keep every V1/V2 golden and existing test as they were (D243's rule: a shipped version is never edited in place).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`AROUND_THE_CLOCK_V3` is a new ruleset version (V2 fields with `difficulty` fixed to `EASY`, `duration_type` to `UNTIMED`, and a required literal `lives: 3`; seat cap 1). The Track policies `noteVisitHit` (per dart) and `loseLifeOnBlank` (visit close) read `LivesTrackExt = { lives: number | null; visitHit: boolean }`; `lives: null` makes both no-ops, so V1 and V2 fold through the same code. A visit with no hit costs a life and the last one puts the seat `OUT`; solo session status maps `COMPLETE` and `OUT` to `COMPLETE`. The seat state, results snapshot and replay cell carry `lives` and `out` only when the snapshot has `lives`.".

### Consequences
both policies have Nine Lives as first caller (D468). A multi-seat lives race stays out of scope (`SEAT_CAPS` 1). `rulesetKeyOf`, `aroundTheClockVariantValidator`, `variantsPlayAgain` and `searchParamFromLocation` are shared, not copied. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-nine-lives.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-22
