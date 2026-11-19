---
id: D0060
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `POST /api/sessions` requires `captureModeKey` + `inputModeKey`

## Context and Problem Statement
`exercise_sessions` NOT-NULL mode columns need an input path

## Decision Drivers
* `exercise_sessions` requires `capture_mode_id` and `input_mode_id` (RESTRICT) and `v_active_sessions` exposes both, yet `CreateSessionRequest` supplied neither (validation spec, Section 3 finding F2).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`POST /api/sessions` requires `captureModeKey` + `inputModeKey`; every session self-describes its capture/input mode", because `exercise_sessions` NOT-NULL mode columns need an input path.

### Consequences
* Neutral, because `CreateSessionRequest` gains two required fields: `captureModeKey` (`RECREATIONAL` or `ANALYTICS`) and `inputModeKey` (`QUICK_SCORE` or `DETAILED_DARTS`).
* Neutral, because the client may default the modes from `player_settings`, but the API contract requires them explicitly.
* Neutral, because creation validates the modes against the ruleset and rejects invalid combinations through a registered error code.

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
Referenced by D0195's `Supersedes:` line.

* `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` (Section 3 F2, Section 4 D2; the spec's own numbering, not the ledger's): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md` (Task 5 Step 2): appends the ledger row D60 dated 2026-07-12.
* Applied in: `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 9b: the client sends last-used modes on every `POST /api/sessions` per D60).
