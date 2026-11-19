---
id: D0076
status: accepted
date: 2026-07-13
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

# Provision accepts optional `displayName`

## Context and Problem Statement
`players.display_name` NOT NULL needs a source at provisioning

## Decision Drivers
* `players.display_name` stays `NOT NULL`, so provisioning needs a source for it.
* Participants copy the name at session start by design, so a deferred rename endpoint is acceptable.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Provision accepts optional `displayName`; fallback JWT `name` claim → `'Player'`; rename endpoint deferred", because `players.display_name` NOT NULL needs a source at provisioning.

### Consequences
* Good, because the server resolves a stored name from the request `displayName`, then the JWT `name` claim, then the literal `'Player'`.
* Neutral, because the rename endpoint (`PATCH /api/players/me`) is deferred post-v1.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Optional `displayName` with a JWT-claim and `'Player'` fallback
* Good, because `players.display_name` always has a value at provisioning.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 9a): rebuilt Decision Drivers, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 7, Task 10a, Task 11): the contract text and ledger row.
* Commit `7c49f6d5` (2026-07-14, adds the D76 row).
