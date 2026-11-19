---
id: D0137
status: accepted
date: 2026-07-24
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

# Local Neon env

## Context and Problem Statement
Neon CLI omits Astro `PUBLIC_` keys; deploy must not leave local `astro dev` on production

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Local Neon env: `npm run env:dev` / `env:prod` pull branch vars into `.env` / `.env.production` and mirror `PUBLIC_NEON_AUTH_BASE_URL`; `npm run dev` runs `env:dev` first; never pull `main` into `.env`", because Neon CLI omits Astro `PUBLIC_` keys; deploy must not leave local `astro dev` on production.

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
Decided: 2026-07-24
