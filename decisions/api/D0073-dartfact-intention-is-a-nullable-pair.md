---
id: D0073
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, contract]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `DartFact` intention is a nullable pair

## Context and Problem Statement
Contract must express what the schema models

The architecture review found that `DartFact` cannot express darts the schema models, and that recreational sessions replay as empty.

## Decision Drivers
* `DartFact` could not express darts the schema models (Problem).
* `chk_dart_target_consistency` already permits both intention columns to be null (Decision 6b).
* The `v_dart_analytics` intention filter should be meaningful rather than dead code (Decision 6c).

## Considered Options
* Leave `DartFact` as the contract stood, unable to express the darts the schema models.
* Make the intention a nullable pair, with capture-mode rules in the service layer (chosen).

## Decision Outcome
Chosen option: "`DartFact` intention is a nullable pair; ANALYTICS capture ⇒ intention required (service-validated); RECREATIONAL + DETAILED_DARTS = hit-only dart rows", because Contract must express what the schema models.

### Consequences
* Good, because the `v_dart_analytics` intention filter becomes meaningful rather than dead code.
* Neutral, because hit fields stay required on every dart row, and `RECREATIONAL` + `QUICK_SCORE` produces `darts: []`.
* Neutral, because the capture-mode and input-mode matrix is documented in `06-Spec/01-Reference-Layer.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Leave `DartFact` unchanged
* Bad, because the contract cannot express what the schema models.

### Nullable intention pair
* Good, because the contract expresses darts the schema models, mirroring `chk_dart_target_consistency`.
* Good, because the `v_dart_analytics` intention filter becomes meaningful.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem; Decision 6b, 6c): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* Applied in: `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (each validator enforces the capture/input-mode matrix, D07/D73).
