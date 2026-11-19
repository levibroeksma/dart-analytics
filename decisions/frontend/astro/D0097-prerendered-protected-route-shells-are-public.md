---
id: D0097
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Prerendered protected route shells are public-by-design (Cloudflare serves static assets

## Context and Problem Statement
`run_worker_first` would front every static asset through the Worker for a purely cosmetic benefit (an anonymous visitor sees an empty shell either way, since data is never server-rendered)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Prerendered protected route shells are public-by-design (Cloudflare serves static assets before the Worker/middleware runs, verified via `wrangler dev` probe); the JWT-gated API remains the sole real authorization boundary, not the navigation gate", because `run_worker_first` would front every static asset through the Worker for a purely cosmetic benefit (an anonymous visitor sees an empty shell either way, since data is never server-rendered).

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
