---
id: D0033
status: accepted
date:
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

# Worker/API generates UUIDv7 for runtime persistence entities

## Context and Problem Statement
Trust boundary: ids minted server-side

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Worker/API generates UUIDv7 for runtime persistence entities; frontend sends gameplay payloads only", because Trust boundary: ids minted server-side.

### Consequences
* Neutral, because the batch write payload carries `implementation_key` references and no persistence UUIDs (API architecture spec, Section 5.1).
* Neutral, because `clientKey` and `parentClientKey` express ordering and nesting on the client, and the server maps them to generated UUIDv7 rows.
* Neutral, because the batch write response returns counts only and no server UUIDs, since the frontend does not store persistence UUIDs (response contracts spec, Section 2 C8).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: P82–85

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D33): origin of the split-copied Context and Decision Outcome. Its message says prompts 82 to 85 (UUID ownership) are captured as D33. No section rebuilt from it.
* `docs/superpowers/specs/2026-07-10-api-architecture-design.md` (Section 5.1, Section 7): rebuilt Consequences.
* `docs/superpowers/specs/2026-07-12-api-response-contracts-design.md` (Section 2 C8): rebuilt Consequences.
