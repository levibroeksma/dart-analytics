---
id: D0070
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

# Error registry completed with

## Context and Problem Statement
Registry must cover its own frozen surface

## Decision Drivers
* The error-code registry cannot cover its own frozen surface, and it defines zero retryable codes.
* `04-Endpoint-Contracts.md` has dangling "use an appropriate code from the registry" references.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Error registry completed with `NOT_FOUND`/`VALIDATION_FAILED`/`INVALID_STATUS_TRANSITION`/`SERVICE_UNAVAILABLE` (only retryable code); registry closed for v1", because Registry must cover its own frozen surface.

### Consequences
* Good, because the dangling references in `04-Endpoint-Contracts.md` resolve to `VALIDATION_FAILED`, `INVALID_STATUS_TRANSITION` or `NOT_FOUND`.
* Good, because `SERVICE_UNAVAILABLE` is the single retryable code and activates the client retry rule.
* Neutral, because ruleset-specific validation detail travels in `error.details`, never as new codes.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Add exactly 4 codes, then close the registry for v1
* Good, because the registry then covers the surface the frozen contract already references.
* Good, because one retryable code gives the client retry rule a single trigger.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem item 4, Decision 4): rebuilt Decision Drivers, Consequences and Pros and Cons; source of the split-copied Context.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 6, Task 11): confirmed the registry text and the ledger row.
* Commit `7c49f6d5` (2026-07-14, adds the D70 row).
* Reopened by D132: `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` reopens the registry for `SESSION_ALREADY_ACTIVE`.
