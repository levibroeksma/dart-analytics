---
id: D0160
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# New `scripts/check-no-inline-comments.sh` fails on a `//` or non-JSDoc `/* */` comment

## Context and Problem Statement
The rule existed since app/CLAUDE.md's TypeScript comments section but was never mechanically checked; the gate's first real run caught real violations, confirming the prose-only gap

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "New `scripts/check-no-inline-comments.sh` fails on a `//` or non-JSDoc `/* */` comment lexically inside a function/method body under `app/src/**/*.ts` (JSDoc `/**` above a declaration stays exempt, matching the existing "JSDoc above the declaration" rule); found and fixed 3 pre-existing violations (`register-stores.ts`, two in `score-training-setup.data.ts`) that had shipped under the same rule as prose only", because The rule existed since app/CLAUDE.md's TypeScript comments section but was never mechanically checked; the gate's first real run caught real violations, confirming the prose-only gap.

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
