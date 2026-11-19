---
id: D0101
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [testing, test, Vitest, coverage]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction

## Context and Problem Statement
Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic", because Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection.

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
Decided: 2026-07-15
