---
id: D0120
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, stores, persist]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Persisted Alpine stores take a `PersistFactory` (`() => Alpine.$persist`), calling it

## Context and Problem Statement
Root-cause fix for play-page Alpine crashes; documents the plugin's shared-`alias` hazard. Pull request #29 introduces `game.store.ts`, which takes a `PersistFactory` and calls `persist()` once per field. Its type declaration defines `PersistFactory` as `() => Persist`, with each call returning a fresh `persist()` that has its own alias closure.

## Decision Drivers
* One Alpine `persist()` closure shares a single `.as()` alias, so reusing it across fields collapses every key onto the last alias.
* The store's own comment gives the symptom: `turns` hydrates as `null` from `game.idempotencyKey`.

## Considered Options
* Take a `PersistFactory` and call it once per field (chosen).

Rationale unknown — no source found. The sources record no other option.

## Decision Outcome
Chosen option: "Persisted Alpine stores take a `PersistFactory` (`() => Alpine.$persist`), calling it once per field — never reuse one `persist()` across fields. Alpine's `$persist` getter returns a fresh closure each access; a shared closure collapses every `.as()` key onto the last alias (e.g. `turns` hydrated as `null` from `game.idempotencyKey`)", because Root-cause fix for play-page Alpine crashes; documents the plugin's shared-`alias` hazard.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/stores/game.store.test.ts` (added in PR #29) holds a regression test that reusing one `persist()` collapses every `.as()` key to the last one. A second test asserts the store obtains a fresh `persist()` per field. Both tests exist today.

## Pros and Cons of the Options
### Take a `PersistFactory` and call it once per field
* Good, because each field gets its own alias closure, so `.as()` keys stay isolated.

## Evidence / More Information
Decided: 2026-07-17

* Commit `cd80aa80` (PR #29, 2026-07-21; `app/src/stores/game.store.ts`, `app/src/alpinejs-persist.d.ts`, `app/tests/stores/game.store.test.ts`): rebuilt Context, Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (the store rewrite step), `docs/superpowers/plans/2026-09-07-pause-resume-timed-modes.md` (Task 4).
