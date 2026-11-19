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

# `clientKey` is a transient token, not an entity id

## Context and Problem Statement
the bare `crypto.randomUUID()` call sites read as a D12 violation to every reader who met them — during the visual-board branch's review it was flagged as one twice, by an implementer and by a reviewer, before being traced. Naming the helper and stating the distinction costs one file and removes a recurring false alarm. Reaching for `generateId()` here would be worse than the confusion: it would imply the value is an entity id and invite a future change to persist it.

## Decision Drivers
* The bare `crypto.randomUUID()` call sites read as a D12 violation; a reviewer and an implementer each flagged them during the visual-board branch review.
* Naming the helper and stating the distinction costs one file and removes the recurring false alarm.
* The value must not look like an entity id, so no one is invited to persist it.

## Considered Options
* Leave the bare `crypto.randomUUID()` call sites, which keep reading as a D12 violation.
* Reach for `generateId()`, which implies the value is an entity id and invites a future change to persist it.
* Name the helper `newClientKey()` and state that a `clientKey` is not an id.

## Decision Outcome
Chosen option: "game engines mint stage/turn `clientKey`s with `crypto.randomUUID()` (UUIDv4) via the named `newClientKey()` helper in `app/src/modules/game/client-key.module.ts`, and this is correct. D12's "UUIDv7 for domain entities" governs `generateId()` in `app/src/lib/id.ts`, which mints every persisted id — activities, sessions, configurations, participants, stages, turns and darts. A `clientKey` is not an id: it exists only so a batch payload can point its turns at their stage before either is persisted, and `session.service.ts` maps each one to a real UUIDv7 at write time. It never reaches a database column.".

### Consequences
`app/tests/modules/game/client-key.module.test.ts` asserts `generateId()` carries version nibble 7 and sorts in creation order, and mechanically guards that no file under `src/services/` or `src/repositories/` calls `crypto.randomUUID()` — that is the path by which a v4 could reach `turns.id` or `darts.id`. Client-supplied `idempotencyKey`s remain UUIDv4 by API contract and are out of D12's scope for the same reason.

* Good, because the named helper removes the recurring false alarm, at the cost of one file.
* Neutral, because `client-key.module.test.ts` guards the boundary mechanically: no file under `src/services/` or `src/repositories/` calls `crypto.randomUUID()`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/client-key.module.test.ts` asserts that `generateId()` carries version nibble 7 and sorts in creation order. It also asserts that no file under `src/services/` or `src/repositories/` calls `crypto.randomUUID()`.

## Pros and Cons of the Options
### Bare `crypto.randomUUID()` call sites
* Bad, because readers take them for a D12 violation, as happened twice in one review.

### `generateId()`
* Bad, because it implies the value is an entity id and invites a future change to persist it. The source calls this worse than the confusion.

### Named `newClientKey()` helper
* Good, because it states the distinction in one file and removes the false alarm.

## Evidence / More Information
Decided: 2026-08-05

* Commit `ba175815` (PR #73, 2026-08-08; adds D190 to `decisions/architecture.md`): source of Context; rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md` (plan 1 of the visual-board branch; its snippets mint `clientKey` with `crypto.randomUUID()`): background only, no section rebuilt.
* Applied in: `docs/superpowers/plans/2026-08-20-guest-player-x01-implementation.md`, `docs/superpowers/plans/2026-08-22-single-opponent-seat-remaining-engines.md` (both call `newClientKey()`).
