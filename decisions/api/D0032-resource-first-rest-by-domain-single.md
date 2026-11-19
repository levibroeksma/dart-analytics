---
id: D0032
status: accepted
date:
origin: contemporaneous
original-date:
tags: [api, batch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Resource-first REST by domain + single batch write action `POST

## Context and Problem Statement
Gameplay uploads are batches

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Resource-first REST by domain + single batch write action `POST /api/sessions/:sessionId/events:batch`; no per-dart API calls", because Gameplay uploads are batches.

### Consequences
* Neutral, because the batch route carries a generic `stages[]`, `turns[]`, `darts[]` tree with the same shape for every game (API architecture spec, Section 5.1).
* Neutral, because the batch write uses an `Idempotency-Key` plus a normalized payload hash, one transaction, and `409` when the session is already completed.
* Neutral, because the spec's scalability notes list batch-at-session-boundary and never per-dart calls (Section 6).

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

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D32): origin of the split-copied Context and Decision Outcome; no section rebuilt from it.
* `docs/superpowers/specs/2026-07-10-api-architecture-design.md` (Section 5.1, Section 6 Performance & scalability): rebuilt Consequences.
* Amended by D72 (batch route spelling `events/batch`).
