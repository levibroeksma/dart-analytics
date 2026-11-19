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
<!-- backfill: pending -->

# Persisted Alpine stores take a `PersistFactory` (`() => Alpine.$persist`), calling it

## Context and Problem Statement
Root-cause fix for play-page Alpine crashes; documents the plugin's shared-`alias` hazard

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Persisted Alpine stores take a `PersistFactory` (`() => Alpine.$persist`), calling it once per field — never reuse one `persist()` across fields. Alpine's `$persist` getter returns a fresh closure each access; a shared closure collapses every `.as()` key onto the last alias (e.g. `turns` hydrated as `null` from `game.idempotencyKey`)", because Root-cause fix for play-page Alpine crashes; documents the plugin's shared-`alias` hazard.

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
