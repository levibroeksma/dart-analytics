---
id: D0119
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [game-engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Score Training hard-gate completion

## Context and Problem Statement
Prevents concurrent ACTIVE sessions; hard-gate is Score Training–scoped, not generalized

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training hard-gate completion: results modal gates Back / Play again until batch POST and `PATCH COMPLETED` both succeed (`completionStatus === "succeeded"`; treats `409 SESSION_ALREADY_COMPLETED` as success); amends D90's passive-outbox pattern for Score Training so terminal session state is reached before a new session can be created; supersedes D112's results-via-query-params / dedicated `/results` page for this flow — results render as a play-page modal from a component-local snapshot", because Prevents concurrent ACTIVE sessions; hard-gate is Score Training–scoped, not generalized.

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
Decided: 2026-07-17
