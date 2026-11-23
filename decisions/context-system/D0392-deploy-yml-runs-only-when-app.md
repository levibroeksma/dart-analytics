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

# `deploy.yml` runs only when `app/**`, `database/**` or the deploy workflows change

## Context and Problem Statement
every merge ran the full chain, including a Neon branch cut, the production migration runner and a Worker redeploy, for changes that cannot alter the Worker or schema. `deploy` is push-only and not a required PR check, so a path filter cannot leave a required status pending.

## Decision Drivers
* Every merge ran the full chain, including a Neon branch cut, the production migration runner and a Worker redeploy, for changes that cannot alter the Worker or schema.
* `deploy` is push-only and not a required PR check, so a path filter cannot leave a required status pending.

## Considered Options
* Run the full chain on every merge (the prior state).
* Filter the `push` trigger by paths (chosen).
* Drop `quality` from the deploy path (left out as a separate decision).
* Split the schema steps from the Worker deploy (left out as a separate decision).

## Decision Outcome
Chosen option: "`deploy.yml`'s `push` trigger gains a `paths` filter: `app/**`, `database/**`, `.github/workflows/deploy.yml`, `quality.yml`, `db-rehearsal.yml`. A merge touching only docs, decisions, root scripts, `graphify-out/**` or other workflows does not start `quality -> rehearse -> migrate -> deploy`. Closes #438.".

### Consequences
a root `scripts/**` or doc-only merge gets no post-merge `quality` run; PR-time `checks.yml` still gates it. A new top-level directory the Worker build reads must be added to the filter. Manual redeploy still goes through `app/DEPLOYMENT.md`. Dropping `quality` from the deploy path, and splitting schema steps from the Worker deploy, were considered and left out as separate decisions.

### Confidence
Rationale unknown — no source found.

### Revisit When
A new top-level directory that the Worker build reads must be added to the `paths` filter.

### Confirmation
`.github/workflows/deploy.yml` lists the 5 `push` paths. Manual redeploy still goes through `app/DEPLOYMENT.md`.

## Pros and Cons of the Options
### Run the full chain on every merge
* Bad, because docs, decisions and root-script merges cut a Neon branch, run the migration runner and redeploy the Worker.

### Filter the `push` trigger by paths
* Good, because a merge touching only docs, decisions, root scripts, `graphify-out/**` or other workflows starts no deploy.
* Bad, because a root `scripts/**` or doc-only merge gets no post-merge `quality` run; PR-time `checks.yml` still gates it.

## Evidence / More Information
Decided: 2026-10-03

* Commit `1908fe6d` (adds the D392 row and the `paths` filter; closes #438): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When and Confirmation.
* `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md` (Out of scope): cites D392's filter and notes that skipping `deploy` on seed-only merges stays a separate decision.
