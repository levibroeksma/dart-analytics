---
id: D0089
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Persisted schemas additive-only in 0.1.0

## Context and Problem Statement
Extend never break. Persisted store shapes and ruleset or config schemas may only be extended: fields and rules are never removed or renamed incompatibly. New fields are optional, so old persisted blobs stay valid.

## Decision Drivers
* A persisted store must stay readable by later code.
* The spec states no `schemaVersion` or migration machinery in handbook 0.1.0.

## Considered Options
* Additive-only persisted schemas with no runtime `schemaVersion` or migration machinery (chosen).
* Runtime schema versioning with migrations (rejected by the spec).

## Decision Outcome
Chosen option: "Persisted schemas additive-only in 0.1.0; no runtime schema versioning", because Extend never break.

### Consequences
* Neutral, because the spec says a breaking change, if ever unavoidable, uses a new store namespace key and never an in-place breaking mutation.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Validation list covers handbook docs only. No source names a check for the additive-only rule.

## Pros and Cons of the Options
### Additive-only with no runtime versioning
* Good, because old persisted blobs remain valid when fields are added.
* Bad, because a breaking change needs a new namespace key, which the spec states.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 5, I5; the proposed D89 row): rebuilt Context, Drivers, Considered Options and Consequences.
* Commit `238fdbc1` (2026-07-14, adds the D89 row): confirmed the decision wording.
* Augmented by D91, which adds a single `_v` discard-on-incompatible-bump safety valve.
