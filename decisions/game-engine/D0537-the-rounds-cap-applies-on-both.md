---
id: D0537
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The ROUNDS cap applies on both capture paths of Score Training and TUOD

## Context and Problem Statement
#1242. TUOD applied the cap on the quick-score path only, an asymmetry D528 kept as it was. The cap is a rule of the session, not of the capture mode, and the engine refuses the same darts on either path.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`validateScoredBatch` rejects a batch that pushes a seat past a ROUNDS session's `duration_value` on the quick-score and the visual-board path, for both rulesets. `ScoredBatchOptions` drops `limitOnVisualBoard`.".

### Consequences
a TUOD visual-board batch past its attempt count is now refused with `session is limited to N attempts`. Score Training is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-08
Supersedes: none. Narrows D528's `limitOnVisualBoard` option.
