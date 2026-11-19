---
id: D0158
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# New `scripts/check-alias-sync.sh` fails when `tsconfig.json`'s `compilerOptions.paths`

## Context and Problem Statement
Closes D113's exact failure mode (an alias declared in one config but not the other, invisible until a genuine non-mocked import breaks) with a standing gate instead of a one-off fix

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "New `scripts/check-alias-sync.sh` fails when `tsconfig.json`'s `compilerOptions.paths` and `vitest.config.ts`'s `resolve.alias` diverge (allowlisting `@styles` as CSS-only); `@icons`/`@layouts` added to `vitest.config.ts` to close the real gap the gate found", because Closes D113's exact failure mode (an alias declared in one config but not the other, invisible until a genuine non-mocked import breaks) with a standing gate instead of a one-off fix.

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
