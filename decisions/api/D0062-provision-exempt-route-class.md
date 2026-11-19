---
id: D0062
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [api, endpoint, JWT]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Provision-exempt route class

## Context and Problem Statement
Endpoint must be reachable by an unprovisioned user

The 2026-07-12 validation review found that the middleware flow (verify JWT, resolve player, 403 `PLAYER_NOT_PROVISIONED`) would reject `POST /api/players/provision` itself (finding F3).

## Decision Drivers
* The provisioning route exists to resolve the state of having no `players` row, so a flow that requires that row blocks it (F3, D3).

## Considered Options
* Keep 2 route classes, public and protected, so every authenticated route resolves the player first (the flow F3 describes).
* Add a third route class that verifies the JWT and skips player resolution (chosen).

## Decision Outcome
Chosen option: "Provision-exempt route class: `POST /api/players/provision` is JWT-verified but skips player resolution", because Endpoint must be reachable by an unprovisioned user.

### Consequences
* Good, because a JWT-valid user with no `players` row reaches the handler, which creates or returns the player row.
* Neutral, because the new class has 1 member, `POST /api/players/provision`, and never returns `PLAYER_NOT_PROVISIONED`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep 2 route classes
* Bad, because the flow would reject `POST /api/players/provision` itself.

### Add a third route class
* Good, because the provisioning route reaches its handler with a valid JWT and no `players` row.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` (§ 3 F3; § 4 D3): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md` (Task 2): rebuilt Consequences.
* Applied in: `docs/superpowers/specs/2026-07-14-docs-consistency-and-gates-design.md` (row 7, which renames the class "authenticated-unprovisioned" and aliases "provision-exempt" once).
