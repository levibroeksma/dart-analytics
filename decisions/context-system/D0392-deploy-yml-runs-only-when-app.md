---
id: D0392
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [context-system, docs, deploy, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `deploy.yml` runs only when `app/**`, `database/**` or the deploy workflows change

## Context and Problem Statement
every merge ran the full chain, including a Neon branch cut, the production migration runner and a Worker redeploy, for changes that cannot alter the Worker or schema. `deploy` is push-only and not a required PR check, so a path filter cannot leave a required status pending.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`deploy.yml`'s `push` trigger gains a `paths` filter: `app/**`, `database/**`, `.github/workflows/deploy.yml`, `quality.yml`, `db-rehearsal.yml`. A merge touching only docs, decisions, root scripts, `graphify-out/**` or other workflows does not start `quality -> rehearse -> migrate -> deploy`. Closes #438.".

### Consequences
a root `scripts/**` or doc-only merge gets no post-merge `quality` run; PR-time `checks.yml` still gates it. A new top-level directory the Worker build reads must be added to the filter. Manual redeploy still goes through `app/DEPLOYMENT.md`. Dropping `quality` from the deploy path, and splitting schema steps from the Worker deploy, were considered and left out as separate decisions.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-03
