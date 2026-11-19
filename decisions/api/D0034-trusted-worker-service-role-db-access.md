---
id: D0034
status: accepted
date: 2026-07-08
origin: contemporaneous
original-date:
tags: [api, Worker]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Trusted Worker service-role DB access

## Context and Problem Statement
Single trusted writer in v1

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Trusted Worker service-role DB access; PostgreSQL RLS explicitly deferred post-v1", because Single trusted writer in v1.

### Consequences
* Neutral, because the Worker is the only database client: the spec states no client-side DB access.
* Neutral, because credentials live in the environment only and are never committed.

### Confidence
Rationale unknown — no source found.

### Revisit When
PostgreSQL RLS is taken up post-v1; the Neon spec and the hardening spec both defer it to that point.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-08

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D34): origin of the split-copied Context and Decision Outcome; no section rebuilt from it.
* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (Non-goals, Section 1 Security (v1)): rebuilt Consequences and Revisit When.
* `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` (Section 2 Scope): applied in; lists RLS as out of scope, post-v1 per D34. Rebuilt Revisit When.
