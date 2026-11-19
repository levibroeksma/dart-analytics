---
id: D0037
status: accepted
date: 2026-07-09
origin: contemporaneous
original-date:
tags: [api, auth]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Neon Auth in phase 1 with explicit `POST /api/players/provision`

## Context and Problem Statement
Decouple identity provider from domain

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Neon Auth in phase 1 with explicit `POST /api/players/provision`; DB stores `auth_user_id` reference only", because Decouple identity provider from domain.

### Consequences
* Neutral, because after the first Neon Auth signup the frontend calls `POST /api/players/provision`, which creates the `players` row with `auth_user_id` set to the JWT `sub`.
* Neutral, because the endpoint is idempotent and returns the existing player when already provisioned.
* Neutral, because the lookup from `auth_user_id` to `playerId` belongs to middleware as domain authorization input.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-09

* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (Approved Decisions, Section 4 Player provisioning, Middleware vs service ownership): rebuilt Consequences.
* `docs/superpowers/specs/2026-07-10-api-architecture-design.md` (Section 3 D2, Section 5.3; the spec's own numbering, dated 2026-07-10, one day after this decision): rebuilt the idempotency consequence.
* Related: D62 (provision route class) and D65 (provision response) appear in `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md`, `docs/superpowers/plans/2026-07-12-api-response-contracts.md`.
