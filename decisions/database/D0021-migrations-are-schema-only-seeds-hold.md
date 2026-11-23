---
id: D0021
status: accepted
date:
origin: contemporaneous
original-date:
tags: [database, schema]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Migrations are schema-only, seeds hold controlled data

## Context and Problem Statement
Auditable, reproducible schema history

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Migrations are schema-only, seeds hold controlled data; applied migrations are never modified; chain `0001`–`0016`", because Auditable, reproducible schema history.

### Consequences
* Good, because the schema history stays auditable and reproducible.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Schema-only migrations with seeds holding controlled data, applied migrations never modified:

* Good, because the schema history stays auditable and reproducible.

## Evidence / More Information
Source: P48–53

* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D21): adds the decision. Rebuilt Pros and Cons and Consequences from the row's rationale. The row quoted the chain as `0001`–`0012` and cites conversation prompts P48–53, which the commit removed from the repo.
* Applied in: `docs/superpowers/specs/2026-07-12-db-read-model-normalization-design.md` (§ 3, new migration `0013` leaves applied `0009` unedited; § 4, chain range cascade).
