---
id: D0103
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types, interfaces]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Type-raising extended universally (Worker + browser, Zod + hand-authored)

## Context and Problem Statement
Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Type-raising extended universally (Worker + browser, Zod + hand-authored); contract types relocated from top-level `types/` into owning domain folders (`pages/api/<domain>/types.ts`, new `@routes` alias); `types.ts` standardized as the sole barrel filename, replacing the 2 existing `index.ts` files; TS `interface` declarations raised through a parallel, separate `interfaces.ts` barrel chain (same mechanics, kept out of `types.ts`), excluding `.astro` frontmatter (D92) and `env.d.ts` ambient declarations", because Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface).

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
Decided: 2026-07-16
