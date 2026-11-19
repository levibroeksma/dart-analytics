---
id: D0190
status: accepted
date: 2026-08-05
origin: contemporaneous
original-date:
tags: [architecture, session, stage, turn]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `clientKey` is a transient token, not an entity id

## Context and Problem Statement
the bare `crypto.randomUUID()` call sites read as a D12 violation to every reader who met them — during the visual-board branch's review it was flagged as one twice, by an implementer and by a reviewer, before being traced. Naming the helper and stating the distinction costs one file and removes a recurring false alarm. Reaching for `generateId()` here would be worse than the confusion: it would imply the value is an entity id and invite a future change to persist it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "game engines mint stage/turn `clientKey`s with `crypto.randomUUID()` (UUIDv4) via the named `newClientKey()` helper in `app/src/modules/game/client-key.module.ts`, and this is correct. D12's "UUIDv7 for domain entities" governs `generateId()` in `app/src/lib/id.ts`, which mints every persisted id — activities, sessions, configurations, participants, stages, turns and darts. A `clientKey` is not an id: it exists only so a batch payload can point its turns at their stage before either is persisted, and `session.service.ts` maps each one to a real UUIDv7 at write time. It never reaches a database column.".

### Consequences
`app/tests/modules/game/client-key.module.test.ts` asserts `generateId()` carries version nibble 7 and sorts in creation order, and mechanically guards that no file under `src/services/` or `src/repositories/` calls `crypto.randomUUID()` — that is the path by which a v4 could reach `turns.id` or `darts.id`. Client-supplied `idempotencyKey`s remain UUIDv4 by API contract and are out of D12's scope for the same reason.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-05
