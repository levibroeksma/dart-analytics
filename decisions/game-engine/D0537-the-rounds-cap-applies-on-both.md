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

# The ROUNDS cap applies on both capture paths of Score Training and TUOD

## Context and Problem Statement
#1242. TUOD applied the cap on the quick-score path only, an asymmetry D528 kept as it was. The cap is a rule of the session, not of the capture mode, and the engine refuses the same darts on either path.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`validateScoredBatch` rejects a batch that pushes a seat past a ROUNDS session's `duration_value` on the quick-score and the visual-board path, for both rulesets. `ScoredBatchOptions` drops `limitOnVisualBoard`.".

### Consequences
a TUOD visual-board batch past its attempt count is now refused with `session is limited to N attempts`. Score Training is unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/rulesets/scored-batch.validator.test.ts` asserts the ROUNDS cap on both the quick-score path and the visual-board path, for visits and attempts.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-08
Supersedes: none. Narrows D528's `limitOnVisualBoard` option.

* Commit `db893504` (PR #1282, 2026-11-08, "TUOD rounds cap on both paths"): adds the original ledger block; its message adds no rationale. Rebuilt Confirmation only.
