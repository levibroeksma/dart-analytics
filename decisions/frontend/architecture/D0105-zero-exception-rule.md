---
id: D0105
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Zero-exception rule

## Context and Problem Statement
Prior colocation escape hatch relied on discipline alone, not enforcement

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Zero-exception rule: no `.ts` under `components/`/`pages/` except `pages/api/**`; `lib/<domain>/` always, named after `modules/`/`stores/` domain vocabulary; mechanically enforced via `scripts/check-file-locations.sh` (local + CI)", because Prior colocation escape hatch relied on discipline alone, not enforcement.

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
Decided: 2026-07-16
