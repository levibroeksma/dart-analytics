---
id: D0075
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Sessions list pagination orders by `session_id DESC` (UUIDv7 creation-ordered)

## Context and Problem Statement
PK doubles as pagination key; no new index

## Decision Drivers
* UUIDv7 is creation-time ordered, so the primary key can serve as the pagination key.
* The primary key suffices, so no new index is required.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Sessions list pagination orders by `session_id DESC` (UUIDv7 creation-ordered); cursor encodes last-seen `session_id`", because PK doubles as pagination key; no new index.

### Consequences
* Good, because no new index is required.
* Neutral, because the opaque cursor encodes the last-seen `session_id`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Order by `session_id DESC` with a cursor on the last-seen `session_id`
* Good, because the primary key doubles as the pagination key.
* Good, because no new index is required.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 8): rebuilt Decision Drivers, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 6, Task 7, Task 11): the contract text and ledger row.
* Commit `7c49f6d5` (2026-07-14, adds the D75 row).
