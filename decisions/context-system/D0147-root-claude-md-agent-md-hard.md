---
id: D0147
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a stacked-branch cap

## Context and Problem Statement
A four-deep stack (`main ← #41 ← #42 ← #43 ← #48`) caused merges to land child-into-parent instead of onto `main`, silently leaving `main` with only one of four engines (review P1)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a stacked-branch cap: at most one open task branch may target another task branch; a third stacked branch means the first must land or the work merges into one branch", because A four-deep stack (`main ← #41 ← #42 ← #43 ← #48`) caused merges to land child-into-parent instead of onto `main`, silently leaving `main` with only one of four engines (review P1).

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
