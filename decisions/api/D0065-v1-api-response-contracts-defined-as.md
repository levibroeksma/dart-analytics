---
id: D0065
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [api, endpoint]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# v1 API response contracts defined as camelCase Zod DTOs over the normalized views

## Context and Problem Statement
Frozen, typed response surface for the frontend

## Decision Drivers
* `04-Endpoint-Contracts.md` fully specified request shapes but named response types without listing their fields, so a frontend could not generate a typed client (response contracts spec, Section 1).
* Defining the DTOs surfaced two contract-versus-reality defects that the earlier freeze missed (Section 1).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "v1 API response contracts defined as camelCase Zod DTOs over the normalized views; `03`/`04` frozen at 1.0.0; read shapes corrected (`active`/`replay`/`darts` return arrays); provision endpoint returns `{ playerId, authUserId, created }`", because Frozen, typed response surface for the frontend.

### Consequences
* Neutral, because view columns in snake_case map to camelCase DTOs in the repository, with one Zod schema per endpoint as source of truth (Section 2 C2).
* Neutral, because read DTOs omit `playerId`, as every read is scoped to the caller (C3).
* Neutral, because `GET /sessions/active` returns an array, as the model allows one active session per game type (C6).
* Neutral, because migration `0014` adds `session_id` to `v_dart_analytics` so the per-session darts endpoint can filter on it (C5, Section 4).
* Neutral, because `BatchWriteResponse` returns counts only (C8), and `provision` returns `{ playerId, authUserId, created }`, detected through `xmax = 0` (C9, Section 7).
* Neutral, because `03-Shared-Conventions.md` and `04-Endpoint-Contracts.md` move from draft to 1.0.0 frozen (Section 8).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-api-response-contracts-design.md` (Sections 1 to 8): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-12-api-response-contracts.md` (Task 6): appends the ledger row D65.
* Commit `5d2ea348` (PR #7, 2026-07-13): adds the ledger row D65 with the spec, plan, migration `0014` and provision change.
