---
id: D0098
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [frontend/alpine, auth gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing

## Context and Problem Statement
Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing navigation control for prerendered routes (D97); middleware redirect remains a UX nicety for on-demand routes only", because Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash.

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
