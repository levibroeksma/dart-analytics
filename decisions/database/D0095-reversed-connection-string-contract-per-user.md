---
id: D0095
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [database, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Reversed connection-string contract per user-verified `neonctl link` output

## Context and Problem Statement
Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Reversed connection-string contract per user-verified `neonctl link` output: `DATABASE_URL` = pooled (tooling: dbmate, drizzle-kit), `DATABASE_URL_UNPOOLED` = direct (Worker runtime `getDb()`); `DATABASE_URL_POOLED` eliminated entirely, no manually-maintained alias", because Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption.

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
