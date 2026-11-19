---
id: D0148
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [testing, test, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a test-repointing rule

## Context and Problem Statement
A `superRefine` bounding `duration_value` was lost during a schema consolidation and its two tests were quietly re-pointed at a different invalid input so the suite stayed green, letting the dropped constraint reach review undetected until fixed the same day (commit `511f24b`)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a test-repointing rule: when a test's subject is removed or migrated, delete it or re-point it at the same guarantee, never at a different input just to keep it green; a green suite after a constraint is removed is a failure to detect, not evidence of safety".

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
