---
id: D0040
status: accepted
date: 2026-07-09
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Game engine runs client-side

## Context and Problem Statement
Offline-tolerant play, DB owns truth

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Game engine runs client-side; frontend owns temporary state, uploads completed gameplay batches; never touches DB", because Offline-tolerant play, DB owns truth.

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
Decided: 2026-07-09

* Commit `8b23f90e` (2026-07-11; adds the `architecture/DECISIONS.md` ledger, distilled from the design history): adds the row the split copied. It rebuilt no section.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (lists D40 among the decisions the review checked against).
