---
id: D0031
status: accepted
date:
origin: contemporaneous
original-date:
tags: [api, auth, middleware, JWT]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Auth

## Context and Problem Statement
Stateless, multi-client ready

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Auth: Bearer JWT in `Authorization` header; middleware verifies (claims `sub`+`exp`), passes `locals.auth`; 401 for identity failures, 403 for domain authorization", because Stateless, multi-client ready.

### Consequences
* Neutral, because the Neon spec's identity flow runs login, Neon Auth JWT, an `Authorization: Bearer` header, then middleware that verifies `sub` and `exp` and resolves `playerId`.
* Neutral, because middleware fills `locals.auth` with `authUserId` and `playerId` for handlers.
* Neutral, because middleware owns JWT verification and the `auth_user_id` to `playerId` lookup, while services own session ownership, business validation and domain authorization.
* Neutral, because a user with no `players` row gets `403 PLAYER_NOT_PROVISIONED` until provisioned.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: Cont. session

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D31): origin of the split-copied Context and Decision Outcome; no section rebuilt from it.
* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (Section 4 Identity flow, Player provisioning, Middleware vs service ownership): rebuilt Consequences.
* `docs/superpowers/specs/2026-07-10-api-architecture-design.md` (Section 4.2 Header contract): states `Authorization: Bearer <JWT>` as the single header definition.
