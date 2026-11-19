---
id: D0086
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, stores, state, persist]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `$persist` in stores/forms only

## Context and Problem Statement
Predictable persistence. The spec allows `$persist` only in `*.store.ts` and `*.form.ts`. Persisted: gameplay and session recovery keyed by `gameTypeKey`, draft UI prefs in `forms/`, timer state in `game.store.ts`, and `idempotencyKey` until batch ACK. Never persisted: modal state, the toast queue, chart hover and ephemeral `.data.ts` fields.

## Decision Drivers
* Persistence stays predictable.
* `Timer` drives display while the store owns the authoritative timer fields for recovery (spec, I10).
* `player_settings` is deferred (D77), so a v1 substitute is needed (spec, I9).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`$persist` in stores/forms only; timer state in game store; forms = v1 `player_settings` substitute", because Predictable persistence.

### Consequences
* Neutral, because `lib/client/alpine/` configures the persist plugin namespace prefix, not individual store keys.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Validation list covers the handbook docs only. No source names a check for the `$persist` scope.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 14, I9, I10; the proposed D86 row): rebuilt Context, Drivers and Consequences.
* Commit `238fdbc1` (2026-07-14, adds the D86 row).
