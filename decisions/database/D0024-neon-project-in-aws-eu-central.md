---
id: D0024
status: accepted
date: 2026-07-09
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

# Neon project in `aws-eu-central-1`, branches `main`/`preview`/`dev`

## Context and Problem Statement
Cost + low ops for solo operator

## Decision Drivers
* The ledger row states the driver as cost and low operations for a solo operator. The spec's Approved Decisions call the scale-to-zero compute "personal use; Free-tier friendly".
* The spec places the region in Frankfurt to minimize latency to the European Cloudflare Workers edge.

## Considered Options
* Scale-to-zero on `main`, `preview` and `dev`, with a shared `dev` branch for local work (chosen).
* Always-on `main` with min 1.0 CU and scale-to-zero off. The spec defers it to a Launch plan, until production latency or traffic justifies paid compute.
* Local Docker Postgres. The spec lists it as a non-goal in favour of the shared Neon `dev` branch.

## Decision Outcome
Chosen option: "Neon project in `aws-eu-central-1`, branches `main`/`preview`/`dev`; scale-to-zero on all branches for v1; shared `dev` branch for local work (no Docker Postgres)", because Cost + low ops for solo operator.

### Consequences
* Good, because the spec describes scale-to-zero on all branches as Free-tier friendly for personal use.
* Bad, because transient cold-start failures are expected on scale-to-zero branches (`docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md`, "per D24").
* Neutral, because local work targets the shared `dev` branch and no local PostgreSQL server exists in the agent environment (`docs/superpowers/plans/2026-08-14-training-order-mode.md`, "D193/D24").

### Confidence
Rationale unknown — no source found.

### Revisit When
Production latency or traffic justifies paid compute: the spec defers always-on `main` (min 1.0 CU, scale-to-zero off) to a Launch plan.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Scale-to-zero on all branches:

* Good, because it costs little for personal use.
* Bad, because cold starts cause transient failures.

Always-on `main`:

Rationale unknown — no source found.

Local Docker Postgres:

Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-09

* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (Approved Decisions; Non-goals; § 1 "Project", "Branch model"): rebuilt Decision Drivers, Considered Options, Revisit When and Pros and Cons.
* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D24): adds the decision row; its rationale feeds Decision Drivers.
* Applied in: `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` (cold-start failures "per D24"), `docs/superpowers/plans/2026-08-14-training-order-mode.md`, `docs/superpowers/plans/2026-08-15-around-the-clock-v1.md`. They rebuilt Consequences.
