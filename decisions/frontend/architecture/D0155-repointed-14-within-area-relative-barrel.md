---
id: D0155
status: accepted
date: 2026-07-26
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

# Repointed 14 within-area relative barrel imports at the area-root alias

## Context and Problem Statement
Owner found the previously-documented blind spot in the wild: rule 3 only inspected aliased (`@`-prefixed) imports, so a validator or route handler could dodge the area-barrel rule with a relative path instead

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Repointed 14 within-area relative barrel imports at the area-root alias — six `rulesets/*/*.validator.ts` (`../interfaces`→`@services/interfaces`, `../types`→`@services/types`) and two `pages/api/sessions/[sessionId]/**` route handlers (`../types`, `../../types`→`@routes/types`); extended `scripts/check-type-barrels.sh` with a fourth rule failing any relative barrel import that doesn't resolve to the importing file's own folder, closing the gap its own header had documented as uncatchable".

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
