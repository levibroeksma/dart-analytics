---
id: D0015
status: accepted
date:
origin: contemporaneous
original-date:
tags: [architecture, turn, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Ruleset owns game limits (max darts per turn, score caps)

## Context and Problem Statement
Rules vary per ruleset version

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Ruleset owns game limits (max darts per turn, score caps) — not DB CHECK constraints", because Rules vary per ruleset version.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: P67–71

* Commit `8b23f90e` (2026-07-11; adds `architecture/DECISIONS.md` ledger row D15): source of Context and Decision Outcome.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (finding I7 cites the rule: max darts per turn, score caps and bust rules enforced by the application from the ruleset version); `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (adds `max_visit_score` to the `501_V1` config schema, which makes the score cap ruleset-owned per D15; the field exists today in `app/src/lib/game/rulesets/types.ts`).
