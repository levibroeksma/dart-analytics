---
id: D0159
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# New `scripts/check-constraint-mirror.sh` requires every live `chk_*` CHECK constraint on

## Context and Problem Statement
Mechanizes D149 (constraints mirrored once, in the batch schema) the same way `check-refinement-coverage.sh` mechanizes refinement coverage — manifest-matched, not text-scanned

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "New `scripts/check-constraint-mirror.sh` requires every live `chk_*` CHECK constraint on `exercise_stages`/`turns`/`darts` to have a `// MIRRORS: chk_x` anchor comment in the shared batch schema (`app/src/pages/api/sessions/types.ts`); a companion `constraint-mirror.test.ts` executes the boundary agreement", because Mechanizes D149 (constraints mirrored once, in the batch schema) the same way `check-refinement-coverage.sh` mechanizes refinement coverage — manifest-matched, not text-scanned.

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
Decided: 2026-07-28
