---
id: D0524
status: accepted
date: 2026-11-05
origin: contemporaneous
original-date:
tags: [frontend/style, style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Plan work takes visual choices from the Design System artifact and offers the sync before the PR

## Context and Problem Statement
the owner wants plan work to look like the design system, and wants to choose per branch whether drift is reconciled in the same PR.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "when a superpowers plan is written or executed, every visual choice the spec leaves open follows the Design System artifact (`syncing-design-system` skill § 11). The main session reads the artifact and passes excerpts to subagents in their briefs. Where the artifact and the code disagree on a value the task uses, the code value stays and the id is noted. Before the PR, `finishing-a-dart-branch` asks the owner whether to run the design sync on the branch (§ 12).", because the owner wants plan work to look like the design system, and wants to choose per branch whether drift is reconciled in the same PR.

### Consequences
a session without artifact access falls back to the Style Guide and says so in the ledger. A non-interactive run cannot ask, so it notes that in the PR body.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D523.
