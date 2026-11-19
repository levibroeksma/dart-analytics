---
id: D0035
status: accepted
date:
origin: contemporaneous
original-date:
tags: [api, envelope]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Standard envelope `ok/data/requestId` · `ok/error/requestId` with domain error-code

## Context and Problem Statement
Uniform client handling

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Standard envelope `ok/data/requestId` · `ok/error/requestId` with domain error-code registry and retryable semantics", because Uniform client handling.

### Consequences
* Neutral, because envelopes come only from two shared builders, `ok(data, requestId)` and `err(code, opts, requestId)`, and handlers never hand-assemble them (API architecture spec, Section 4.1).
* Neutral, because middleware assigns `requestId`, carries it in `locals.requestId`, and echoes it in every envelope and in a response header (Section 4.3).

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

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D35): origin of the split-copied Context and Decision Outcome; no section rebuilt from it.
* `docs/superpowers/specs/2026-07-10-api-architecture-design.md` (Section 4.1, Section 4.3): rebuilt Consequences.
