---
id: D0020
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

# CQRS-lite

## Context and Problem Statement
Stable read contracts, schema freedom underneath

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "CQRS-lite: writes to runtime tables in transactions, reads via `v_*` views only; API never exposes raw tables", because Stable read contracts, schema freedom underneath.

### Consequences
* Good, because read contracts stay stable while the schema underneath stays free to change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
CQRS-lite (writes to runtime tables in transactions, reads via `v_*` views only):

* Good, because read contracts stay stable while the schema underneath can change.

## Evidence / More Information
Source: P21–30

* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D20): adds the decision. Rebuilt Pros and Cons and Consequences from the row's rationale. The row cites conversation prompts P21–30, which the commit removed from the repo.
* Applied in: `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (§ 3, "Repository pattern (CQRS-lite)": writes target runtime tables, reads target `v_*` views).
