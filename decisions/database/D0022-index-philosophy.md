---
id: D0022
status: accepted
date:
origin: contemporaneous
original-date:
tags: [database, index]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Index philosophy

## Context and Problem Statement
Write cost control

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Index philosophy: real query paths only, partial index for active sessions, no blind FK indexing", because Write cost control.

### Consequences
* Good, because it controls write cost.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Real query paths only, a partial index for active sessions, no blind FK indexing:

* Good, because it controls write cost.

## Evidence / More Information
Source: P51–53

* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D22): adds the decision. Rebuilt Pros and Cons and Consequences from the row's rationale. The row cites conversation prompts P51–53, which the commit removed from the repo.
