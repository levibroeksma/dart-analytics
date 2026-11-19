---
id: D0139
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, fact log, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Engines own the fact log and derive everything else

## Context and Problem Statement
Bob's 27 and Singles Training kept the derivation and discarded the fact, inverting "store what happened"; the Score-Training-shaped store had nowhere to put the other games' facts (review C2, ST1, ST2)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Engines own the fact log and derive everything else: running score, training points, hit ratios and averages are folded from `facts()` on read and never stored in a field or a fact; the game store is game-agnostic (`rulesetVersionKey` + config union + `stages`/`turns`, `_v` → 2) and replaces its whole log from `engine.facts()` instead of appending, so engine and store cannot diverge".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
