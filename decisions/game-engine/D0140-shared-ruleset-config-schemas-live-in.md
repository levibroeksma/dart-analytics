---
id: D0140
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Shared ruleset config schemas live in `app/src/lib/game/rulesets/`

## Context and Problem Statement
`lib/` is the only tree both runtimes may import; config vocabulary was otherwise translated by hand in two directions per game, and `.strict()` turns a seed/schema drift into a failed test instead of silently stripped keys (review ST3)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Shared ruleset config schemas live in `app/src/lib/game/rulesets/` — one `.strict()` Zod object per ruleset version plus a snake_case↔camelCase codec — imported by both the Worker validator and the browser engine; the directory may import neither runtime".

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
Decided: 2026-07-26
