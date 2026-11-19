---
id: D0026
status: accepted
date: 2026-07-08
origin: contemporaneous
original-date:
tags: [database, migration, table]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Session write idempotency table (migration `0012`) backing the batch endpoint's

## Context and Problem Statement
Safe client retries of batch uploads

## Decision Drivers
* The frozen API idempotency contract in `06-API/00-Overview.md` needs a DB-backed schema artifact.
* The spec's Stage 4 self-check lists "API idempotency contract must be backed by a schema artifact".

## Considered Options
* Add a runtime-support table keyed by session and idempotency key (chosen).
Rationale unknown — no source found for any other option.

## Decision Outcome
Chosen option: "Session write idempotency table (migration `0012`) backing the batch endpoint's idempotency key", because Safe client retries of batch uploads.

### Consequences
* Good, because client retries of a batch upload resolve against a stored outcome.
* Neutral, because the table stores `session_id`, `idempotency_key`, a normalized payload hash and the result as JSONB, unique per session and key.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Stage 4 self-check requires the idempotency contract to be backed by a schema artifact. Migration `0012_session_write_idempotency.sql` exists in `database/migrations/`.

## Pros and Cons of the Options
Idempotency table:

* Good, because it makes client retries of batch uploads safe.

## Evidence / More Information
Decided: 2026-07-08

* `docs/superpowers/specs/2026-07-08-dart-zones-analytics-idempotency-participants-design.md` (Goal; Decisions § 4; Stage 4 self-check): rebuilt Decision Drivers, Considered Options, Consequences, Pros and Cons and Confirmation.
* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D26): adds the decision row; its rationale feeds Pros and Cons.
