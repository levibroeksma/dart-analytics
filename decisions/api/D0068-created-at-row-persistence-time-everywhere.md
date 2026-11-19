---
id: D0068
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, batch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `created_at` = row persistence time everywhere

## Context and Problem Statement
Batch upload makes client `completedAt` predate insert

## Decision Drivers
* The batch write violates `chk_turn_completed_after_created` on any real payload (hardening spec, Problem item 1).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`created_at` = row persistence time everywhere; chronology from sequence numbers + client timestamps; migration `0015` drops `chk_turn_completed_after_created`", because Batch upload makes client `completedAt` predate insert.

### Consequences
* Neutral, because migration `0015` drops `chk_turn_completed_after_created` on `turns`: a client-observed completion time legitimately predates the row insert under batch upload.
* Neutral, because `TurnFact.completedAt` stays in the contract and maps to `turns.completed_at`.
* Neutral, because no `startedAt` is added (YAGNI) and per-dart `thrownAt` stays deferred.
* Neutral, because the database specification's timestamp section gains a one-line doctrine: `created_at` is persistence time.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem, Decision 2): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 1, Task 11): plans migration `0015` and the ledger row.
* Commit `7c49f6d5` (2026-07-14; records D67 to D78): adds the ledger row D68.
