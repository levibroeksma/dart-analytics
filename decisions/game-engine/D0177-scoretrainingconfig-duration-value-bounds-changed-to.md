---
id: D0177
status: accepted
date: 2026-08-01
origin: contemporaneous
original-date:
tags: [game-engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `ScoreTrainingConfig.duration_value` bounds changed to ROUNDS 1–100 (was 1–50) / MINUTES

## Context and Problem Statement
Product locked session-duration ranges for the configurable-duration feature; the old MINUTES floor of 1 was not load-bearing against the field-level `.min(1)`, so raising it to 3 makes the refinement's floor probe for MINUTES the first actually load-bearing one (see `refinement-contract.ts` blind-spot note)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`ScoreTrainingConfig.duration_value` bounds changed to ROUNDS 1–100 (was 1–50) / MINUTES 3–30 (was 1–180); minutes default realigned to 5 (was 15). Setup screen exposes both as a Rounds/Timed mode radio plus one editable field, clamped client-side with a notice, and bounded server-side by the same `superRefine`".

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-01

* Commit `2ee1c8b8` (2026-08-01; adds D177 and D178): confirmed the bounds: ROUNDS 1-100, MINUTES 3-30, minutes default 5. It adds no further rationale.
