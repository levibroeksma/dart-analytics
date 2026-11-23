---
id: D0071
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `GET /api/configuration-templates` backed by `v_configuration_presets` (migration `0016`)

## Context and Problem Statement
Game setup needs preset discovery; presets have no implementation_key by design

The architecture review found that game setup was unbuildable: `templateRef` resolved by a column that does not exist, and no endpoint listed presets.

## Decision Drivers
* `templateRef` resolved by an `implementation_key` column that `configuration_templates` deliberately lacks (Decision 5).
* No endpoint listed presets (Problem item 5).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`GET /api/configuration-templates` backed by `v_configuration_presets` (migration `0016`); `templateRef` = preset UUID; "no persistence UUIDs" scoped to runtime-write payloads", because Game setup needs preset discovery; presets have no implementation_key by design.

### Consequences
* Good, because the endpoint is view-backed and player-scoped, returning system presets and the player's own.
* Neutral, because preset CRUD for user presets stays deferred post-v1, so v1 presets are the read-only system seeds.
* Neutral, because game-type, ruleset, capture-mode and input-mode keys stay compile-time knowledge of the client engines, with no reference-data endpoint in v1.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem item 5; Decision 5): rebuilt Context, Decision Drivers and Consequences.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (ST4, preset lineage).
