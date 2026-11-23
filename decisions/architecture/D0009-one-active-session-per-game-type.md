---
id: D0009
status: accepted
date:
origin: contemporaneous
original-date:
tags: [architecture, session, player]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# One active session per game type per player, DB-enforced via partial unique index

## Context and Problem Statement
Prevents orphaned active sessions. The ledger row cites the source "Cont. session" and carries no further reasoning.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "One active session per game type per player, DB-enforced via partial unique index (migration `0011`)", because Prevents orphaned active sessions.

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
Source: Cont. session

* Commit `8b23f90e` (2026-07-11; adds `architecture/DECISIONS.md`, a one-line-per-decision ledger distilled from design prompts 1–85 and dated sessions): rebuilt Context.
